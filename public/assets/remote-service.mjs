// Short-lived session tokens stay in this module's memory, never localStorage.
let cached = null;

export function serviceOrigin(document = globalThis.document) {
  const configured = document?.querySelector('meta[name="mdaar-service-origin"]')?.content;
  if (!configured) return '';
  try {
    const url = new URL(configured);
    return url.protocol === 'https:' && url.pathname === '/' && !url.username && !url.password && !url.search && !url.hash ? url.origin : '';
  } catch { return ''; }
}

export function clearRemoteSession() { cached = null; }

export async function askRemote(origin, prompt, signal) {
  const errorCode = status => status === 401 ? 'auth' : status === 429 ? 'rate_limited' : 'srv';
  async function post(path, payload, token) {
    signal?.throwIfAborted();
    let response;
    try {
      response = await fetch(origin + path, {
        method:'POST', mode:'cors', credentials:'omit', cache:'no-store', redirect:'error', signal,
        headers:{'Content-Type':'application/json', ...(token ? {Authorization:`Bearer ${token}`} : {})}, body:JSON.stringify(payload),
      });
    } catch { throw {code:signal?.aborted ? 'cancelled' : 'net'}; }
    signal?.throwIfAborted();
    // Bound the response before parsing, even if a service is misconfigured.
    const reader = response.body?.getReader();
    if (!reader) throw {code:'srv', detail:'invalid_ai_response'};
    let bytes = 0, text = '';
    const decoder = new TextDecoder('utf-8', {fatal:true});
    try {
      while (true) {
        const {done, value} = await reader.read(); if (done) break;
        bytes += value.byteLength;
        if (bytes > 350000) throw Error('oversized');
        text += decoder.decode(value, {stream:true});
      }
      text += decoder.decode();
      signal?.throwIfAborted();
      return {response, data:JSON.parse(text)};
    } catch { throw {code:signal?.aborted ? 'cancelled' : 'srv', detail:'invalid_ai_response'}; }
    finally { void reader.cancel().catch(() => {}); reader.releaseLock(); }
  }
  async function session() {
    if (cached?.origin === origin && cached.until > Date.now() + 10000) return cached.token;
    const {response, data} = await post('/api/session', {start:true});
    if (!response.ok) throw {code:errorCode(response.status), detail:data?.error};
    if (data?.authenticated !== true || typeof data.token !== 'string' || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(data.token) || data.token.length > 1024 || !Number.isInteger(data.expiresIn) || data.expiresIn < 1 || data.expiresIn > 900) throw {code:'srv', detail:'invalid_ai_response'};
    signal?.throwIfAborted();
    cached = {origin, token:data.token, until:Date.now() + data.expiresIn * 1000};
    return data.token;
  }
  let result = await post('/api/ai', {prompt}, await session());
  if (result.response.status === 401) {
    clearRemoteSession(); result = await post('/api/ai', {prompt}, await session());
  }
  if (!result.response.ok) throw {code:errorCode(result.response.status), detail:result.data?.error};
  if (!result.data?.data || typeof result.data.data !== 'object') throw {code:'srv', detail:'invalid_ai_response'};
  return result.data.data;
}
