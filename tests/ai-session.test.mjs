import {test} from 'node:test';
import assert from 'node:assert/strict';
import session from '../netlify/functions/session.mjs';
import ai from '../netlify/functions/ai.mjs';
import {issueSession,hasSession,SESSION_SECONDS,COOKIE_NAME} from '../netlify/functions/lib/ai-auth.mjs';
const env={AI_SESSION_SECRET:'offline-session-signing-secret-32-characters',AI_ACCESS_CODE:'offline-invitation-code',UPSTASH_REDIS_REST_URL:'https://fixture.upstash.io',UPSTASH_REDIS_REST_TOKEN:'offline-redis',RATE_LIMIT_SALT:'offline-ratelimit-salt-32-characters',GROQ_API_KEY:'offline-provider'};
const req=(method='GET',body,headers={})=>new Request('https://mdaar.example/api/session',{method,headers:{'content-type':'application/json',...headers},...(body===undefined?{}:{body:typeof body==='string'?body:JSON.stringify(body)})});
const context={ip:'203.0.113.9'};
test('shared invite login and signed HTTP-only session lifecycle',async t=>{
 const old=Object.fromEntries(Object.keys(env).map(k=>[k,process.env[k]])),oldFetch=globalThis.fetch;
 try {
  Object.assign(process.env,env);
  const calls=[];
  globalThis.fetch=async(url,options)=>{calls.push({url:String(url),options});return new Response(JSON.stringify({result:1}));};
  await t.test('not authenticated before login',async()=>{
   const r=await session(req(),context);assert.equal(r.status,200);assert.deepEqual(await r.json(),{authenticated:false});
   const a=await ai(new Request('https://mdaar.example/api/ai',{method:'POST',headers:{'content-type':'application/json'},body:'{"prompt":"x"}'}),context);
   assert.equal(a.status,401);assert.deepEqual(await a.json(),{error:'auth_required'});
  });
  await t.test('missing signing or invite configuration fails closed',async()=>{
   delete process.env.AI_SESSION_SECRET;const r=await session(req(),context);assert.equal(r.status,503);
   const a=await ai(new Request('https://mdaar.example/api/ai',{method:'POST'}),context);assert.equal(a.status,503);
   process.env.AI_SESSION_SECRET=env.AI_SESSION_SECRET;
  });
  await t.test('login rejects malformed input and cross origin',async()=>{
   for(const value of ['{','null','[]','{}','{"code":4}','{"code":"x","other":true}'])assert.equal((await session(req('POST',value),context)).status,400);
   assert.equal((await session(req('POST',{code:'x'},{origin:'https://attacker.example'}),context)).status,403);
   assert.equal((await session(req('POST',{code:'x'},{'content-type':'text/plain'}),context)).status,415);
   assert.equal((await session(req('POST','x'.repeat(1025)),context)).status,413);
  });
  await t.test('wrong invitation is rate limited before comparison without cookie issuance',async()=>{
   const r=await session(req('POST',{code:'wrong-but-long-code'}),context);assert.equal(r.status,401);assert.equal(r.headers.get('set-cookie'),null);
   const command=JSON.parse(calls.at(-1).options.body);assert.match(command[3],/^\{mdaar-login\}/);assert.deepEqual(command.slice(6,9),['20','200','5']);
  });
  let cookie;
  await t.test('login issues secure cookie; status recognizes it',async()=>{
   const r=await session(req('POST',{code:env.AI_ACCESS_CODE}),context);assert.equal(r.status,200);assert.deepEqual(await r.json(),{authenticated:true});
   const full=r.headers.get('set-cookie');for(const flag of ['HttpOnly','Secure','SameSite=Strict','Path=/','Max-Age=43200'])assert.ok(full.includes(flag));
   assert.ok(!full.includes(env.AI_ACCESS_CODE));cookie=full.split(';')[0];
   assert.deepEqual(await(await session(req('GET',undefined,{cookie}),context)).json(),{authenticated:true});
   const before=globalThis.fetch;
   globalThis.fetch=async(url,options)=>String(url).includes('.upstash.io')?before(url,options):new Response(JSON.stringify({choices:[{message:{content:'{\"summary\":\"authorized\"}'}}]}));
   const completion=await ai(new Request('https://mdaar.example/api/ai',{method:'POST',headers:{'content-type':'application/json',cookie},body:'{\"prompt\":\"x\"}'}),context);
   assert.equal(completion.status,200);assert.deepEqual(await completion.json(),{data:{summary:'authorized'}});
   globalThis.fetch=before;
  });
  await t.test('logout clears browser cookie',async()=>{
   const r=await session(req('DELETE',undefined,{cookie}),context);assert.equal(r.status,200);assert.ok(r.headers.get('set-cookie').includes('Max-Age=0'));
  });
  await t.test('quota unavailability and limit both block login',async()=>{
   globalThis.fetch=async()=>new Response(JSON.stringify({result:0}));assert.equal((await session(req('POST',{code:env.AI_ACCESS_CODE}),context)).status,429);
   globalThis.fetch=async()=>{throw new Error('offline');};assert.equal((await session(req('POST',{code:env.AI_ACCESS_CODE}),context)).status,503);
  });
 }finally{
  globalThis.fetch=oldFetch;for(const[k,v]of Object.entries(old)){if(v===undefined)delete process.env[k];else process.env[k]=v;}
 }
});
test('signed sessions reject tampering, duplicate cookies, expiry, future times and secret rotation',()=>{
 const now=1700000000000,token=issueSession(env.AI_SESSION_SECRET,now);
 const request=value=>req('GET',undefined,{cookie:`${COOKIE_NAME}=${value}`});
 assert.ok(hasSession(request(token),env,now+1));
 assert.ok(!hasSession(request(`${token.slice(0,-1)}${token.endsWith('A')?'B':'A'}`),env,now));
 assert.ok(!hasSession(request(token),env,now+SESSION_SECONDS*1000));
 assert.ok(!hasSession(request(token),env,now-1000));
 assert.ok(!hasSession(request(token),{...env,AI_SESSION_SECRET:'rotated-session-secret-32-characters'},now));
 assert.ok(!hasSession(req('GET',undefined,{cookie:`${COOKIE_NAME}=${token}; ${COOKIE_NAME}=${token}`}),env,now));
});

