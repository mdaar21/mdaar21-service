import { chromium } from 'playwright';
import { createRequire } from 'node:module';
import { writeFile, mkdir } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',args:['--no-sandbox'],headless:true});
const results=[];
try {
  const page=await browser.newPage({viewport:{width:390,height:844},locale:'ar-SA',reducedMotion:'reduce'});
  await page.goto(process.env.MDAAR_TEST_URL || 'http://127.0.0.1:4173',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.Mdaar && window.MdaarNutrition && document.querySelector('#t-training select'));
  await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
  for(const tab of ['home','calc','diary','rec','meals','weight','training','progress','settings']){
    await page.locator(`#tabs button[data-t="${tab}"]`).click();
    const result=await page.evaluate(async()=>await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}}));
    results.push({tab,violations:result.violations.map(x=>({id:x.id,impact:x.impact,description:x.description,nodes:x.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})),incomplete:result.incomplete.map(x=>({id:x.id,nodes:x.nodes.length})),passes:result.passes.length});
    console.log(`${tab}: ${result.violations.length} automated accessibility violations`);
  }
  await page.locator('#assistant-open').click();
  const dialogResult=await page.evaluate(async()=>await axe.run(document.querySelector('#mdaar-assistant'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}}));
  results.push({tab:'assistant-dialog',violations:dialogResult.violations.map(x=>({id:x.id,impact:x.impact,nodes:x.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})),incomplete:dialogResult.incomplete.map(x=>({id:x.id,nodes:x.nodes.length})),passes:dialogResult.passes.length});
  console.log(`assistant-dialog: ${dialogResult.violations.length} automated accessibility violations`);
} finally {await browser.close();}
await mkdir('docs/reports',{recursive:true});
await writeFile('docs/reports/accessibility.json',JSON.stringify({tool:'axe-core',version:require('axe-core/package.json').version,scope:'Mobile Arabic, 9 tab panels and native assistant dialog; automation does not certify accessibility',results},null,2)+'\n');
if(results.some(r=>r.violations.length))process.exitCode=1;
