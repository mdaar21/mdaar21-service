import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.js')); }
const base = process.env.MDAAR_TEST_URL || 'http://127.0.0.1:4173';
const out = process.env.MDAAR_TEST_ARTIFACTS || '/workspace/mdaar-local/browser';
const requested = new Set((process.env.MDAAR_TEST_GROUPS || 'layout,home,legacy,privacy,security,nutrition,training,pwa,assistant').split(','));
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
const results = [];
const sections = ['home','calc','diary','rec','meals','weight','training','progress','settings'];
const securityConfig = await readFile(new URL('../netlify.toml',import.meta.url),'utf8');
const policy = securityConfig.match(/Content-Security-Policy\s*=\s*"([^"]+)"/)?.[1];
assert(policy, 'Netlify CSP must be present');
async function check(group, name, fn) {
  if (!requested.has(group)) return;
  try { await fn(); results.push({group,name,status:'passed'}); console.log(`PASS ${name}`); }
  catch(error) { results.push({group,name,status:'failed',error:error.message}); console.error(`FAIL ${name}: ${error.message}`); }
}
async function newPage(viewport={width:1440,height:1000}, seed={}, options={}) {
  const context=await browser.newContext({viewport,locale:'ar-SA',reducedMotion:'reduce',acceptDownloads:true});
  await context.addInitScript(seed=>{ for(const [key,value] of Object.entries(seed)) localStorage.setItem(key,JSON.stringify(value)); },seed);
  const page=await context.newPage(); page.setDefaultTimeout(6000); page.errors=[]; page.aiRequests=0;
  page.on('pageerror', error=>page.errors.push(error.message));
  await page.route('https://**/*', route=>route.abort());
  await page.route('**/api/session', async route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true})}));
  await page.route('**/api/ai', async route=>{
    page.aiRequests++;
    const payload=JSON.parse(route.request().postData()||'{}');page.lastAiBody=payload;
    let data={name:'وجبة اختبار',note:'تقدير غير مؤكد',components:[{n:'أرز',a:100,u:'جم',k:130,p:2.7,c:28,f:0.3}]};
    if(payload.prompt?.includes('ingredients')) data={name:'وصفة تجريبية',ingredients:['100 جم أرز'],steps:['اطبخ المكونات'],allergens:[]};
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data})});
  });
  if(options.csp) await page.route(base+'/', async route=>{const response=await route.fetch();await route.fulfill({response,headers:{...response.headers(),'content-security-policy':policy}});});
  await page.goto(base, {waitUntil:'networkidle'});
  await page.waitForFunction(()=>!!window.Mdaar);
  return page;
}
async function tab(page,name) {
  await page.locator(`#tabs button[data-t="${name}"]`).click();
  assert.equal(await page.locator(`#t-${name}`).getAttribute('hidden'),null,`${name} section selected`);
}
async function calculate(page) {
  await tab(page,'calc');
  await page.locator('#age').fill('٢٥'); await page.locator('#w').fill('٧٥'); await page.locator('#h').fill('١٧٥');
  await page.locator('#act').selectOption('1.55');
  await page.locator('#f button[type="submit"]').click();
  const target=await page.evaluate(()=>window.Mdaar.getTarget());
  assert(target);assert(Math.abs(target.kcal-2671.8125)<0.01,'Mifflin result');
  assert(Math.abs(target.p*4+target.c*4+target.f*9-target.kcal)<0.001,'macro energy total');
  assert(await page.locator('#out').isVisible());
  return target;
}
try {
  for(const [device,viewport] of [['compact',{width:320,height:740}],['mobile',{width:390,height:844}],['tablet',{width:768,height:1024}],['desktop',{width:1440,height:1000}]]) {
    await check('layout',`${device}: 9 tabs, RTL/LTR, responsive width, reduced motion`,async()=>{
      const page=await newPage(viewport);assert.equal(await page.locator('#tabs button').count(),9);
      assert.equal(await page.locator('html').getAttribute('dir'),'rtl');
      assert(await page.locator('#t-home').isVisible(),'home is the initial screen');
      assert(await page.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches));
      await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('href')),'#main-content');
      for(const section of sections) {
        await tab(page,section);
        const sizes=await page.evaluate(()=>({viewport:innerWidth,scroll:document.documentElement.scrollWidth}));
        assert(sizes.scroll<=sizes.viewport+1,`${section} overflow ${sizes.scroll}/${sizes.viewport}`);
        await page.screenshot({path:`${out}/${device}-${section}.png`});
      }
      await tab(page,'calc');await page.screenshot({path:`${out}/${device}-calculator.png`,fullPage:true});
      await page.locator('#language-toggle').click();assert.equal(await page.locator('html').getAttribute('dir'),'ltr');
      for(const section of sections) {
        await tab(page,section);const sizes=await page.evaluate(()=>({viewport:innerWidth,scroll:document.documentElement.scrollWidth}));
        assert(sizes.scroll<=sizes.viewport+1,`English ${section} overflow ${sizes.scroll}/${sizes.viewport}`);
      }
      assert.deepEqual(page.errors,[]);await page.context().close();
    });
  }
  await check('home','overview: real empty state, working tool links and programme covers',async()=>{
    const page=await newPage();await page.waitForSelector('#home-target');
    assert(await page.locator('#t-home').isVisible());assert((await page.locator('#t-home h1').textContent()).trim());
    assert.equal((await page.locator('#home-target').textContent()).trim(),'—','new visitors do not get a fabricated calorie target');
    assert.equal((await page.locator('#home-calories').textContent()).trim(),'0');
    assert.equal(await page.locator('#home-food-state').getAttribute('data-value'),'0');
    assert.equal(await page.locator('#home-training-count').getAttribute('data-value'),'0');
    await page.locator('#t-home [data-ex-jump="calc"]').first().click();assert(await page.locator('#f').isVisible());
    for(const programme of ['4','5']){
      await tab(page,'home');await page.locator(`#t-home [data-ex-program="${programme}"]`).click();
      await page.waitForSelector('#training-program');assert.equal(await page.locator('#training-program').inputValue(),programme);
    }
    await tab(page,'home');await page.locator('#t-home [data-ex-jump="diary"]').first().click();assert(await page.locator('#q').isVisible());
    assert.deepEqual(page.errors,[]);await page.context().close();
  });
  await check('home','overview totals follow actual calculator and diary data without duplicate additions',async()=>{
    const page=await newPage();const target=await calculate(page);await tab(page,'home');
    assert.equal((await page.locator('#home-target').textContent()).replace(/,/g,'').trim(),String(Math.round(target.kcal)));
    for(let i=0;i<3;i++){await tab(page,'diary');await tab(page,'home');}
    await page.locator('#t-home [data-ex-jump="diary"]').first().click();await page.locator('details.manual-entry > summary').click();
    for(const [id,value] of Object.entries({'manual-name':'HOME_ACTUAL_ENTRY','manual-grams':'150','manual-k':'100','manual-p':'10','manual-c':'10','manual-f':'2'}))await page.locator('#'+id).fill(value);
    await page.locator('#manual-food button[type="submit"]').click();
    assert.equal(await page.evaluate(()=>Object.values(window.Mdaar.getDiary()).flat().length),1,'one click adds exactly one actual record');
    await tab(page,'home');assert.equal((await page.locator('#home-calories').textContent()).trim(),'150');
    assert.equal(await page.locator('#home-food-state').getAttribute('data-value'),'1');
    for(const [id,amount] of [['home-protein','15'],['home-carbs','15'],['home-fat','3']])assert((await page.locator('#'+id).textContent()).trim().startsWith(amount));
    await page.reload();await page.waitForFunction(()=>!!window.Mdaar);assert.equal((await page.locator('#home-calories').textContent()).trim(),'150');
    assert.equal((await page.locator('#home-target').textContent()).replace(/,/g,'').trim(),String(Math.round(target.kcal)));
    assert.deepEqual(page.errors,[]);await page.context().close();
  });
  await check('home','overview training count is actual and confirmed deletion resets every summary',async()=>{
    const page=await newPage(undefined,{mdaar_training_v1:{logs:[{exercise:'unknown-source-exercise',date:'not-a-date',weight:20,reps:10}]}});
    assert.equal(await page.locator('#home-training-count').getAttribute('data-value'),'0','invalid stored rows are not reported as actual training');
    await tab(page,'training');await page.waitForSelector('#training-program');await page.locator('#training-program').selectOption('4');await page.locator('[data-training-day="0"]').click();
    await page.locator('[data-exercise-card="chest-press"] > details > summary').click();const set=page.locator('form[data-training-set="chest-press"][data-index="0"]');
    for(const [name,value] of Object.entries({weight:'20',reps:'10',rir:'2'}))await set.locator(`[name="${name}"]`).fill(value);
    await set.locator('button[type="submit"]').click();
    const count=await page.evaluate(()=>JSON.parse(localStorage.getItem('mdaar_training_v1')).logs.length);assert.equal(count,1);
    await tab(page,'home');assert.equal(await page.locator('#home-training-count').getAttribute('data-value'),String(count));
    await tab(page,'settings');page.once('dialog',d=>d.accept());await page.locator('#delete-data').click();await tab(page,'home');
    assert.equal(await page.locator('#home-training-count').getAttribute('data-value'),'0');assert.equal(await page.locator('#home-food-state').getAttribute('data-value'),'0');
    assert.equal((await page.locator('#home-target').textContent()).trim(),'—');assert.equal((await page.locator('#home-calories').textContent()).trim(),'0');
    assert.deepEqual(page.errors,[]);await page.context().close();
  });
  await check('security','Netlify CSP allows real module workflows and blocks inline scripts',async()=>{
    assert(policy.includes("script-src 'self'"));assert(!/script-src[^;]*(?:unsafe-inline|unsafe-eval)/.test(policy));
    const page=await newPage(undefined,{}, {csp:true});
    await page.waitForFunction(()=>!!window.MdaarNutrition&&document.querySelector('#t-training')?.dataset.trainingReady==='true');
    await calculate(page);await tab(page,'training');assert(await page.locator('#training-program').isVisible());
    await page.addScriptTag({content:'window.__inlineCspExecuted=true'}).catch(()=>{});
    assert.equal(await page.evaluate(()=>window.__inlineCspExecuted),undefined,'inline code is refused under configured Netlify header');
    await page.locator('#assistant-open').click();assert(await page.locator('#mdaar-assistant').isVisible());
    assert.deepEqual(page.errors,[]);await page.context().close();
  });
  await check('legacy','calculator: Arabic digits, expected equation, invalid ages/negative inputs',async()=>{
    const page=await newPage();await calculate(page);
    for(const [selector,value] of [['#age','17'],['#age','NaN'],['#w','-75'],['#w','Infinity'],['#h','0']]) {
      await page.locator('#age').fill('25');await page.locator('#w').fill('75');await page.locator('#h').fill('175');
      await page.locator(selector).fill(value);await page.locator('#f button[type="submit"]').click();
      assert((await page.locator('#err').textContent()).trim(),`input ${value} rejected`);
    }
    assert.deepEqual(page.errors,[]);await page.context().close();
  });
  await check('legacy','diary: original search/add, half portion, favorite, manual grams and persistence',async()=>{
    const page=await newPage();await calculate(page);await tab(page,'diary');
    await page.locator('#q').fill('بيض مسلوق');await page.locator('#qty').fill('0.5');
    await page.locator('#fres [data-a="بيض مسلوق"]').click();
    let entries=await page.evaluate(()=>Object.values(window.Mdaar.getDiary()).flat());
    assert.equal(entries.length,1);assert.equal(entries[0].q,0.5,'fractional portions preserved');
    await page.locator('#dl [data-fv]').first().click();
    await page.locator('#chips [data-c="المفضلة"]').click();assert.equal(await page.locator('#fres [data-af]').count(),1);
    await page.locator('details.manual-entry > summary').click();
    for(const [id,value] of Object.entries({'manual-name':'طعام يدوي','manual-grams':'150','manual-k':'100','manual-p':'10','manual-c':'10','manual-f':'2'})) await page.locator('#'+id).fill(value);
    await page.locator('#manual-food button[type="submit"]').click();
    entries=await page.evaluate(()=>Object.values(window.Mdaar.getDiary()).flat());
    assert.equal(entries.length,2);assert.equal(entries[1].k,150);assert.equal(entries[1].p,15);
    await page.reload();await page.waitForFunction(()=>!!window.Mdaar);await tab(page,'diary');
    assert((await page.locator('#dl').textContent()).includes('طعام يدوي'));assert.deepEqual(page.errors,[]);await page.context().close();
  });
  await check('legacy','one 500-recipe library: categories, search and diary recipes share current data',async()=>{
    const page=await newPage();await page.waitForFunction(()=>!!window.MdaarNutrition);await tab(page,'rec');
    assert.equal(await page.locator('.legacy-recipes,#recs,#rcnt').count(),0);assert.equal((await page.locator('#nr-count').textContent()).trim(),'500 / 500');
    await page.locator('#nr-category').selectOption('فطور');assert.equal((await page.locator('#nr-count').textContent()).trim(),'100 / 500');
    await page.locator('#nr-query').fill('شوفان التفاح والزبادي');const card=page.locator('[data-recipe-id="cut-01"]');assert.equal(await card.count(),1);
    await card.locator('[data-nr-scale]').fill('2');await card.locator('[data-nr-add]').click();
    let diary=await page.evaluate(()=>Object.values(window.Mdaar.getDiary()).flat());assert.equal(diary.length,1);assert(Math.abs(diary[0].k-618.5)<0.01);
    await tab(page,'diary');await page.locator('#chips [data-c="وصفات"]').click();await page.locator('#q').fill('توست خفيف مع');
    assert(await page.locator('#fres [data-nutrition-recipe]').count()>0);const id=await page.locator('#fres [data-nutrition-recipe]').first().getAttribute('data-nutrition-recipe');
    await page.locator('#qty').fill('0.5');await page.locator('#fres [data-nutrition-recipe]').first().click();
    const expected=await page.evaluate(id=>window.MdaarNutrition.recipes.find(r=>r.id===id).nutrition.kcal/2,id);diary=await page.evaluate(()=>Object.values(window.Mdaar.getDiary()).flat());assert.equal(diary.length,2);assert(Math.abs(diary[1].k-expected)<0.01);
    await page.locator('#fres [data-open-recipes]').click();assert(await page.locator('#t-rec').isVisible());assert.deepEqual(page.errors,[]);await page.context().close();
  });
  await check('legacy','weight: record two values, trend chart and delete row',async()=>{
    const page=await newPage(undefined,{mdaar_w:[{d:'2026-10-18',w:75}]});await tab(page,'weight');
    await page.locator('#wv').fill('٧٤٫٥');await page.locator('#wadd').click();
    assert.equal(await page.locator('#wl [data-w]').count(),2);assert.equal(await page.locator('#wch polyline').count(),1);
    assert((await page.locator('#wsum').textContent()).includes('كجم'));await page.locator('#wl [data-w]').first().click();assert.equal(await page.locator('#wl [data-w]').count(),1);
    assert.deepEqual(page.errors,[]);await page.context().close();
  });
  await check('legacy','suggested meals: calculator-based render, replacement and diary add',async()=>{
    const page=await newPage();await page.waitForFunction(()=>!!window.MdaarNutrition);await tab(page,'meals');
    assert.equal(await page.locator('#dpb,#dpi,#dpo,#dp-target-note').count(),0);
    await page.locator('[data-suggested-calc]').click();assert(await page.locator('#t-calc').isVisible());
    assert.equal(await page.evaluate(()=>document.activeElement.id),'age');
    await calculate(page);await tab(page,'meals');
    await page.waitForFunction(()=>!!window.MdaarNutrition?.suggestedPlan);
    assert.equal(await page.locator('#mealbox [data-ad]').count(),4);
    const seen=new Set([await page.locator('[data-suggested-meal="0"]').getAttribute('data-recipe-id')]);
    for(let i=0;i<20;i++){
      await page.locator('#mealbox [data-ch="فطور"]').click();
      const id=await page.locator('[data-suggested-meal="0"]').getAttribute('data-recipe-id');assert(!seen.has(id));seen.add(id);
    }
    const selected=await page.evaluate(()=>window.MdaarNutrition.suggestedPlan.days[0].meals[0]);
    await page.locator('#mealbox [data-ad="فطور"]').click();assert(await page.evaluate(()=>Object.values(window.Mdaar.getDiary()).flat().length)>0);
    const entry=await page.evaluate(()=>Object.values(window.Mdaar.getDiary()).flat().at(-1));assert(Math.abs(entry.k-selected.nutrition.kcal)<1e-8);
    await tab(page,'diary');await tab(page,'meals');assert.equal(await page.locator('[data-suggested-meal="0"]').getAttribute('data-recipe-id'),selected.recipeId);
    assert.deepEqual(page.errors,[]);await page.context().close();
  });
  await check('legacy','recipe and weekly report render mocked structured responses',async()=>{
    const date=new Date().toLocaleDateString('en-CA');
    const page=await newPage(undefined,{mdaar_consent:true,mdaar_d:{[date]:[{n:'اختبار',u:'جم',m:'فطور',q:100,k:1600,p:100,c:200,f:40,b:[16,1,2,.4]}]}});await calculate(page);
    await page.route('**/api/ai',async route=>{const payload=JSON.parse(route.request().postData()||'{}');let data;
      if(payload.prompt.includes('ingredients')) data={name:'وصفة طبخ تجريبية',ingredients:['100 جم أرز'],steps:['اطبخ المكونات'],allergens:[]};
      else data={summary:'ملخص تجريبي',good:['استمرار التسجيل'],improve:['مراجعة الحصص'],tips:['استشر مختصاً عند الحاجة']};
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data})});
    });
    await tab(page,'rec');await page.locator('#airq').fill('طبق اختبار');await page.locator('#airb').click();await page.waitForFunction(()=>document.querySelector('#airec').textContent.includes('وصفة طبخ تجريبية'));
    await tab(page,'weight');await page.locator('#wrb').click();await page.waitForFunction(()=>document.querySelector('#wrp').textContent.includes('ملخص تجريبي'));
    assert.deepEqual(page.errors,[]);await page.context().close();
  });
  await check('privacy','food entry keeps text search and has no camera or image-upload controls',async()=>{
    const page=await newPage();await tab(page,'diary');
    assert.equal(await page.locator('input[type="file"],.photo-control').count(),0);
    await page.locator('#q').fill('طعام');assert.equal(await page.locator('#aib').isVisible(),true);
    assert.deepEqual(page.errors,[]);await page.context().close();
  });
  await check('privacy','sending directly starts an estimate without consent or automatically sending records',async()=>{
    const page=await newPage(undefined,{mdaar_consent:false});assert.equal(page.aiRequests,0);
    assert.equal(await page.locator('#ai-consent,#assistant-settings').count(),0);
    await tab(page,'diary');await page.locator('#q').fill('وجبة اختبار');await page.locator('#aib').click();
    await page.waitForSelector('#ca0');assert.equal(page.aiRequests,1);await page.locator('#ca0').fill('200');await page.locator('#aadd').click();
    const entries=await page.evaluate(()=>Object.values(window.Mdaar.getDiary()).flat());assert.equal(entries[0].k,260);
    assert.deepEqual(page.errors,[]);await page.context().close();
  });
  await check('privacy','settings: export JSON; cancel delete preserves records; language RTL/LTR',async()=>{
    const page=await newPage(undefined,{mdaar_w:[{d:'2026-10-18',w:75}]});await tab(page,'settings');
    const downloadEvent=page.waitForEvent('download');await page.locator('#export-data').click();const download=await downloadEvent;assert(download.suggestedFilename().endsWith('.json'));
    page.once('dialog',dialog=>dialog.dismiss());await page.locator('#delete-data').click();assert.equal((await page.evaluate(()=>window.Mdaar.getWeights())).length,1);
    await page.locator('#language-toggle').click();assert.equal(await page.locator('html').getAttribute('dir'),'ltr');assert.equal(await page.locator('html').getAttribute('lang'),'en');
    await page.locator('#language-toggle').click();assert.equal(await page.locator('html').getAttribute('dir'),'rtl');
    assert.deepEqual(page.errors,[]);await page.context().close();
  });
  await check('security','stored diary HTML is displayed as text; malformed state cannot execute',async()=>{
    const date=new Date().toLocaleDateString('en-CA');
    const payload='<img src=x onerror="window.__xss=true">';
    const page=await newPage(undefined,{mdaar_d:{[date]:[{n:payload,u:'جم',m:'فطور',q:100,k:100,p:10,c:10,f:2,b:[1,.1,.1,.02]}]},mdaar_w:[{d:'<img src=x onerror="window.__xss=true">',w:70}]});
    await tab(page,'diary');assert((await page.locator('#dl').textContent()).includes(payload));assert.equal(await page.locator('#dl img').count(),0);assert.equal(await page.evaluate(()=>window.__xss),undefined);
    await tab(page,'weight');assert.equal(await page.locator('#wl img').count(),0);assert.deepEqual(page.errors,[]);await page.context().close();
  });
  await check('privacy','settings: confirmed deletion removes only Mdaar records',async()=>{
    const page=await newPage(undefined,{mdaar_w:[{d:'2026-10-18',w:75}],unrelated_app:{keep:true}});await tab(page,'settings');
    page.once('dialog',dialog=>dialog.accept());await page.locator('#delete-data').click();
    assert.deepEqual(await page.evaluate(()=>window.Mdaar.getWeights()),[]);
    assert.equal(await page.evaluate(()=>localStorage.getItem('mdaar_w')),null);
    assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('unrelated_app'))),{keep:true});
    assert.equal(await page.locator('#ai-consent').count(),0);assert.deepEqual(page.errors,[]);await page.context().close();
  });
  await check('security','public AI starts automatically on the first Send without consent or an access code',async()=>{
    const page=await newPage();let starts=0,requests=0,authorized=false;
    await page.route('**/api/session',async route=>{
      if(route.request().method()==='POST'){assert.deepEqual(route.request().postDataJSON(),{start:true});starts++;authorized=true;}
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({authenticated:authorized,publicAccess:true})});
    });
    await page.route('**/api/ai',async route=>{requests++;await route.fulfill({status:authorized?200:401,contentType:'application/json',body:JSON.stringify(authorized?{data:{answer:'إجابة عامة دون رمز دعوة',suggestions:[]}}:{error:'auth_required'})});});
    await page.reload({waitUntil:'networkidle'});await tab(page,'settings');
    assert.equal(await page.locator('#ai-invite-controls').isVisible(),false);assert.equal(await page.locator('#ai-public-access').isVisible(),true);
    await page.locator('#assistant-open').click();await page.locator('#assistant-prompt').fill('اشرح الحاسبة');await page.locator('#assistant-send').click();
    await page.waitForFunction(()=>document.querySelector('#assistant-answer').textContent.includes('دون رمز'));
    assert.equal(starts,1);assert.equal(requests,2);assert.deepEqual(page.errors,[]);await page.context().close();
  });
  await check('security','closing the assistant cancels automatic public-session setup without retrying AI',async()=>{
    const page=await newPage(undefined,{mdaar_consent:true});let requests=0,release,started;
    const gate=new Promise(resolve=>release=resolve),intercepted=new Promise(resolve=>started=resolve);
    await page.route('**/api/ai',async route=>{requests++;await route.fulfill({status:401,contentType:'application/json',body:'{"error":"auth_required"}'});});
    await page.route('**/api/session',async route=>{
      if(route.request().method()==='POST'){started();await gate;}
      try{await route.fulfill({status:200,contentType:'application/json',body:'{"authenticated":true,"publicAccess":true}'});}catch{}
    });
    await page.locator('#assistant-open').click();await page.locator('#assistant-prompt').fill('سؤال خاص');await page.locator('#assistant-send').click();await intercepted;
    await page.locator('#assistant-close').click();release();await page.waitForTimeout(150);
    assert.equal(requests,1);assert.equal(await page.locator('#assistant-answer').textContent(),'');assert.deepEqual(page.errors,[]);await page.context().close();
  });
  await check('security','AI text/attributes escaped and invitation code never persisted',async()=>{
    const page=await newPage(undefined,{mdaar_consent:true});const malicious='<img src=x onerror="window.__aiXss=true">';
    await page.route('**/api/ai',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:{name:malicious,note:malicious,components:[{n:malicious,a:100,u:'جم',k:100,p:1,c:20,f:2}]}})}));
    await tab(page,'settings');await page.locator('#ai-access-code').fill('offline-invite-fixture');await page.locator('#ai-login').click();
    await page.waitForFunction(()=>document.querySelector('#ai-session-status').textContent.includes('تم تسجيل'));
    assert.equal(await page.locator('#ai-access-code').inputValue(),'');
    assert(!await page.evaluate(()=>JSON.stringify({...localStorage}).includes('offline-invite-fixture')));
    await tab(page,'diary');await page.locator('#q').fill('طعام');await page.locator('#aib').click();await page.waitForSelector('#ca0');
    assert.equal(await page.locator('#ai img').count(),0);assert.equal(await page.evaluate(()=>window.__aiXss),undefined);
    assert((await page.locator('#ai').textContent()).includes(malicious));assert.deepEqual(page.errors,[]);await page.context().close();
  });
  await check('privacy','deleting data aborts in-flight AI without late private output',async()=>{
    for(const action of ['delete']) {
      const page=await newPage(undefined,{mdaar_consent:true});await tab(page,'diary');await page.locator('#q').fill('طلب خاص');
      let release;const gate=new Promise(resolve=>release=resolve);let interceptedResolve;const intercepted=new Promise(resolve=>interceptedResolve=resolve);
      await page.route('**/api/ai',async route=>{interceptedResolve();await gate;try{await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:{name:'PRIVATE_LATE_AI_SENTINEL',note:'private delayed output',components:[{n:'PRIVATE_LATE_AI_SENTINEL',a:100,u:'جم',k:100,p:10,c:10,f:2}]}})});}catch{}});
      await page.locator('#aib').click();await intercepted;await tab(page,'settings');
      page.once('dialog',dialog=>dialog.accept());await page.locator('#delete-data').click();
      release();await page.waitForTimeout(150);await tab(page,'diary');
      assert(!(await page.locator('#ai').textContent()).includes('PRIVATE_LATE_AI_SENTINEL'));
      assert.equal(await page.locator('#aadd').count(),0);assert.equal(await page.evaluate(()=>Object.values(window.Mdaar.getDiary()).flat().length),0);
      assert.equal(await page.locator('#ai-consent').count(),0);assert.deepEqual(page.errors,[]);await page.context().close();
    }
  });
  // Modules below are deliberately required in the full run; missing implementations fail.
  await check('nutrition','Mdaar branding: no technology badges in Arabic/English panels, assistant or privacy',async()=>{
    const page=await newPage();await page.waitForFunction(()=>!!window.MdaarNutrition);
    const forbidden=/الذكاء\s+الاصطناعي|ذكاء\s+اصطناعي|\bAI\b|artificial\s+intelligence/i;
    for(const language of ['ar','en']){
      if((await page.locator('html').getAttribute('lang'))!==language)await page.locator('#language-toggle').click();
      for(const name of sections){await tab(page,name);assert(!forbidden.test(await page.locator('body').innerText()),`${language}/${name}`);}
      await page.locator('#assistant-open').click();assert(!forbidden.test(await page.locator('#mdaar-assistant').innerText()));await page.locator('#assistant-close').click();
    }
    const privacy=await page.request.get(base+'/privacy.html');assert.equal(privacy.status(),200);assert(!forbidden.test(await privacy.text()));
    assert.deepEqual(page.errors,[]);await page.context().close();
  });
  await check('nutrition','calculated recipes: 500 distinct, 250/250 goals, search, portions, favorite and diary',async()=>{
    const page=await newPage();await page.waitForFunction(()=>!!window.MdaarNutrition);await tab(page,'rec');
    const catalog=await page.evaluate(()=>window.MdaarNutrition.recipes);
    assert.equal(catalog.length,500);assert.equal(new Set(catalog.map(x=>x.id)).size,500);assert.equal(catalog.filter(x=>x.goal==='cut').length,250);assert.equal(catalog.filter(x=>x.goal==='bulk').length,250);
    assert.equal((await page.locator('#nr-count').textContent()).trim(),'500 / 500');assert.equal(await page.locator('#nr-results [data-recipe-id]').count(),8);
    await page.locator('#nr-goal').selectOption('bulk');assert.equal((await page.locator('#nr-count').textContent()).trim(),'250 / 500');
    await page.locator('#nr-goal').selectOption('all');await page.locator('#nr-query').fill(catalog[0].name);
    const card=page.locator(`#nr-results [data-recipe-id="${catalog[0].id}"]`);await card.locator('[data-nr-scale]').fill('2');await card.locator('[data-nr-favorite]').click();assert.equal(await card.locator('[data-nr-favorite]').getAttribute('aria-pressed'),'true');
    await card.locator('[data-nr-add]').click();
    const entry=await page.evaluate(()=>Object.values(window.Mdaar.getDiary()).flat()[0]);assert.equal(entry.n,catalog[0].name);assert(Math.abs(entry.k-catalog[0].nutrition.kcal*2)<0.02);
    await page.locator('#nr-query').fill('');await page.locator('#nr-favorites').check();assert.equal((await page.locator('#nr-count').textContent()).trim(),'1 / 500');
    await page.locator('#nr-favorites').uncheck();const chicken=catalog.find(x=>x.id==='cut-11');await page.locator('#nr-query').fill(chicken.name);
    const modified=page.locator('#nr-results [data-recipe-id="cut-11"]');await modified.locator('details > summary').click();
    const totalsBefore=await modified.locator('[data-nr-totals]').textContent();await modified.locator('[data-nr-substitute="0"]').selectOption('salmon');
    assert.notEqual(await modified.locator('[data-nr-totals]').textContent(),totalsBefore);assert((await modified.locator('[data-nr-allergens]').textContent()).includes('سمك'));assert((await modified.locator('[data-nr-modified]').textContent()).trim());
    assert.deepEqual(page.errors,[]);await page.context().close();
  });
  await check('nutrition','advanced recipe filters stay functional inside their compact disclosure',async()=>{
    const page=await newPage();await page.waitForFunction(()=>!!window.MdaarNutrition);await tab(page,'rec');
    const disclosure=page.locator('details.recipe-advanced-filters');assert.equal(await disclosure.getAttribute('open'),null);
    await disclosure.locator(':scope > summary').click();await page.locator('#nr-max-kcal').fill('450');await page.locator('#nr-min-protein').fill('25');
    const expected=await page.evaluate(()=>window.MdaarNutrition.recipes.filter(r=>r.nutrition.kcal<=450&&r.nutrition.p>=25).length);
    assert(expected>0&&expected<500);assert.equal((await page.locator('#nr-count').textContent()).trim(),`${expected} / 500`);
    await page.locator('#nr-max-kcal').fill('');await page.locator('#nr-min-protein').fill('');assert.equal((await page.locator('#nr-count').textContent()).trim(),'500 / 500');
    assert.deepEqual(page.errors,[]);await page.context().close();
  });
  await check('nutrition','planner: calculator targets, weekly totals, allergy/exclusion enforcement and meal swap',async()=>{
    const page=await newPage();await page.waitForFunction(()=>!!window.MdaarNutrition);await calculate(page);await tab(page,'meals');
    assert.equal(await page.locator('#np-kcal').inputValue(),'2672','calculator target copied after change event');
    await page.locator('#np-days').selectOption('7');await page.locator('[name="np-allergen"][value="milk"]').check();await page.locator('#np-exclude').fill('تونة');await page.locator('#np-generate').click();
    await page.waitForFunction(()=>window.MdaarNutrition?.currentPlan?.days?.length===7);
    const validation=await page.evaluate(()=>{const {currentPlan,recipes}=window.MdaarNutrition;const byId=Object.fromEntries(recipes.map(x=>[x.id,x]));return currentPlan.days.map(day=>({count:day.meals.length,sum:day.meals.reduce((a,x)=>a+x.nutrition.kcal,0),total:day.totals.kcal,forbidden:day.meals.some(x=>byId[x.recipeId].allergens.includes('milk')||byId[x.recipeId].name.includes('تونة'))}));});
    for(const day of validation){assert.equal(day.count,4);assert(Math.abs(day.sum-day.total)<1e-8);assert.equal(day.forbidden,false);assert(Math.abs(day.total-2672)<30);}
    const mealBefore=await page.evaluate(()=>window.MdaarNutrition.currentPlan.days[0].meals[0]);
    await page.locator('[data-np-scale="0:0"]').fill('1.25');await page.locator('[data-np-scale="0:0"]').blur();
    const resized=await page.evaluate(()=>window.MdaarNutrition.currentPlan.days[0]);assert.equal(resized.meals[0].servings,1.25);assert(Math.abs(resized.totals.kcal-resized.meals.reduce((a,x)=>a+x.nutrition.kcal,0))<1e-8);
    assert(Math.abs(resized.meals[0].nutrition.kcal-mealBefore.nutrition.kcal*1.25/mealBefore.servings)<1e-8);
    const before=await page.evaluate(()=>window.MdaarNutrition.currentPlan.days[0].meals[0].recipeId);
    const seen=new Set([before]);
    for(let i=0;i<20;i++){
      await page.locator('[data-np-swap="0:0"]').click();
      const meal=await page.evaluate(()=>{const {currentPlan,recipes}=window.MdaarNutrition,m=currentPlan.days[0].meals[0],r=recipes.find(r=>r.id===m.recipeId);return {id:m.recipeId,kcal:m.nutrition.kcal,allergens:r.allergens,ingredients:r.ingredients.map(p=>p.id)};});
      assert(!seen.has(meal.id),`planner repeat at swap ${i+1}`);seen.add(meal.id);assert(!meal.allergens.includes('milk'));assert(!meal.ingredients.includes('tuna'));assert(Math.abs(meal.kcal-resized.meals[0].nutrition.kcal)<6);
    }
    await page.locator('[data-np-add="0:0"]').click();assert.equal(await page.evaluate(()=>Object.values(window.Mdaar.getDiary()).flat().length),1);
    const suggested=await page.evaluate(()=>window.MdaarNutrition.suggestedPlan.days[0].meals);
    const eligible=await page.evaluate(meals=>meals.every(m=>{const r=window.MdaarNutrition.recipes.find(r=>r.id===m.recipeId);return !r.allergens.includes('milk')&&!r.ingredients.some(p=>p.id==='tuna');}),suggested);assert(eligible,'quick suggestions share explicit exclusions');
    await page.locator('#language-toggle').click();assert.equal(await page.locator('html').getAttribute('lang'),'en');
    assert(await page.locator('[name="np-allergen"][value="milk"]').isChecked());assert.equal(await page.locator('#np-exclude').inputValue(),'تونة');
    assert.deepEqual(await page.evaluate(()=>window.MdaarNutrition.suggestedPlan.days[0].meals),suggested,'language changes preserve quick choices and restrictions');
    await page.locator('#language-toggle').click();
    assert.deepEqual(page.errors,[]);await page.context().close();
  });
  await check('nutrition','planner rejects impossible restrictions and malformed targets',async()=>{
    const page=await newPage();await page.waitForFunction(()=>!!window.MdaarNutrition);await tab(page,'meals');
    await page.locator('#np-kcal').fill('900');await page.locator('#np-generate').click();assert((await page.locator('#np-status').textContent()).trim());assert.equal(await page.evaluate(()=>window.MdaarNutrition.currentPlan),null);
    await page.locator('#np-kcal').fill('2000');await page.locator('#np-exclude').fill('شوفان، دجاج، تونة، أرز، حمص، عدس، بطاطس، بيض، سلمون، كينوا، زبادي، جبن، حليب، زبدة، لوز، فراولة، تفاح، موز');await page.locator('#np-generate').click();assert((await page.locator('#np-status').textContent()).trim());
    assert.equal(await page.evaluate(()=>window.MdaarNutrition.currentPlan),null);assert.deepEqual(page.errors,[]);await page.context().close();
  });
  await check('assistant','assistant dialog: mobile header, keyboard Escape/focus and privacy document',async()=>{
    const page=await newPage({width:390,height:844});await page.waitForSelector('#assistant-open');
    const sizes=await page.evaluate(()=>({viewport:innerWidth,scroll:document.documentElement.scrollWidth}));assert(sizes.scroll<=sizes.viewport+1,`assistant header overflow ${sizes.scroll}/${sizes.viewport}`);
    await page.locator('#assistant-open').click();assert(await page.locator('#mdaar-assistant').isVisible());assert.equal(await page.evaluate(()=>document.activeElement?.id),'assistant-prompt');
    await page.keyboard.press('Escape');assert.equal(await page.locator('#mdaar-assistant').isVisible(),false);assert.equal(await page.evaluate(()=>document.activeElement?.id),'assistant-open');
    await tab(page,'settings');assert.equal(await page.locator('#assistant-settings,#ai-consent').count(),0);
    const response=await page.request.get(base+'/privacy.html');assert.equal(response.status(),200);assert((await response.text()).includes('Groq'));
    await page.screenshot({path:`${out}/mobile-assistant-header.png`});assert.deepEqual(page.errors,[]);await page.context().close();
  });
  await check('assistant','assistant: direct requests, escaped output, optional target only and closing resets',async()=>{
    const date=new Date().toLocaleDateString('en-CA');const sentinel='PRIVATE_ASSISTANT_DIARY_SENTINEL';
    const page=await newPage(undefined,{mdaar_d:{[date]:[{n:sentinel,u:'جم',m:'فطور',q:100,k:100,p:10,c:10,f:2,b:[1,.1,.1,.02]}]},mdaar_w:[{d:date,w:73.7}]});await calculate(page);await page.waitForSelector('#assistant-open');
    const bodies=[];const html='<img src=x onerror="window.__assistantXss=true">';
    await page.route('**/api/ai',async route=>{bodies.push(JSON.parse(route.request().postData()||'{}'));await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:{answer:html,suggestions:[html,'خطوة توضيحية']}})});});
    await page.locator('#assistant-open').click();await page.locator('#assistant-prompt').fill('اشرح الحاسبة');await page.locator('#assistant-send').click();
    await page.waitForFunction(()=>document.querySelector('#assistant-answer').textContent.includes('<img'));
    assert.equal(bodies.length,1);assert(!bodies[0].prompt.includes(sentinel));assert(!bodies[0].prompt.includes('73.7'));assert(!bodies[0].prompt.includes('"kcal":'));assert.deepEqual(Object.keys(bodies[0]),['prompt']);
    assert.equal(await page.locator('#assistant-answer img').count(),0);assert.equal(await page.evaluate(()=>window.__assistantXss),undefined);assert.equal(await page.locator('#assistant-answer li').count(),2);
    await page.locator('#assistant-target').check();await page.locator('#assistant-prompt').fill('اشرح هدفي');await page.locator('#assistant-send').click();await page.waitForFunction(()=>!document.querySelector('#assistant-send').disabled);
    assert.equal(bodies.length,2);assert(bodies[1].prompt.includes('"kcal":'));assert(!bodies[1].prompt.includes(sentinel));assert(!bodies[1].prompt.includes('73.7'));assert(!bodies[1].prompt.includes('"w":'));
    await page.locator('#assistant-close').click();await page.locator('#assistant-open').click();
    assert.equal(await page.locator('#assistant-prompt').inputValue(),'');assert.equal(await page.locator('#assistant-target').isChecked(),false);assert.equal((await page.locator('#assistant-answer').textContent()).trim(),'');
    assert.deepEqual(page.errors,[]);await page.context().close();
  });
  await check('pwa','offline reload retains calculator/diary; public cache excludes API and personal payloads',async()=>{
    const page=await newPage();await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload({waitUntil:'networkidle'});
    await page.waitForFunction(()=>!!navigator.serviceWorker.controller&&!!window.MdaarNutrition&&document.querySelector('#t-training')?.dataset.trainingReady==='true');
    await calculate(page);await tab(page,'diary');await page.locator('details.manual-entry > summary').click();
    for(const [id,value] of Object.entries({'manual-name':'PRIVATE_OFFLINE_SENTINEL_2026','manual-grams':'100','manual-k':'100','manual-p':'10','manual-c':'10','manual-f':'2'})) await page.locator('#'+id).fill(value);
    await page.locator('#manual-food button[type="submit"]').click();
    const cached=await page.evaluate(async()=>{const keys=await caches.keys();const urls=[];let leak=false;for(const key of keys){const cache=await caches.open(key);for(const request of await cache.keys()){urls.push(new URL(request.url).pathname);const response=await cache.match(request);if(/text|json|javascript/.test(response.headers.get('content-type')||''))leak||=(await response.text()).includes('PRIVATE_OFFLINE_SENTINEL_2026');}}return {urls,leak};});
    assert(cached.urls.includes('/data/recipes-calculated.json'),'recipe data cached after controlled load');assert.equal(cached.leak,false);assert(cached.urls.every(x=>!x.startsWith('/api/')));
    await page.context().setOffline(true);await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!!window.Mdaar&&!!window.MdaarNutrition);
    await tab(page,'home');assert(await page.locator('#t-home').isVisible());assert.equal((await page.locator('#home-calories').textContent()).trim(),'100');
    await page.locator('#t-home [data-ex-jump="diary"]').first().click();assert((await page.locator('#dl').textContent()).includes('PRIVATE_OFFLINE_SENTINEL_2026'));
    await calculate(page);assert.deepEqual(page.errors,[]);await page.context().close();
  });
  await check('training','workout: both programs, weekly template, set log/update, equipment and rest persistence',async()=>{
    const page=await newPage();await tab(page,'training');await page.waitForSelector('#training-program');
    assert.equal(await page.locator('[data-training-day]').count(),7);
    await page.locator('#training-program').selectOption('5');await page.locator('[data-training-day="0"]').click();
    assert((await page.locator('#t-training').textContent()).includes('Push'));
    await page.locator('#training-program').selectOption('4');await page.locator('[data-training-day="0"]').click();
    await page.locator('#training-equipment').selectOption('barbell');
    await page.locator('[data-exercise-card="chest-press"] > details > summary').click();
    const set=page.locator('form[data-training-set="chest-press"][data-index="0"]');
    for(const [name,value] of Object.entries({weight:'٢٠',reps:'١٠',rir:'٢'})) await set.locator(`[name="${name}"]`).fill(value);
    await set.locator('button[type="submit"]').click();
    let state=await page.evaluate(()=>JSON.parse(localStorage.getItem('mdaar_training_v1')));assert.equal(state.logs.length,1);assert.equal(state.logs[0].weight,20);assert.equal(state.logs[0].reps,10);
    await set.locator('[name="weight"]').fill('22.5');await set.locator('button[type="submit"]').click();
    state=await page.evaluate(()=>JSON.parse(localStorage.getItem('mdaar_training_v1')));assert.equal(state.logs.length,1);assert.equal(state.logs[0].weight,22.5);
    await page.locator('#rest-start').click();const deadline=await page.evaluate(()=>JSON.parse(localStorage.getItem('mdaar_rest_deadline')));assert(deadline>Date.now());
    await page.reload();await page.waitForFunction(()=>!!window.Mdaar);await tab(page,'training');await page.waitForSelector('#rest-output');assert.notEqual((await page.locator('#rest-output').textContent()).trim(),'00:00');
    await page.locator('#rest-stop').click();assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('mdaar_rest_deadline'))),0);
    assert.deepEqual(page.errors,[]);await page.context().close();
  });
  await check('training','storage quota failure: workout and measurement retain draft/retry; rest reports unsaved',async()=>{
    const page=await newPage();await page.waitForSelector('#training-program',{state:'attached'});await tab(page,'training');await page.locator('[data-training-day="0"]').click();
    await page.locator('[data-exercise-card="chest-press"] > details > summary').click();const set=page.locator('form[data-training-set="chest-press"][data-index="0"]');
    for(const [name,value] of Object.entries({weight:'٢٥',reps:'١٠',rir:'٢'}))await set.locator(`[name="${name}"]`).fill(value);
    await page.evaluate(()=>{window.originalSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='mdaar_training_v1')throw new DOMException('quota','QuotaExceededError');return window.originalSetItem.call(this,k,v);};});
    await set.locator('button[type="submit"]').click();assert((await set.locator('.training-set-status').textContent()).includes('لم تُحفظ'));assert.equal(await set.locator('[name="weight"]').inputValue(),'25');assert.equal(await page.evaluate(()=>localStorage.getItem('mdaar_training_v1')),null);
    await page.evaluate(()=>Storage.prototype.setItem=window.originalSetItem);await page.locator('#training-status [data-training-retry]').click();
    let stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('mdaar_training_v1')));assert.equal(stored.logs.length,1);assert.equal(stored.logs[0].weight,25);
    await tab(page,'progress');await page.locator('#measurement-form [name="waist"]').fill('٨٤');
    await page.evaluate(()=>{Storage.prototype.setItem=function(k,v){if(k==='mdaar_training_v1')throw new DOMException('quota','QuotaExceededError');return window.originalSetItem.call(this,k,v);};});
    await page.locator('#measurement-form button[type="submit"]').click();assert((await page.locator('#measurement-status').textContent()).includes('لم تُحفظ'));assert.equal(await page.locator('#measurement-form [name="waist"]').inputValue(),'84');
    stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('mdaar_training_v1')));assert.equal(stored.measurements.length,0);
    await page.evaluate(()=>Storage.prototype.setItem=window.originalSetItem);await page.locator('#measurement-status [data-training-retry]').click();assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('mdaar_training_v1')).measurements[0].waist),84);
    await tab(page,'training');await page.evaluate(()=>{Storage.prototype.setItem=function(k,v){if(k==='mdaar_rest_deadline')throw new DOMException('quota','QuotaExceededError');return window.originalSetItem.call(this,k,v);};});
    await page.locator('#rest-start').click();assert((await page.locator('#training-status').textContent()).includes('تعذر حفظ مؤقت'));assert.equal(await page.locator('#rest-output').textContent(),'00:00');assert.equal(await page.evaluate(()=>localStorage.getItem('mdaar_rest_deadline')),null);
    await page.evaluate(()=>Storage.prototype.setItem=window.originalSetItem);assert.deepEqual(page.errors,[]);await page.context().close();
  });
  await check('training','progress: logged-day averages, accessible weight chart, strength log and measurements',async()=>{
    const date=new Date().toLocaleDateString('en-CA');
    const page=await newPage(undefined,{mdaar_w:[{d:'2026-10-18',w:75},{d:'2026-10-19',w:74.5}],mdaar_d:{[date]:[{n:'اختبار',u:'جم',m:'فطور',q:100,k:1600,p:100,c:200,f:40,b:[16,1,2,.4]}]}});
    await tab(page,'progress');await page.waitForSelector('#measurement-form');
    assert((await page.locator('#t-progress').textContent()).includes('1600'));
    assert.equal(await page.locator('#t-progress svg[role="img"]').count(),1);
    assert((await page.locator('#t-progress details').first().textContent()).includes('2026-10-18'));
    await page.locator('#measurement-form [name="waist"]').fill('٨٠');await page.locator('#measurement-form button').click();
    const state=await page.evaluate(()=>JSON.parse(localStorage.getItem('mdaar_training_v1')));assert.equal(state.measurements.length,1);assert.equal(state.measurements[0].waist,80);
    assert((await page.locator('#measurement-status').textContent()).includes('حُفظ'));
    assert.deepEqual(page.errors,[]);await page.context().close();
  });
} finally { await browser.close(); }
await writeFile(`${out}/results.json`,JSON.stringify({runAt:new Date().toISOString(),base,results},null,2));
const failed=results.filter(x=>x.status==='failed');console.log(`${results.length-failed.length}/${results.length} browser checks passed`);
if(failed.length) process.exitCode=1;
