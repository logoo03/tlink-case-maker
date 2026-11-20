import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {createRequire} from 'node:module';import {execFileSync} from 'node:child_process';import {server} from '../server.mjs';
const require=createRequire(import.meta.url),pw=require(process.env.PLAYWRIGHT_CORE||'playwright-core');
const prod=process.env.QA_URL||'http://127.0.0.1:4173',blank=server({apiKey:''});await new Promise(r=>blank.listen(0,'127.0.0.1',r));
const base='http://127.0.0.1:'+blank.address().port,tmp=await fs.mkdtemp(path.join(os.tmpdir(),'tlink-v2-qa-'));
const browser=await pw.chromium.launch({executablePath:process.env.CHROME_PATH||undefined,headless:true});
const contexts=[],failures=[];let mocked;
const toVisit=(root,p)=>p.goto(root+'/studio');
function watch(p,root){p.on('pageerror',e=>failures.push(e.message));p.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith(root))failures.push('nonlocal request '+r.url())})}
async function cards(page,context,pathName){
 const [zip]=await Promise.all([page.waitForEvent('download'),page.click('#downloadCards')]);const dest=path.join(tmp,pathName);await zip.saveAs(dest);
 assert.equal(execFileSync('unzip',['-Z1',dest]).toString().trim().split('\n').length,3);execFileSync('unzip',['-t',dest]);
 const paths=execFileSync('unzip',['-Z1',dest]).toString().trim().split('\n');for(const name of paths){const card=execFileSync('unzip',['-p',dest,name],{maxBuffer:8_000_000});assert.deepEqual([card.readUInt32BE(16),card.readUInt32BE(20)],[1080,1350]);}return dest;
}
async function save(page,pathName){
 const [dl]=await Promise.all([page.waitForEvent('download'),page.click('#downloadHTML')]);const target=path.join(tmp,pathName);await dl.saveAs(target);return {target,html:await fs.readFile(target,'utf8')};
}
async function mark(page,points){
 const image=page.locator('#maskOverlay');await image.scrollIntoViewIfNeeded();const box=await image.boundingBox();
 for(const [x,y] of points)await page.mouse.click(box.x+box.width*x/100,box.y+box.height*y/100);
}
try{
 const ctx=await browser.newContext({viewport:{width:1400,height:950},reducedMotion:'reduce'});contexts.push(ctx);
 const p=await ctx.newPage();watch(p,base);await toVisit(base,p);
 assert.equal(await p.locator('main > section.stage').count(),2);
 assert.equal(await p.locator('#analyze,#photoConsent,.analysis').count(),0);assert.doesNotMatch(await p.locator('body').innerText(),/내부 작업용|자동 게시 없음|공개 권한을 확인하세요|Ollama/);
 await p.locator('#upload').setInputFiles('public/assets/case-02-incheon-gas.jpg');
 await p.waitForFunction(()=>!document.querySelector('#photoBoard').hidden);
 await p.click('#draw');await mark(p,[[20,27],[66,27],[69,47],[19,46]]);await p.click('#finish');
 assert.equal(await p.locator('#maskOverlay .drawn-mask').count(),1);
 await p.click('#approve');assert.match(await p.locator('#notice').innerText(),/모두 입력/);
 await p.fill('#label','랙에 설치한 장비');await p.fill('#explanation','현장에서 확인한 랙 안쪽의 장비 배치입니다.');
 const first=p.locator('#maskOverlay .handle').first();let pts=await p.locator('.drawn-mask').first().getAttribute('points');
 await first.focus();await p.keyboard.press('Shift+ArrowRight');assert.notEqual(await p.locator('.drawn-mask').first().getAttribute('points'),pts);
 await p.click('#undo');assert.equal(await p.locator('.drawn-mask').first().getAttribute('points'),pts);
 await p.click('#approve');await p.waitForFunction(()=>document.querySelectorAll('#cardStrip canvas').length===3);
 assert.match(await p.locator('#lead').innerText(),/랙 안쪽/);
 const {html}=await save(p,'manual-case.html');assert.match(html,/<polygon/);assert.match(html,/랙에 설치한 장비/);assert.doesNotMatch(html,/OpenAI|후보|수동 윤곽/);
 await cards(p,ctx,'manual-cards.zip');
 await p.click('#editAgain');assert(!await p.locator('#result').isVisible());
 await p.selectOption('#sample','featured-eunpyeong');
 await p.waitForFunction(()=>document.querySelectorAll('#maskOverlay .drawn-mask').length===2);
 await p.screenshot({path:path.join(tmp,'studio.png'),fullPage:true});
 await p.setViewportSize({width:390,height:844});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await p.setViewportSize({width:320,height:720});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 const cloudCalls=[];
 const fake=async(_url, opts)=>{
  const body=JSON.parse(opts.body);cloudCalls.push(body);
  const value=body.text.format.name==='tlink_photo_observation'?{kind:'rack',points:[{label:'초기 AI 제안',seen:'장비 앞면을 볼 수 있습니다.',polygon:[[20,24],[75,24],[75,46],[20,46]]},{label:'반영하지 않는 후보',seen:'검토 전 문장입니다.',polygon:[[15,60],[65,60],[65,86],[15,86]]}]}:{headline:'공간에 맞춘 녹취 설치',lead:'장비가 놓인 위치를 사진에서 확인해 보세요.'};
  return Response.json({status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify(value)}]}]});
 };
 mocked=server({apiKey:'stub-test-key',transport:fake});await new Promise(r=>mocked.listen(0,'127.0.0.1',r));
 const mBase='http://127.0.0.1:'+mocked.address().port,mCtx=await browser.newContext({viewport:{width:1360,height:900},reducedMotion:'reduce'});contexts.push(mCtx);
 const q=await mCtx.newPage();watch(q,mBase);await toVisit(mBase,q);
 await q.locator('#upload').setInputFiles('public/assets/case-02-incheon-gas.jpg');
 await q.waitForFunction(()=>document.querySelectorAll('.candidate').length===2);assert.equal(cloudCalls.length,1);assert.equal(await q.locator('#analyze,#photoConsent').count(),0);
 await q.locator('.candidate button').first().focus();assert.equal(await q.locator('.candidate-ghost').count(),1);
 assert.equal(await q.locator('.drawn-mask').count(),0);assert(!await q.locator('#result').isVisible());
 await q.locator('.candidate button').first().click();assert.equal(await q.locator('.drawn-mask').count(),1);
 await q.fill('#label','담당자가 확인한 랙 장비');await q.fill('#explanation','담당자가 사진에서 장비 앞면의 배치를 확인했습니다.');
 let shape=q.locator('.drawn-mask').first(),before=await shape.getAttribute('points');const handle=q.locator('.handle').first();
 await handle.scrollIntoViewIfNeeded();let hb=await handle.boundingBox();
 await q.mouse.move(hb.x+hb.width/2,hb.y+hb.height/2);await q.mouse.down();await q.mouse.move(hb.x+hb.width/2+9,hb.y+hb.height/2+7,{steps:4});await q.mouse.up();
 assert.notEqual(await shape.getAttribute('points'),before);before=await shape.getAttribute('points');
 await mark(q,[]);const bb=await shape.boundingBox();await q.mouse.move(bb.x+bb.width*.5,bb.y+bb.height*.5);await q.mouse.down();await q.mouse.move(bb.x+bb.width*.5+14,bb.y+bb.height*.5+9,{steps:5});await q.mouse.up();
 assert.notEqual(await shape.getAttribute('points'),before);
 await q.click('#draw');await q.click('#keyboardRect');assert.equal(await q.locator('.drawn-mask').count(),2);await q.click('#deleteMask');assert.equal(await q.locator('.drawn-mask').count(),1);
 await q.click('#approve');await q.waitForFunction(()=>document.querySelectorAll('#cardStrip canvas').length===3);
 assert.equal(cloudCalls.length,1);
 await q.click('#suggestCopy');await q.waitForFunction(()=>!document.querySelector('#copyProposal').hidden);
 assert.doesNotMatch(JSON.stringify(cloudCalls[1]),/data:image|반영하지 않는 후보|polygon/);assert.match(JSON.stringify(cloudCalls[1]),/담당자가 확인한 랙 장비/);
 assert.notEqual(await q.locator('#headline').innerText(),'공간에 맞춘 녹취 설치');
 await q.click('#applyCopy');assert.equal(await q.locator('#headline').innerText(),'공간에 맞춘 녹취 설치');
 const d=await save(q,'approved-openai-stub.html');assert.match(d.html,/담당자가 확인한 랙 장비/);assert.doesNotMatch(d.html,/반영하지 않는 후보|초기 AI 제안|OpenAI/);assert.equal((d.html.match(/<polygon/g)||[]).length,1);
 const gone=await browser.newContext({offline:true});contexts.push(gone);const off=await gone.newPage();await off.goto('file://'+d.target);assert(await off.locator('img').evaluate(x=>x.naturalWidth>0&&x.src.startsWith('data:')));
 await off.waitForFunction(()=>document.querySelectorAll('[data-renderer=canvas-3d]').length===3);const model=off.locator('canvas[data-renderer=canvas-3d]').first(),rot=await model.getAttribute('data-rotation');await model.focus();await off.keyboard.press('ArrowRight');assert.notEqual(await model.getAttribute('data-rotation'),rot);
 await off.locator('.frame a').first().focus();await off.keyboard.press('Enter');assert(off.url().endsWith('#mask-1'));assert.match(await off.locator('article:target').innerText(),/담당자가/);
 await cards(q,mCtx,'approved-openai-stub-cards.zip');
 if(process.env.LIVE_PUBLIC==='1'){
  const live=await browser.newContext({viewport:{width:1360,height:900},reducedMotion:'reduce'});contexts.push(live);const z=await live.newPage();watch(z,prod);await toVisit(prod,z);
  const waiting=z.waitForResponse(r=>r.url().endsWith('/api/analyze'),{timeout:95_000});await z.locator('#upload').setInputFiles('public/assets/case-08-msearch.jpg');const r=await waiting;
  const d=await r.json();assert.equal(r.status(),200);assert(d.points.length>0);await z.waitForFunction(()=>document.querySelectorAll('.candidate').length>0);assert.equal(await z.locator('.drawn-mask').count(),0);console.log('Live upload public case-08:',d.points.length,'candidate(s),',d.elapsed,'seconds');
 }
 assert.deepEqual(failures,[]);
 console.log('Passed: no-key upload/manual mask, keyboard & undo, 2 phases, mask/vertex drag, consent, mocked OpenAI candidate isolation and reviewed text, offline HTML, 3 PNGs and responsive layout. '+tmp);
}finally{for(const ctx of contexts)await ctx.close();await browser.close();if(mocked)await new Promise(r=>mocked.close(r));await new Promise(r=>blank.close(r))}