test('public access starts a signed session automatically without accepting invitation codes',async t=>{
 const keys=[...Object.keys(env),'AI_PUBLIC_ACCESS'];
 const old=Object.fromEntries(keys.map(k=>[k,process.env[k]])),oldFetch=globalThis.fetch;
 try {
  Object.assign(process.env,env,{AI_PUBLIC_ACCESS:'true'});delete process.env.AI_ACCESS_CODE;
  globalThis.fetch=async()=>new Response(JSON.stringify({result:1}));
  await t.test('public discovery and explicit start validation without an invite secret',async()=>{
   assert.deepEqual(await(await session(req(),context)).json(),{authenticated:false,publicAccess:true});
   for(const value of ['{}','null','[]','{"start":false}','{"start":"true"}','{"start":true,"code":"x"}','{"consent":false}','{"consent":"true"}','{"code":"old-code"}','{"consent":true,"code":"x"}']){
    const r=await session(req('POST',value),context);assert.equal(r.status,400);assert.equal(r.headers.get('set-cookie'),null);
   }
   assert.equal((await session(req('POST',{consent:true},{origin:'https://attacker.example'}),context)).status,403);
  });
  let cookie;
  await t.test('visitor starts a safe session without a consent field and can use the guarded AI endpoint',async()=>{
   const r=await session(req('POST',{start:true}),context);assert.equal(r.status,200);
   assert.deepEqual(await r.json(),{authenticated:true,publicAccess:true});
   const full=r.headers.get('set-cookie');for(const flag of ['HttpOnly','Secure','SameSite=Strict','Path=/'])assert.ok(full.includes(flag));
   cookie=full.split(';')[0];assert.ok(hasSession(new Request('https://mdaar.example',{headers:{cookie}}),process.env));
   globalThis.fetch=async url=>String(url).includes('.upstash.io')?new Response('{"result":1}'):new Response(JSON.stringify({choices:[{message:{content:'{"answer":"guest response"}'}}]}));
   const make=headers=>new Request('https://mdaar.example/api/ai',{method:'POST',headers:{'content-type':'application/json',...headers},body:'{"prompt":"hello"}'});
   assert.equal((await ai(make({}),context)).status,401);
   const response=await ai(make({cookie}),context);assert.equal(response.status,200);assert.deepEqual(await response.json(),{data:{answer:'guest response'}});
  });
  await t.test('public sessions do not survive switching back to invitation access',()=>{
   const request=new Request('https://mdaar.example',{headers:{cookie}});
   assert.ok(!hasSession(request,{...env,AI_PUBLIC_ACCESS:'false'}));
   assert.ok(!hasSession(request,{...env,AI_PUBLIC_ACCESS:'TRUE'}));
  });
  await t.test('public access still fails closed for quota errors and missing signing configuration',async()=>{
   globalThis.fetch=async()=>new Response('{"result":0}');let r=await session(req('POST',{consent:true}),context);assert.equal(r.status,429);assert.equal(r.headers.get('set-cookie'),null);
   globalThis.fetch=async()=>{throw Error('offline')};r=await session(req('POST',{consent:true}),context);assert.equal(r.status,503);assert.equal(r.headers.get('set-cookie'),null);
   delete process.env.AI_SESSION_SECRET;assert.equal((await session(req('POST',{consent:true}),context)).status,503);
  });
 }finally{for(const key of keys)if(old[key]===undefined)delete process.env[key];else process.env[key]=old[key];globalThis.fetch=oldFetch;}
});
