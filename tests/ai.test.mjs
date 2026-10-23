import { test } from 'node:test';
import assert from 'node:assert/strict';
import { issueSession, COOKIE_NAME } from '../netlify/functions/lib/ai-auth.mjs';
import handler from '../netlify/functions/ai.mjs';
import { checkQuota, validateOutput, validateInput, readBounded } from '../netlify/functions/lib/ai-security.mjs';

const keys = ['AI_SESSION_SECRET', 'AI_ACCESS_CODE', 'GROQ_API_KEY', 'GROQ_MODEL', 'GROQ_VISION_MODEL', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'RATE_LIMIT_SALT', 'AI_ALLOWED_ORIGINS', 'LIMIT_PER_IP', 'LIMIT_PER_DAY', 'LIMIT_PER_MINUTE'];
const original = Object.fromEntries(keys.map(k => [k, process.env[k]]));
const originalFetch = globalThis.fetch;
const fixtureEnv = { AI_SESSION_SECRET: 'offline-session-secret-32-characters-long', AI_ACCESS_CODE: 'offline-invite-code', GROQ_API_KEY: 'offline-fixture', UPSTASH_REDIS_REST_URL: 'https://fixture.upstash.io', UPSTASH_REDIS_REST_TOKEN: 'offline-fixture', RATE_LIMIT_SALT: 'offline-fixture-salt-32-characters-long' };
const response = value => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } });
const request = (body = { prompt: 'اقتراح وجبة' }, options = {}) => new Request('https://mdaar.example/api/ai', { method: 'POST', headers: { 'content-type': 'application/json', cookie: `${COOKIE_NAME}=${issueSession(fixtureEnv.AI_SESSION_SECRET)}`, ...options.headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });
const aiResponse = content => response({ choices: [{ message: { content: typeof content === 'string' ? content : JSON.stringify(content) } }] });
const configure = () => { for (const k of keys) delete process.env[k]; Object.assign(process.env, fixtureEnv); };
const useFetch = (fn = () => aiResponse({ name: 'وجبة', components: [] }), quota = 1) => {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    return String(url).includes('.upstash.io') ? response({ result: quota }) : fn(url, options);
  };
  return calls;
};
const expect = async (req, status, body) => { const r = await handler(req, { ip: '203.0.113.7' }); assert.equal(r.status, status); if (body) assert.deepEqual(await r.json(), body); return r; };

