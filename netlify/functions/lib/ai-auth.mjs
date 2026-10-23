import { createHmac, createHash, randomBytes, timingSafeEqual } from 'node:crypto';
export const COOKIE_NAME = '__Host-mdaar_session';
export const SESSION_SECONDS = 12 * 60 * 60;
export const publicAccessEnabled = env => env.AI_PUBLIC_ACCESS === 'true';

export function authConfigured(env) {
  return typeof env.AI_SESSION_SECRET === 'string' && env.AI_SESSION_SECRET.length >= 32 &&
    (publicAccessEnabled(env) || (typeof env.AI_ACCESS_CODE === 'string' && env.AI_ACCESS_CODE.length >= 12 && env.AI_ACCESS_CODE.length <= 256));
}
const digest = value => createHash('sha256').update(value).digest();
export function accessCodeMatches(code, expected) {
  return typeof code === 'string' && typeof expected === 'string' && timingSafeEqual(digest(code), digest(expected));
}
const signature = (value, secret) => createHmac('sha256', secret).update(value).digest('base64url');
export function issueSession(secret, now = Date.now(), access = 'invite') {
  const iat = Math.floor(now / 1000);
  const payload = Buffer.from(JSON.stringify({ v: 1, access, iat, exp: iat + SESSION_SECONDS, nonce: randomBytes(16).toString('hex') })).toString('base64url');
  return `${payload}.${signature(payload, secret)}`;
}
export function hasSession(req, env, now = Date.now()) {
  if (!authConfigured(env)) return false;
  const cookies = (req.headers.get('cookie') || '').split(';').map(s => s.trim()).filter(s => s.startsWith(`${COOKIE_NAME}=`));
  if (cookies.length !== 1) return false;
  const value = cookies[0].slice(COOKIE_NAME.length + 1);
  if (value.length > 512 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)) return false;
  const [payload, supplied] = value.split('.');
  const expected = signature(payload, env.AI_SESSION_SECRET);
  if (supplied.length !== expected.length || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (data.access === 'public' && !publicAccessEnabled(env)) return false;
    if (data.access !== undefined && !['invite','public'].includes(data.access)) return false;
    const seconds = Math.floor(now / 1000);
    return data.v === 1 && Number.isInteger(data.iat) && Number.isInteger(data.exp) &&
      data.iat <= seconds && data.exp > seconds && data.exp - data.iat === SESSION_SECONDS;
  } catch { return false; }
}
export function sessionCookie(value = '') {
  return `${COOKIE_NAME}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${value ? SESSION_SECONDS : 0}`;
}
