import { readdir, readFile, stat } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import path from 'node:path';
async function files(dir) {
  const result=[];
  for(const item of await readdir(dir,{withFileTypes:true})) {
    const full=path.join(dir,item.name);
    if(item.isDirectory()) result.push(...await files(full)); else result.push(full);
  }
  return result;
}
let count=0;
for(const file of (await Promise.all(['public','netlify','cloudflare','scripts','tests'].map(files))).flat()) {
  if (/\.(?:m?js)$/.test(file)) {
    const r=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
    if(r.status) {process.stderr.write(r.stderr); process.exit(r.status || 1)}
    count++;
  }
  if (/\.(?:html|css|m?js|json|md|toml)$/.test(file)) {
    const data=await readFile(file,'utf8');
    // Report file names only; never disclose matching credential strings.
    assert(!/\bgsk_[A-Za-z0-9_-]{20,}/.test(data),`Potential Groq credential in ${file}`);
  }
}
const html=await readFile('public/index.html','utf8');
assert(!/<script\b(?![^>]*\bsrc=)[^>]*>[\s\S]*?\S[\s\S]*?<\/script>/i.test(html),'Executable inline script must be externalized');
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);
assert.equal(new Set(ids).size,ids.length,'Duplicate document IDs');
console.log(`${count} JavaScript files parse; no Groq credential pattern; HTML IDs unique.`);

for (const match of html.matchAll(/(?:href|src)="(\/[^"?#]*)/g)) {
 const url=match[1];
 if (url.startsWith('/api/')) continue;
 const target='public'+(url==='/'?'/index.html':url);
 assert((await stat(target)).isFile(),`Missing referenced asset: ${url}`);
}
console.log('All root-relative document links and assets exist.');
