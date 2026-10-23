import { createHmac } from 'node:crypto';

export const MAX_BODY_BYTES = 2_100_000;
export const MAX_PROMPT_LENGTH = 8000;
export const MAX_IMAGE_BYTES = 1_500_000;
export const MAX_UPSTREAM_BYTES = 350_000;
export class InputError extends Error {
  constructor(code, status = 400) { super(code); this.code = code; this.status = status; }
}

export async function readBounded(stream, limit, timeoutMs = 10000) {
  if (!stream) throw new InputError('empty_body');
  const reader = stream.getReader();
  const chunks = [];
  let size = 0;
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => { reject(new InputError('request_timeout', 408)); void reader.cancel().catch(() => {}); }, timeoutMs);
  });
  try {
    while (true) {
      const { done, value } = await Promise.race([reader.read(), deadline]);
      if (done) break;
      size += value.byteLength;
      if (size > limit) throw new InputError('payload_too_large', 413);
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } finally {
    clearTimeout(timer);
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export function validateInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      Object.keys(input).some(key => !['prompt', 'image'].includes(key)) || typeof input.prompt !== 'string') {
    throw new InputError('invalid_input');
  }
  const prompt = input.prompt.trim();
  if (!prompt || prompt.length > MAX_PROMPT_LENGTH) throw new InputError('invalid_prompt');
  if (input.image == null) return { prompt, image: null };
  const image = input.image;
  if (typeof image !== 'string' || image.length > 2_000_000 || image.length % 4 !== 0 ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(image)) {
    throw new InputError('invalid_image');
  }
  const bytes = Buffer.from(image, 'base64');
  if (bytes.length < 5 || bytes.length > MAX_IMAGE_BYTES || bytes.toString('base64') !== image ||
      bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff ||
      bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== 0xd9) {
    throw new InputError('invalid_image');
  }
  return { prompt, image };
}

export function originAllowed(req, env) {
  const origin = req.headers.get('origin');
  const site = req.headers.get('sec-fetch-site');
  if (site && !['same-origin', 'none'].includes(site)) return false;
  // Requests without Origin remain usable by native clients; this is not authentication.
  if (!origin) return true;
  let candidate;
  try { candidate = new URL(origin); } catch { return false; }
  if (!['https:', 'http:'].includes(candidate.protocol) || candidate.origin !== origin) return false;
  const origins = [new URL(req.url).origin, ...(env.AI_ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean)];
  return origins.includes(origin);
}

const integerSetting = (value, fallback, max) => {
  if (value === undefined || value === '') return fallback;
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 1 || n > max) throw new Error('invalid_rate_configuration');
  return n;
};

// Check and increment all windows atomically, shared across every function instance.
export const QUOTA_LUA = `
for i = 1, #KEYS do
  local value = tonumber(redis.call('GET', KEYS[i]) or '0')
  if value >= tonumber(ARGV[i]) then return 0 end
end
for i = 1, #KEYS do
  redis.call('INCR', KEYS[i])
  redis.call('EXPIREAT', KEYS[i], ARGV[#KEYS + i])
end
return 1`;

export async function checkQuota(context, env, fetcher = fetch, now = Date.now(), scope = 'ai') {
  const endpoint = env.UPSTASH_REDIS_REST_URL;
  if (!endpoint || !env.UPSTASH_REDIS_REST_TOKEN || !env.RATE_LIMIT_SALT || env.RATE_LIMIT_SALT.length < 32) {
    throw new Error('rate_limit_unconfigured');
  }
  const url = new URL(endpoint);
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.upstash.io') || url.username || url.password ||
      (url.pathname !== '/' && url.pathname !== '') || url.search || url.hash || url.port) {
    throw new Error('invalid_rate_configuration');
  }
  // Netlify context.ip is trusted platform metadata. Never trust a client-supplied forwarded header.
  if (typeof context?.ip !== 'string' || !context.ip || context.ip.length > 100) throw new Error('client_unidentified');
  const day = Math.floor(now / 86400000), minute = Math.floor(now / 60000);
  const ipHash = createHmac('sha256', env.RATE_LIMIT_SALT).update(`${day}:${context.ip}`).digest('hex');
  const limits = [integerSetting(env.LIMIT_PER_IP, 25, 10000), integerSetting(env.LIMIT_PER_DAY, 400, 100000), integerSetting(env.LIMIT_PER_MINUTE, 5, 100)];
  if (!['ai', 'login'].includes(scope)) throw new Error('invalid_rate_configuration');
  const group = `{mdaar-${scope}}`;
  const keys = [`${group}:day:${day}:ip:${ipHash}`, `${group}:day:${day}:global`, `${group}:minute:${minute}:ip:${ipHash}`];
  const expirations = [(day + 1) * 86400 + 60, (day + 1) * 86400 + 60, (minute + 1) * 60 + 60];
  const response = await fetcher(url.href, {
    method: 'POST', headers: { Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(['EVAL', QUOTA_LUA, String(keys.length), ...keys, ...limits.map(String), ...expirations.map(String)]),
    signal: AbortSignal.timeout(3000),
  });
  if (!response.ok) throw new Error('rate_limit_unavailable');
  const result = JSON.parse(await readBounded(response.body, 4096, 3000));
  if (result.error || ![0, 1].includes(result.result)) throw new Error('rate_limit_unavailable');
  return result.result === 1;
}

export function validateOutput(value) {
  let nodes = 0;
  const visit = (item, depth) => {
    if (++nodes > 3000 || depth > 10) throw new Error('invalid_ai_response');
    if (item === null || typeof item === 'boolean') return;
    if (typeof item === 'string') { if (item.length > 16000) throw new Error('invalid_ai_response'); return; }
    if (typeof item === 'number') { if (!Number.isFinite(item) || Math.abs(item) > 1e9) throw new Error('invalid_ai_response'); return; }
    if (typeof item !== 'object') throw new Error('invalid_ai_response');
    if (Array.isArray(item)) { if (item.length > 100) throw new Error('invalid_ai_response'); item.forEach(x => visit(x, depth + 1)); return; }
    for (const [key, child] of Object.entries(item)) {
      if (key.length > 100 || ['__proto__', 'prototype', 'constructor'].includes(key)) throw new Error('invalid_ai_response');
      visit(child, depth + 1);
    }
  };
  if (!value || typeof value !== 'object') throw new Error('invalid_ai_response');
  visit(value, 0);
  return value;
}
