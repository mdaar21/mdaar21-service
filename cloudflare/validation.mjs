// Shared, bounded JSON handling. No credentials or user content are logged.
export class ServiceError extends Error {
  constructor(code, status = 400) { super(code); this.status = status; }
}

export async function readJSON(response, limit, timeout = 10000) {
  const reader = response.body?.getReader();
  if (!reader) throw new ServiceError('invalid_body');
  let bytes = 0, timer;
  const chunks = [];
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => { reject(new ServiceError('request_timeout', 408)); void reader.cancel().catch(() => {}); }, timeout);
  });
  try {
    while (true) {
      const {done, value} = await Promise.race([reader.read(), deadline]);
      if (done) break;
      bytes += value.byteLength;
      if (bytes > limit) throw new ServiceError('payload_too_large', 413);
      chunks.push(value);
    }
    const data = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.length; }
    try { return JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(data)); }
    catch { throw new ServiceError('invalid_json'); }
  } finally { clearTimeout(timer); void reader.cancel().catch(() => {}); reader.releaseLock(); }
}

export function validOutput(value) {
  let nodes = 0;
  function visit(item, depth) {
    if (++nodes > 3000 || depth > 10) throw new ServiceError('invalid_ai_response', 502);
    if (item === null || typeof item === 'boolean') return;
    if (typeof item === 'string' && item.length <= 16000) return;
    if (typeof item === 'number' && Number.isFinite(item) && Math.abs(item) <= 1e9) return;
    if (!item || typeof item !== 'object') throw new ServiceError('invalid_ai_response', 502);
    if (Array.isArray(item)) {
      if (item.length > 100) throw new ServiceError('invalid_ai_response', 502);
      item.forEach(child => visit(child, depth + 1));
    } else {
      for (const [key, child] of Object.entries(item)) {
        if (key.length > 100 || ['__proto__', 'prototype', 'constructor'].includes(key)) throw new ServiceError('invalid_ai_response', 502);
        visit(child, depth + 1);
      }
    }
  }
  if (!value || typeof value !== 'object') throw new ServiceError('invalid_ai_response', 502);
  visit(value, 0);
  return value;
}
