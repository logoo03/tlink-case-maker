import {createRequire} from 'node:module';import {mkdir,access} from 'node:fs/promises';import {resolve} from 'node:path';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_CORE||'playwright-core');
const out=resolve(process.argv[2]??'outputs'),base='http://127.0.0.1:4173';
await mkdir(out,{recursive:true});
const names=['tlink-case-3d-demo.html','tlink-instagram-3d-demo.zip'];
for(const n of names){try{await access(resolve(out,n));throw Error('기존 결과물 보호: '+n)}catch(e){if(e.code!=='ENOENT')throw e}}
const b=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined,headless:true});
try{
 const p=await b.newPage({reducedMotion:'reduce'});
 await p.route('**/api/analyze',r=>r.abort());await p.route('**/api/marketing',r=>r.abort());
 await p.goto(base+'/studio?case=case-08');
 await p.waitForFunction(()=>document.querySelectorAll('.drawn-mask').length>0);await p.click('#approve');
 await p.waitForFunction(()=>document.querySelectorAll('#cardStrip canvas').length===3);
 for(const [i,id] of ['#downloadHTML','#downloadCards'].entries()){
  const [d]=await Promise.all([p.waitForEvent('download'),p.click(id)]);await d.saveAs(resolve(out,names[i]));console.log(resolve(out,names[i]));
 }
}finally{await b.close()}
