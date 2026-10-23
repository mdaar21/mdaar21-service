import test from 'node:test';
import assert from 'node:assert/strict';
import worker, {MdaarGuard} from '../cloudflare/worker.mjs';

const ORIGIN = 'https://nbbttdhnybnnb-crypto.github.io';
const IP = '192.0.2.5';
const record = value => new Response(JSON.stringify(value), {headers:{'Content-Type':'application/json'}});
const completion = content => record({choices:[{finish_reason:'stop', message:{content:typeof content === 'string' ? content : JSON.stringify(content)}}]});

class MemoryStorage {
  values = new Map(); alarm = null; queue = Promise.resolve();
  async get(key) { return Array.isArray(key) ? new Map(key.filter(k => this.values.has(k)).map(k => [k, structuredClone(this.values.get(k))])) : structuredClone(this.values.get(key)); }
  async put(key, value) { if (typeof key === 'string') this.values.set(key, structuredClone(value)); else for (const [k,v] of Object.entries(key)) this.values.set(k, structuredClone(v)); }
  async delete(keys) { for (const key of Array.isArray(keys) ? keys : [keys]) this.values.delete(key); }
  async list({prefix='', end, limit=1000}) { return new Map([...this.values].filter(([key]) => key.startsWith(prefix) && (!end || key < end)).sort(([a],[b]) => a.localeCompare(b)).slice(0,limit)); }
  async getAlarm() { return this.alarm; }
  async setAlarm(value) { this.alarm = value; }
  transaction(fn) {
    const run = this.queue.then(() => fn(this)); this.queue = run.catch(() => {}); return run;
  }
}
function environment() {
  const env = {ALLOWED_ORIGIN:ORIGIN, GROQ_API_KEY:'fixture-worker-provider-not-a-real-key'};
  const storage = new MemoryStorage();
  const state = {storage, blockConcurrencyWhile:fn => Promise.resolve().then(fn)};
  const guard = new MdaarGuard(state, env);
  env.MDAAR_GUARD = {idFromName:name => name, get:() => guard};
  return {env, storage, guard};
}
function request(path, {method='POST', body, token, origin=ORIGIN, ip=IP, headers={}} = {}) {
  return new Request('https://worker.example' + path, {
    method, headers:{Origin:origin, 'CF-Connecting-IP':ip, ...(method === 'POST' ? {'Content-Type':'application/json'} : {}), ...(token ? {Authorization:`Bearer ${token}`} : {}), ...headers},
    ...(method === 'POST' ? {body:typeof body === 'string' ? body : JSON.stringify(body ?? {start:true})} : {}),
  });
}
async function start(env, options) {
  const response = await worker.fetch(request('/api/session', options), env);
  assert.equal(response.status, 200); return (await response.json()).token;
}

