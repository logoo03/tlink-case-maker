import assert from 'node:assert/strict';import path from 'node:path';import os from 'node:os';import fs from 'node:fs/promises';import {createRequire} from 'node:module';import {gallery} from '../public/gallery-data.js';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_CORE||'playwright-core');
const root=process.env.QA_URL||'http://127.0.0.1:4173',tmp=await fs.mkdtemp(path.join(os.tmpdir(),'tlink-mask-guide-'));
const b=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined,headless:true}),ctx=await b.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'}),p=await ctx.newPage();const issues=[];
p.on('pageerror',e=>issues.push(e.message));p.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith(root))issues.push(r.url())});
try{
 await p.goto(root);await p.waitForFunction(()=>document.querySelectorAll('[data-renderer="canvas-3d"]').length===3);
 for(const [width,height] of [[1440,900],[1280,720],[1024,600],[768,580],[390,844],[320,720]]){
  await p.setViewportSize({width,height});await p.evaluate(()=>window.scrollTo(0,0));
  const dims=await p.locator('.type').evaluateAll(v=>v.map(x=>({top:x.getBoundingClientRect().top,bottom:x.getBoundingClientRect().bottom})));assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  if(width>=768){assert.equal(new Set(dims.map(x=>x.top)).size,1);assert(dims.every(d=>d.top>=0&&d.bottom<=height));}
 }
 await p.setViewportSize({width:1440,height:900});await p.screenshot({path:path.join(tmp,'new-hero.png')});
 assert.equal(await p.locator('a[href^="/studio"]').count(),0);
 const totals=[];
 for(const [i,type] of ['stand','rack','mirror'].entries()){
  await p.evaluate(()=>window.scrollTo(0,0));const canvas=p.locator('canvas[data-type='+type+']'),pre=await canvas.evaluate(v=>[v.dataset.rotation,v.dataset.zoom,v.toDataURL()]),box=await canvas.boundingBox();
  await p.mouse.move(box.x+box.width*.4,box.y+box.height*.45);await p.mouse.down();await p.mouse.move(box.x+box.width*.64,box.y+box.height*.64,{steps:6});await p.mouse.up();await p.mouse.wheel(0,-84);
  await p.waitForFunction(t=>Number(document.querySelector('canvas[data-type='+t+']').dataset.zoom)>1,type);const post=await canvas.evaluate(e=>new Promise(r=>requestAnimationFrame(()=>r([e.dataset.rotation,e.dataset.zoom,e.toDataURL()]))));assert.notEqual(pre[0],post[0]);assert.notEqual(pre[2],post[2]);
  await p.locator('.select-type').nth(i).click();await p.waitForFunction(i=>document.querySelector('#casePhoto').src.endsWith('rec-install-'+(i+1)+'.jpg'),i);
  const thumbs=p.locator('.case-thumb'),expected=gallery.filter(x=>x.type===type);
  assert.equal(await thumbs.count(),expected.length);totals.push(expected.length);
  assert.equal(await p.locator('#exampleBar button').getAttribute('aria-pressed'),'true');assert.equal(await p.locator('#featureList div').count(),3);
  const polys=await p.locator('#pinLayer .device-mask').count();assert.equal(polys,type==='rack'?2:1);
  assert(await p.locator('#pinLayer .mask-scan').evaluateAll(g=>g.every(e=>getComputedStyle(e).display==='none')));
  for(const [j,item] of expected.entries()){
   const t=thumbs.nth(j),points=await t.locator('polygon').first().getAttribute('points');
   await t.click();await p.waitForFunction(n=>document.querySelector('#casePhoto').src.endsWith(n)&&document.querySelector('#casePhoto').naturalWidth>0,item.asset);
   const m=p.locator('#pinLayer .device-mask').first();assert.equal(await m.getAttribute('points'),points);assert.equal(await t.getAttribute('aria-pressed'),'true');
   await m.focus();await p.keyboard.press('Enter');assert.match(await p.locator('#pinDetail strong').innerText(),new RegExp(item.masks[0].label.replace(/[.*+?^\x24{}()|[\]\\]/g,'\\$&')));
  }
  assert.doesNotMatch(await p.locator('#pinDetail').innerText(),/확인 근거/);
 }
 assert.deepEqual(totals,[4,5,2]);assert.deepEqual(issues,[]);
 await p.screenshot({path:path.join(tmp,'new-gallery.png'),fullPage:true});
 await p.emulateMedia({reducedMotion:'no-preference'});await p.goto(root+'/#rack');await p.locator('#pinLayer .device-mask').first().focus();
 const effects=await p.evaluate(()=>({scan:getComputedStyle(document.querySelector('.scan-light')).animationName,enter:getComputedStyle(document.querySelector('.lead')).animationName}));assert.equal(effects.scan,'equipment-scan');assert.notEqual(effects.enter,'none');
 await p.goto(root+'/#mirror');await p.getByRole('button',{name:'이안***',exact:true}).click();await p.waitForFunction(()=>document.querySelector('#casePhoto').complete&&document.querySelector('#casePhoto').naturalWidth>0);
 const right=p.locator('#pinLayer .device-mask').first();await right.focus();await p.keyboard.press('Enter');assert.equal(await right.evaluate(e=>getComputedStyle(e).outlineStyle),'none');
 for(const selector of ['#pinLayer','#pinLayer svg','.mask-map [role=button]'])for(const n of await p.locator(selector).all())assert.equal(await n.evaluate(e=>getComputedStyle(e).outlineStyle),'none');
 const aligned=await p.evaluate(()=>{const a=document.querySelector('#casePhoto').getBoundingClientRect(),b=document.querySelector('#pinLayer svg').getBoundingClientRect();return ['width','height','top','left'].every(k=>Math.abs(a[k]-b[k])<1)});assert(aligned);
 await p.screenshot({path:path.join(tmp,'ian-focus.png')});
 console.log('Passed 4173: 3 desktop models & gestures; manufacturer first; 4/5/2 exact gallery masks and keyboard; no customer Studio; mobile no overflow; subtle outline geometry and motion opt-out. '+tmp);
}finally{await b.close()}
