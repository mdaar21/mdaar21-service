// Browser contract test: controlled service responses, never evidence of a live provider.
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});const results=[];
 const base=process.env.MDAAR_TEST_URL||'http://127.0.0.1:4185/Mdaar21/';
 const remote='https://mdaar21-service.test.workers.dev';
 assert(['127.0.0.1','localhost'].includes(new URL(base).hostname),'Use a local Pages preview; this test mocks the service');
 async function run(name,fn){const context=await browser.newContext({viewport:{width:390,height:844},locale:'ar-SA',serviceWorkers:'block'});const page=await context.newPage();const errors=[],failures=[];page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>{if(!r.failure()?.errorText.includes('ERR_ABORTED'))failures.push(r.failure()?.errorText)});await context.addInitScript(()=>localStorage.setItem('mdaar_consent','false'));
  try{await fn(page);assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);results.push({name,status:'passed'});}finally{await context.close();}}
 const fulfill=(route,data,status=200)=>route.fulfill({status,contentType:'application/json',headers:{'Access-Control-Allow-Origin':new URL(base).origin,'Access-Control-Allow-Headers':'content-type,authorization','Access-Control-Allow-Methods':'GET,POST,OPTIONS'},body:JSON.stringify(data)});
 async function open(page){await page.goto(base,{waitUntil:'networkidle'});await page.waitForFunction(()=>!!window.MdaarNutrition);assert.equal(await page.evaluate(()=>window.Mdaar.serviceAvailable),true);assert.equal(await page.locator('#ai-consent,#assistant-settings').count(),0);assert.equal(await page.locator('#dpb').count(),0);}
 async function ask(page,text){await page.locator('#assistant-open').click();await page.locator('#assistant-prompt').fill(text);await page.locator('#assistant-send').click();}
 await run('first Send calls configured worker only, no consent gate, token memory and escaped answer',async page=>{
  const calls=[];let ownRequests=0;page.on('request',r=>{if(r.url().startsWith(new URL(base).origin+'/api/'))ownRequests++;});
  await page.route(remote+'/**',async route=>{const r=route.request();if(r.method()==='OPTIONS')return fulfill(route,{});calls.push({path:new URL(r.url()).pathname,body:r.postDataJSON(),authorization:r.headers().authorization});return fulfill(route,r.url().endsWith('/api/session')?{authenticated:true,token:'fixture.signature',expiresIn:900}:{data:{answer:'<img src=x onerror=alert(1)> إجابة مدار',suggestions:['اختبار']}});});
  await open(page);assert.equal(calls.length,0);await ask(page,'اشرح الحاسبة');await page.waitForFunction(()=>document.querySelector('#assistant-answer').textContent.includes('إجابة مدار'));assert.equal(calls.length,2);assert.deepEqual(calls[0].body,{start:true});assert.equal(calls[1].authorization,'Bearer fixture.signature');assert.equal(await page.locator('#assistant-answer img').count(),0);assert.equal(ownRequests,0);assert(!await page.evaluate(()=>JSON.stringify({...localStorage}).includes('fixture.signature')));
  await page.locator('#assistant-prompt').fill('سؤال ثان');await page.locator('#assistant-send').click();await page.waitForFunction(()=>!document.querySelector('#assistant-send').disabled);assert.equal(calls.length,3);
 });
 await run('closing during automatic session setup prevents a late completion',async page=>{
  let release,started;const gate=new Promise(r=>release=r),begun=new Promise(r=>started=r);let completions=0;
  await page.route(remote+'/**',async route=>{if(route.request().method()==='OPTIONS')return fulfill(route,{});if(route.request().url().endsWith('/api/session')){started();await gate;try{return await fulfill(route,{authenticated:true,token:'fixture.signature',expiresIn:900})}catch{return;}}completions++;return fulfill(route,{data:{answer:'LATE_PRIVATE_SENTINEL',suggestions:[]}});});
  await open(page);await ask(page,'سؤال');await begun;await page.locator('#assistant-close').click();release();await page.waitForTimeout(200);assert.equal(completions,0);assert.equal(await page.locator('#assistant-answer').textContent(),'');
 });
 await run('one unauthorized token refresh recovers automatically without invitation',async page=>{
  let sessions=0,completions=0;
  await page.route(remote+'/**',async route=>{if(route.request().method()==='OPTIONS')return fulfill(route,{});if(route.request().url().endsWith('/api/session')){sessions++;return fulfill(route,{authenticated:true,token:'fixture.signature'+sessions,expiresIn:900});}completions++;return fulfill(route,completions===1?{error:'auth_required'}:{data:{answer:'تم التجديد',suggestions:[]}},completions===1?401:200);});
  await open(page);await ask(page,'سؤال');await page.waitForFunction(()=>document.querySelector('#assistant-answer').textContent.includes('تم التجديد'));assert.equal(sessions,2);assert.equal(completions,2);
 });
 await run('provider failure ends one request and re-enables the interface',async page=>{
  let completions=0;await page.route(remote+'/**',async route=>{if(route.request().method()==='OPTIONS')return fulfill(route,{});if(route.request().url().endsWith('/api/session'))return fulfill(route,{authenticated:true,token:'fixture.signature',expiresIn:900});completions++;return fulfill(route,{error:'ai_unavailable'},502);});
  await open(page);await ask(page,'سؤال');await page.waitForFunction(()=>document.querySelector('#assistant-answer').textContent.includes('تعذر'));assert.equal(completions,1);assert.equal(await page.locator('#assistant-send').isDisabled(),false);
 });
 await browser.close();await fs.writeFile(process.env.MDAAR_TEST_REPORT||'/tmp/mdaar-worker-browser.json',JSON.stringify({scope:'Project-prefixed Pages build and real CSP/browser behavior with controlled cross-origin service fixtures, no live provider',results},null,2));console.log(JSON.stringify(results));
})().catch(e=>{console.error(e);process.exitCode=1});