test('Cloudflare CORS permits only the configured GitHub origin and exact preflight headers', async () => {
  const {env} = environment();
  const response = await worker.fetch(request('/api/ai', {method:'OPTIONS', headers:{'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type, authorization'}}), env);
  assert.equal(response.status,204); assert.equal(response.headers.get('Access-Control-Allow-Origin'),ORIGIN);
  assert.equal(response.headers.get('Access-Control-Allow-Credentials'),null);
  assert.equal((await worker.fetch(request('/api/ai',{method:'OPTIONS',origin:'https://attacker.example'}),env)).status,403);
  assert.equal((await worker.fetch(request('/api/ai',{method:'OPTIONS',headers:{'Access-Control-Request-Method':'DELETE'}}),env)).status,405);
  assert.equal((await worker.fetch(request('/api/ai',{method:'OPTIONS',headers:{'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'x-custom'}}),env)).status,405);
  assert.equal((await worker.fetch(request('/api/ai',{origin:'null'}),env)).status,403);
});

test('Worker stays unavailable without a provider secret, durable guard or client identity',async()=>{
  const {env}=environment();
  assert.deepEqual(await (await worker.fetch(new Request('https://worker.example/'),env)).json(),{service:'mdaar',configured:true});
  assert.equal((await worker.fetch(new Request('https://worker.example/'),{...env,GROQ_API_KEY:''})).status,503);
  for (const override of [{GROQ_API_KEY:''},{MDAAR_GUARD:null}]) assert.equal((await worker.fetch(request('/api/session'),{...env,...override})).status,503);
  const r=await worker.fetch(request('/api/session',{ip:''}),env);assert.equal(r.status,503);assert.equal(r.headers.get('Access-Control-Allow-Origin'),ORIGIN);
  assert.equal((await worker.fetch(request('/api/session',{method:'GET'}),env)).status,200);
});

test('unreachable durable storage fails closed before the provider is contacted',async()=>{
  const {env}=environment();const previous=globalThis.fetch;let calls=0;
  env.MDAAR_GUARD={idFromName:name=>name,get:()=>({fetch:async()=>{throw Error('unavailable')}})};
  try{
    globalThis.fetch=async()=>{calls++;return completion({answer:'unused'});};
    assert.equal((await worker.fetch(request('/api/ai',{token:'fixture.signature',body:{prompt:'اختبار'}}),env)).status,503);
    assert.equal((await worker.fetch(request('/api/session'),env)).status,503);assert.equal(calls,0);
  }finally{globalThis.fetch=previous;}
});

test('first Send creates an origin-bound short session without consent, credentials or a cookie',async()=>{
  const {env,storage}=environment();
  const response=await worker.fetch(request('/api/session'),env),data=await response.json();
  assert.equal(response.status,200);assert.equal(data.authenticated,true);assert.equal(data.expiresIn,900);assert.match(data.token,/^[\w-]+\.[\w-]+$/);
  assert.equal(response.headers.get('Set-Cookie'),null);assert.equal(response.headers.get('Cache-Control'),'no-store');
  assert(!JSON.stringify(data).includes(env.GROQ_API_KEY));assert(storage.values.has('signing-key'));
  assert(!JSON.stringify([...storage.values]).includes(IP));
  for(const body of [{consent:true},{start:false},{start:true,extra:true},null,[]]) {
    const r=await worker.fetch(request('/api/session',{body:JSON.stringify(body)}),env);assert.equal(r.status,400);
  }
});

test('guarded provider response reaches GitHub client shape; errors and secrets are never echoed',async()=>{
  const {env}=environment(); const token=await start(env);const previous=globalThis.fetch;let calls=0;
  try {
    globalThis.fetch=async(url,options)=>{calls++;assert.equal(url,'https://api.groq.com/openai/v1/chat/completions');assert.equal(options.headers.Authorization,`Bearer ${env.GROQ_API_KEY}`);assert.equal(JSON.parse(options.body).max_completion_tokens,1500);return completion({answer:'إجابة اختبار',suggestions:[]});};
    const r=await worker.fetch(request('/api/ai',{token,body:{prompt:'كيف أستخدم الحاسبة؟'}}),env);
    assert.equal(r.status,200);assert.deepEqual(await r.json(),{data:{answer:'إجابة اختبار',suggestions:[]}});assert.equal(calls,1);
    globalThis.fetch=async()=>new Response('PRIVATE_PROVIDER_ERROR_SENTINEL',{status:500});
    const failed=await worker.fetch(request('/api/ai',{token,body:{prompt:'اختبار'}}),env);assert.equal(failed.status,502);assert.deepEqual(await failed.json(),{error:'ai_unavailable'});
  }finally{globalThis.fetch=previous;}
});

test('tokens reject tampering, expiry, origin and IP changes before calling the provider',async()=>{
  const {env}=environment();const token=await start(env);const previous=globalThis.fetch,clock=Date.now;let calls=0;
  try {
    globalThis.fetch=async()=>{calls++;return completion({answer:'unused'});};
    for(const options of [{},{token:token.slice(0,-2)+'xx'},{token,ip:'192.0.2.6'},{token,origin:'https://attacker.example'}]) {
      const r=await worker.fetch(request('/api/ai',{body:{prompt:'اختبار'},...options}),env);assert([401,403].includes(r.status));
    }
    Date.now=()=>clock()+901000;
    assert.equal((await worker.fetch(request('/api/ai',{token,body:{prompt:'اختبار'}}),env)).status,401);
    assert.equal(calls,0);
  }finally{globalThis.fetch=previous;Date.now=clock;}
});

test('concurrent durable AI quotas allow at most five per minute and stop provider spend',async()=>{
  const {env}=environment();const token=await start(env),previous=globalThis.fetch;let calls=0;
  try {
    globalThis.fetch=async()=>{calls++;return completion({answer:'ok',suggestions:[]});};
    const responses=await Promise.all(Array.from({length:12},()=>worker.fetch(request('/api/ai',{token,body:{prompt:'اختبار'}}),env)));
    assert.equal(responses.filter(r=>r.status===200).length,5);assert.equal(responses.filter(r=>r.status===429).length,7);assert.equal(calls,5);
  }finally{globalThis.fetch=previous;}
});

test('daily and global counters share durable state across clients and object restarts',async()=>{
  const {env,storage,guard}=environment();await guard.ready;
  const now=Date.UTC(2026,9,23,12), dayEnd=(Math.floor(now/86400000)+1)*86400000;
  assert.equal(await guard.quota('ai','client-a',now),true);
  await storage.put(`quota:${dayEnd}:ai:day:client-a`,25);
  assert.equal(await guard.quota('ai','client-a',now),false);
  await storage.put(`quota:${dayEnd}:ai:global`,400);
  assert.equal(await guard.quota('ai','different-client',now),false);
  const again=new MdaarGuard({storage,blockConcurrencyWhile:fn=>Promise.resolve().then(fn)},env);await again.ready;
  assert.equal(await guard.signature('message'),await again.signature('message'));
  assert.equal(await again.quota('ai','different-client',now),false);
});

test('alarm deletes expired pseudonymous counters and keeps signing material and current counters',async()=>{
  const {storage,guard}=environment();await guard.ready;const now=Date.now();
  await storage.put({[`quota:${now-10}:ai:old`]:1,[`quota:${now+100000}:ai:current`]:1});
  await guard.alarm();assert.equal(await storage.get(`quota:${now-10}:ai:old`),undefined);assert.equal(await storage.get(`quota:${now+100000}:ai:current`),1);assert(storage.values.has('signing-key'));assert(storage.alarm>now);
});

test('bounded requests reject unsupported fields, bodies, prompts and media types',async()=>{
  const {env}=environment(),token=await start(env);
  for(const body of ['null','[]','{bad',JSON.stringify({prompt:'x',image:'x'}),JSON.stringify({prompt:'x'.repeat(8001)})]) {
    assert.equal((await worker.fetch(request('/api/ai',{token,body}),env)).status,400);
  }
  assert.equal((await worker.fetch(request('/api/ai',{token,body:' '.repeat(40001)}),env)).status,413);
  assert.equal((await worker.fetch(request('/api/ai',{token,headers:{'Content-Type':'text/plain'}}),env)).status,415);
  assert.equal((await worker.fetch(request('/api/ai',{method:'GET'}),env)).status,405);
});

test('format retry is bounded, uses one deadline and rejects unsafe or truncated output',async()=>{
  const previous=globalThis.fetch;
  try {
    let {env}=environment(),token=await start(env),bodies=[],signals=[];
    globalThis.fetch=async(_url,options)=>{bodies.push(JSON.parse(options.body));signals.push(options.signal);return bodies.length===1?new Response('PRIVATE',{status:400}):completion({answer:'ok',suggestions:[]});};
    assert.equal((await worker.fetch(request('/api/ai',{token,body:{prompt:'اختبار'}}),env)).status,200);assert.equal(bodies.length,2);assert.equal(bodies[1].response_format,undefined);assert.equal(signals[0],signals[1]);
    for(const raw of ['not json','{"__proto__":{"polluted":true}}','1']) {
      ({env}=environment());token=await start(env);globalThis.fetch=async()=>completion(raw);
      const response=await worker.fetch(request('/api/ai',{token,body:{prompt:'اختبار'}}),env);assert.equal(response.status,502);assert.deepEqual(await response.json(),{error:'invalid_ai_response'});
    }
    ({env}=environment());token=await start(env);globalThis.fetch=async()=>record({choices:[{finish_reason:'length',message:{content:'{"answer":"cut"}'}}]});
    assert.equal((await worker.fetch(request('/api/ai',{token,body:{prompt:'اختبار'}}),env)).status,502);
  }finally{globalThis.fetch=previous;}
});