test('AI backend security and integration using isolated provider fixtures', async t => {
  try {
    await t.test('rejects unsupported methods and advertises POST', async () => {
      configure(); useFetch(); const r = await expect(new Request('https://mdaar.example/api/ai'), 405, { error: 'method_not_allowed' }); assert.equal(r.headers.get('allow'), 'POST');
    });
    await t.test('missing provider secret stays unconfigured', async () => {
      configure(); delete process.env.GROQ_API_KEY; const calls = useFetch(); await expect(request(), 503, { error: 'service_unconfigured' }); assert.equal(calls.length, 0);
    });
    await t.test('forbids cross-origin browser calls', async () => {
      configure(); const calls = useFetch(); await expect(request({}, {headers:{origin:'https://attacker.example'}}), 403, {error:'origin_not_allowed'}); assert.equal(calls.length, 0);
      await expect(request({}, {headers:{'sec-fetch-site':'cross-site'}}), 403);
    });
    await t.test('strict content type and declared size', async () => {
      configure(); useFetch(); await expect(request({}, {headers:{'content-type':'text/plain'}}), 415);
      await expect(request({}, {headers:{'content-type':'application/json-evil'}}), 415);
      await expect(request({}, {headers:{'content-length':'2100001'}}), 413);
      await expect(request({}, {headers:{'content-length':'NaN'}}), 400);
    });
    await t.test('streamed oversize is rejected before any provider call', async () => {
      configure(); const calls = useFetch(); await expect(request('x'.repeat(2100001)), 413, {error:'payload_too_large'}); assert.equal(calls.length,0);
    });
    await t.test('malformed JSON, null, arrays, unknown keys and blank prompts fail', async () => {
      configure(); const calls = useFetch(); await expect(request('{'),400,{error:'invalid_json'});
      for (const value of [null, [], {prompt:4}, {prompt:'x',providerKey:'bad'}]) await expect(request(JSON.stringify(value)),400,{error:'invalid_input'});
      for (const prompt of ['', ' ', 'x'.repeat(8001)]) await expect(request({prompt}),400,{error:'invalid_prompt'});
      assert.equal(calls.length,0);
    });
    await t.test('JPEG input requires bounded canonical base64 and magic bytes', async () => {
      configure(); const calls = useFetch();
      for (const image of ['!!!!', 'abcd', Buffer.from('this is not JPEG').toString('base64'), 'a'.repeat(2000004)]) await expect(request({prompt:'x',image}),400,{error:'invalid_image'});
      assert.equal(calls.length,0);
      // Minimal magic-byte fixture validates transport only; not presented as a real decoded image.
      await expect(request({prompt:'x',image:Buffer.from([255,216,255,255,217]).toString('base64')}),200);
      const sent = JSON.parse(calls.at(-1).options.body); assert.ok(sent.messages[1].content[1].image_url.url.startsWith('data:image/jpeg;base64,'));
    });
    await t.test('shared protection absent, unavailable or malformed fails closed', async () => {
      configure(); const calls = useFetch(); delete process.env.UPSTASH_REDIS_REST_TOKEN; await expect(request(),503,{error:'rate_limit_unavailable'}); assert.equal(calls.length,0);
      configure(); globalThis.fetch = async () => { throw new Error('offline'); }; await expect(request(),503,{error:'rate_limit_unavailable'});
      configure(); globalThis.fetch = async () => response({result:'OK'}); await expect(request(),503,{error:'rate_limit_unavailable'});
    });
    await t.test('shared quota rejection does not spend Groq calls', async () => {
      configure(); const calls = useFetch(undefined,0); const r=await expect(request(),429,{error:'limit'}); assert.equal(r.headers.get('retry-after'),'60'); assert.equal(calls.length,1);
    });
    await t.test('successful completion preserves response and protects credentials from payload', async () => {
      configure(); const calls=useFetch(() => aiResponse({summary:'تقدير عام'})); const r=await expect(request(),200,{data:{summary:'تقدير عام'}});
      assert.equal(r.headers.get('cache-control'),'no-store'); assert.equal(calls.length,2);
      assert.equal(calls[1].url,'https://api.groq.com/openai/v1/chat/completions');
      assert.equal(JSON.parse(calls[1].options.body).max_completion_tokens,3000);
    });
    await t.test('provider limit and error are sanitized', async () => {
      configure(); useFetch(() => new Response('sensitive upstream message', {status:429})); await expect(request(),429,{error:'upstream_rate_limit'});
      useFetch(() => new Response('sensitive upstream message', {status:500})); await expect(request(),502,{error:'ai_unavailable'});
    });
    await t.test('provider timeout does not leak details', async () => {
      configure(); useFetch(() => {throw new DOMException('sensitive timeout detail','TimeoutError');}); await expect(request(),502,{error:'ai_unavailable'});
    });
    await t.test('model fallback selects intended llama model using corrected regex', async () => {
      configure(); let completions=0;
      const calls=useFetch(url => {
        if (String(url).endsWith('/models')) return response({data:[{id:'llama-3x3-70b-invalid'},{id:'llama-3.3-70b-versatile'}]});
        return ++completions===1 ? new Response('',{status:404}) : aiResponse({ok:true});
      });
      process.env.GROQ_MODEL='retired-model'; await expect(request(),200,{data:{ok:true}});
      assert.equal(JSON.parse(calls.at(-1).options.body).model,'llama-3.3-70b-versatile');
    });
    await t.test('refuses corrupt, oversized and structurally unsafe model output', async () => {
      configure();
      for (const content of ['not json','null','1','{"__proto__":{"polluted":true}}',JSON.stringify({items:Array(101).fill('x')})]) {
        useFetch(() => aiResponse(content)); await expect(request(),502,{error:'invalid_ai_response'});
      }
      useFetch(() => new Response('x'.repeat(350001))); await expect(request(),502,{error:'ai_unavailable'});
    });
    await t.test('legacy single-array wrapper remains compatible', async () => {
      configure();useFetch(() => aiResponse({items:[{name:'عنصر'}]}));await expect(request(),200,{data:[{name:'عنصر'}]});
    });
    await t.test('provider JSON-format rejection retries once with the same shared deadline and no error-content echo',async()=>{
      configure();let completions=0;const failureText='PRIVATE_FAILED_GENERATION_SENTINEL';
      const calls=useFetch(()=>++completions===1?new Response(JSON.stringify({error:{code:'json_validate_failed',failed_generation:failureText}}),{status:400}):aiResponse({answer:'إجابة سليمة'}));
      await expect(request(),200,{data:{answer:'إجابة سليمة'}});assert.equal(completions,2);
      const requests=calls.filter(c=>c.url.includes('/chat/completions'));assert.equal(requests[0].options.signal,requests[1].options.signal);
      assert(!requests[1].options.body.includes(failureText));assert(JSON.parse(requests[1].options.body).messages[0].content.includes('JSON صحيحاً'));
    });
    await t.test('repeated JSON-format rejection stops after one corrective retry',async()=>{
      configure();let completions=0;useFetch(()=>{completions++;return new Response(JSON.stringify({error:{code:'json_validate_failed'}}),{status:400});});
      await expect(request(),502,{error:'invalid_ai_response'});assert.equal(completions,2);
    });
    await t.test('text requests use a bounded token allowance and retry a capacity rejection once',async()=>{
      configure();let completions=0;const calls=useFetch(()=>++completions===1?new Response('',{status:413}):aiResponse({answer:'إجابة سليمة'}));
      await expect(request(),200,{data:{answer:'إجابة سليمة'}});const requests=calls.filter(c=>c.url.includes('/chat/completions'));
      assert.deepEqual(requests.map(c=>JSON.parse(c.options.body).max_completion_tokens),[3000,1500]);assert.equal(requests[0].options.signal,requests[1].options.signal);
    });
    await t.test('a second capacity rejection is specific and never retries again',async()=>{
      configure();let completions=0;useFetch(()=>{completions++;return new Response('',{status:413});});
      const r=await expect(request(),413,{error:'generation_too_large'});assert.equal(completions,2);assert.equal(r.headers.get('X-Mdaar-Service-Status'),'413');
    });
    await t.test('reasoning-model fallback requests hidden reasoning for JSON compatibility',async()=>{
      configure();process.env.GROQ_MODEL='openai/gpt-oss-120b';const calls=useFetch(()=>aiResponse({answer:'إجابة سليمة'}));
      await expect(request(),200,{data:{answer:'إجابة سليمة'}});assert.equal(JSON.parse(calls.at(-1).options.body).reasoning_format,'hidden');assert.equal(JSON.parse(calls.at(-1).options.body).reasoning_effort,'low');
    });
    await t.test('discovered models can return validated JSON without unsupported native JSON mode',async()=>{
      configure();process.env.GROQ_MODEL='retired-model';let completions=0;
      const calls=useFetch(url=>String(url).endsWith('/models')?response({data:[{id:'openai/gpt-oss-120b'}]}):++completions===1?new Response('',{status:404}):aiResponse({answer:'إجابة سليمة'}));
      await expect(request(),200,{data:{answer:'إجابة سليمة'}});const body=JSON.parse(calls.at(-1).options.body);assert.equal(body.response_format,undefined);assert.equal(body.reasoning_format,'hidden');assert(body.messages[0].content.includes('JSON'));assert.equal(completions,2);
    });
    await t.test('plain-mode model recovery still rejects non-JSON provider output',async()=>{
      configure();process.env.GROQ_MODEL='retired-model';let completions=0;
      useFetch(url=>String(url).endsWith('/models')?response({data:[{id:'openai/gpt-oss-120b'}]}):++completions===1?new Response('',{status:404}):aiResponse('not json'));
      await expect(request(),502,{error:'invalid_ai_response'});assert.equal(completions,2);
    });
  } finally {
    globalThis.fetch=originalFetch;
    for (const key of keys) { if(original[key]===undefined) delete process.env[key]; else process.env[key]=original[key]; }
  }
});

