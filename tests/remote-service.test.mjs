import test from 'node:test';
import assert from 'node:assert/strict';
import {askRemote, serviceOrigin, clearRemoteSession} from '../public/assets/remote-service.mjs';
import worker, {MdaarGuard} from '../cloudflare/worker.mjs';

const ORIGIN='https://mdaar21-service.example.workers.dev';
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
const session=()=>json({authenticated:true,token:'fixture.signature',expiresIn:900});

test('remote origin comes only from a valid HTTPS origin in owner-controlled markup',()=>{
  const doc=value=>({querySelector:()=>({content:value})});
  assert.equal(serviceOrigin(doc(ORIGIN)),ORIGIN);
  for(const value of ['', 'http://example.org','https://user:password@example.org','https://example.org/path','https://example.org/?x=1','https://example.org/#hash','javascript:alert(1)'])assert.equal(serviceOrigin(doc(value)),'');
});

test('first remote request starts automatically and caches only an in-memory session',async()=>{
  const previous=globalThis.fetch;clearRemoteSession();const calls=[];
  try{
    globalThis.fetch=async(url,options)=>{calls.push({url,options});return url.endsWith('/api/session')?session():json({data:{answer:'test',suggestions:[]}});};
    assert.deepEqual(await askRemote(ORIGIN,'سؤال'),{answer:'test',suggestions:[]});
    await askRemote(ORIGIN,'سؤال آخر');assert.equal(calls.length,3);
    assert.deepEqual(JSON.parse(calls[0].options.body),{start:true});assert(!('Authorization' in calls[0].options.headers));
    assert.equal(calls[1].options.headers.Authorization,'Bearer fixture.signature');
    for(const {url,options} of calls){assert(url.startsWith(ORIGIN));assert.equal(options.credentials,'omit');assert.equal(options.cache,'no-store');assert.equal(options.redirect,'error');}
    clearRemoteSession();await askRemote(ORIGIN,'جديد');assert.equal(calls.filter(c=>c.url.endsWith('/api/session')).length,2);
  }finally{globalThis.fetch=previous;clearRemoteSession();}
});

test('unauthorized session is refreshed once; rate and provider errors do not silently regenerate',async()=>{
  const previous=globalThis.fetch;clearRemoteSession();
  try{
    const calls=[];globalThis.fetch=async url=>{calls.push(url);return url.endsWith('/api/session')?session():json({error:'auth_required'},401);};
    await assert.rejects(askRemote(ORIGIN,'سؤال'),e=>e.code==='auth');assert.equal(calls.length,4);
    for(const [status,code] of [[429,'rate_limited'],[502,'srv']]){
      clearRemoteSession();let completions=0;globalThis.fetch=async url=>url.endsWith('/api/session')?session():(completions++,json({error:'ai_unavailable'},status));
      await assert.rejects(askRemote(ORIGIN,'سؤال'),e=>e.code===code);assert.equal(completions,1);
    }
  }finally{globalThis.fetch=previous;clearRemoteSession();}
});

test('cancellation during session creation cannot trigger an AI request or retain a late token',async()=>{
  const previous=globalThis.fetch;clearRemoteSession();const controller=new AbortController();let calls=0;
  try{
    globalThis.fetch=async()=>{calls++;controller.abort();return session();};
    await assert.rejects(askRemote(ORIGIN,'سؤال',controller.signal));assert.equal(calls,1);
    globalThis.fetch=async url=>{calls++;return url.endsWith('/api/session')?session():json({data:{answer:'ok'}});};
    await askRemote(ORIGIN,'جديد');assert.equal(calls,3);
  }finally{globalThis.fetch=previous;clearRemoteSession();}
});

test('malformed or oversized session/provider responses are rejected',async()=>{
  const previous=globalThis.fetch;
  try{
    for(const response of [()=>json({authenticated:true,token:'invalid',expiresIn:900}),()=>json({authenticated:true,token:'a.b',expiresIn:10000}),()=>new Response('x'.repeat(350001))]){
      clearRemoteSession();globalThis.fetch=async()=>response();await assert.rejects(askRemote(ORIGIN,'سؤال'),e=>e.detail==='invalid_ai_response');
    }
    clearRemoteSession();globalThis.fetch=async url=>url.endsWith('/api/session')?session():json({data:'unsafe shape'});
    await assert.rejects(askRemote(ORIGIN,'سؤال'),e=>e.detail==='invalid_ai_response');
  }finally{globalThis.fetch=previous;clearRemoteSession();}
});

test('the real Worker and real browser adapter agree on session and response contracts',async()=>{
  // Storage fixture only: use the actual guard, Worker, client and structured output.
  const values=new Map();let alarm=null,queue=Promise.resolve();
  const storage={
    async get(key){return Array.isArray(key)?new Map(key.filter(k=>values.has(k)).map(k=>[k,values.get(k)])):values.get(key);},
    async put(key,value){if(typeof key==='string')values.set(key,value);else for(const [k,v]of Object.entries(key))values.set(k,v);},
    async getAlarm(){return alarm;},async setAlarm(value){alarm=value;},
    transaction(fn){const next=queue.then(()=>fn(storage));queue=next.catch(()=>{});return next;},
  };
  const env={ALLOWED_ORIGIN:'https://nbbttdhnybnnb-crypto.github.io',GROQ_API_KEY:'fixture-only-not-a-real-key'};
  const guard=new MdaarGuard({storage,blockConcurrencyWhile:fn=>Promise.resolve().then(fn)},env);
  env.MDAAR_GUARD={idFromName:name=>name,get:()=>guard};
  const previous=globalThis.fetch;clearRemoteSession();const paths=[];
  try{
    globalThis.fetch=async(url,options)=>{
      if(url.startsWith(ORIGIN)){
        paths.push(new URL(url).pathname);
        return worker.fetch(new Request(url,{...options,headers:{...options.headers,Origin:env.ALLOWED_ORIGIN,'CF-Connecting-IP':'192.0.2.20'}}),env);
      }
      assert.equal(url,'https://api.groq.com/openai/v1/chat/completions');
      return json({choices:[{finish_reason:'stop',message:{content:'{"answer":"من الخدمة","suggestions":[]}'}}]});
    };
    assert.deepEqual(await askRemote(ORIGIN,'اشرح الحاسبة'),{answer:'من الخدمة',suggestions:[]});assert.deepEqual(paths,['/api/session','/api/ai']);
  }finally{globalThis.fetch=previous;clearRemoteSession();}
});
