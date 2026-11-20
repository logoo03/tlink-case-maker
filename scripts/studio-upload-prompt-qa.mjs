import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_CORE||'playwright-core');
const base=process.env.QA_URL||'http://127.0.0.1:4179';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined,headless:true});
try{
 const page=await browser.newPage({viewport:{width:1330,height:890},reducedMotion:'reduce'});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/studio');
 const next=page.waitForResponse(r=>r.url()===base+'/api/analyze',{timeout:90_000});
 await page.locator('#upload').setInputFiles('public/assets/rec-install-3.jpg');
 const response=await next,data=await response.json();
 assert.equal(response.status(),200,JSON.stringify(data));
 assert(data.points.length>0);
 await page.waitForFunction(()=>document.querySelectorAll('.candidate').length>0);
 assert.equal(await page.locator('.drawn-mask').count(),0);
 assert.equal(await page.locator('#approve').isDisabled(),true);
 assert.equal(await page.locator('#result').isVisible(),false);
 const text=await page.locator('.candidate p').first().innerText();
 assert(!(/\d+\s*(cm|mm|센티|밀리)/i.test(text)));
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({source:'manufacturer public guide-3',model:data.model,elapsed:data.elapsed,proposals:data.points.map(({label,seen})=>({label,seen})),approvedBeforeReview:0}));
}finally{await browser.close()}