test('distributed quota uses atomic three-window command, expiry and rotating IP pseudonyms', async () => {
  const env={...fixtureEnv};const bodies=[];
  const fetcher=async (_url,opts)=>{bodies.push(JSON.parse(opts.body));return response({result:1});};
  await checkQuota({ip:'203.0.113.7'},env,fetcher,172800001);
  await checkQuota({ip:'203.0.113.7'},env,fetcher,259200001);
  assert.equal(bodies[0][0],'EVAL');assert.equal(bodies[0][2],'3');
  assert.match(bodies[0][1],/redis.call\('INCR'/);assert.match(bodies[0][1],/EXPIREAT/);
  assert.ok(!JSON.stringify(bodies).includes('203.0.113.7'));
  assert.notEqual(bodies[0][3].split(':ip:')[1],bodies[1][3].split(':ip:')[1]);
  assert.deepEqual(bodies[0].slice(6,9),['25','400','5']);
  await assert.rejects(checkQuota({},env,fetcher));
  await assert.rejects(checkQuota({ip:'x'},{...env,UPSTASH_REDIS_REST_URL:'http://insecure.example'},fetcher));
  await assert.rejects(checkQuota({ip:'x'},{...env,LIMIT_PER_IP:'NaN'},fetcher));
});

test('bounded reader rejects invalid UTF-8 and response validators reject nonfinite/deep values',async()=>{
  const invalid=new ReadableStream({start(c){c.enqueue(new Uint8Array([255]));c.close();}});
  await assert.rejects(readBounded(invalid,100));
  let cancelled=false;
  const stalled=new ReadableStream({cancel(){cancelled=true;}});
  await assert.rejects(readBounded(stalled,100,5),{code:'request_timeout'});
  assert.ok(cancelled);
  assert.throws(()=>validateOutput({value:Infinity}));
  let deep={};for(let i=0;i<12;i++)deep={nested:deep};assert.throws(()=>validateOutput(deep));
  assert.throws(()=>validateInput({prompt:'x',image:'AAAA===='}));
});
