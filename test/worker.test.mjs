import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createWorker,workerTransport} from '../worker.mjs';
import {server} from '../server.mjs';
const origin='https://demo-tlink.workers.dev';
const H={origin,'cf-connecting-ip':'192.0.2.2','sec-fetch-site':'same-origin','content-type':'application/json'};
const point={label:'미러링 스위치 허브형',seen:'책상 위에 작은 장비가 놓여 있습니다.',polygon:[[20,25],[75,25],[75,61],[20,61]]};
const ok=()=>Response.json({status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify({kind:'desk',points:[point]})}]}]});
const fixture=over=>({TLINK_ORIGIN:origin,OPENAI_API_KEY:'stub-key-only',STUDIO_RATE_LIMIT:{limit:async()=>({success:true})},STUDIO_BUDGET:{idFromName:()=>1,get:()=>({fetch:async()=>new Response(null,{status:204})})},ASSETS:{fetch:async r=>{assert.equal(r.headers.get('Authorization'),null);assert.equal(r.headers.get('Cookie'),null);const url=new URL(r.url);try{return new Response(await readFile(new URL('../public'+url.pathname,import.meta.url)),{status:200,headers:{'content-type':url.pathname.endsWith('.html')?'text/html':'text/javascript'}})}catch{return new Response('not found',{status:404})}}},...over});
const request=(path,opt={})=>new Request(origin+path,opt);
const upload=(body={image:'/9j/AAAA'},headers=H)=>({method:'POST',headers,body:JSON.stringify(body)});
test('public guide and Studio open without credentials; browser-only analysis denies missing request metadata',async()=>{
 let n=0;const w=createWorker({transport:()=>{n++;throw Error()}});
 for(const p of ['/','/install','/install.js','/masks.js','/install-3d.js','/live-masks.js'])assert.equal((await w.fetch(request(p), fixture())).status,200,p);
 for(const p of ['/studio','/studio-v2.html','/index.html','/studio-v2.js','/marketing.js','/api/status'])assert.equal((await w.fetch(request(p),fixture())).status,200,p);assert.equal((await w.fetch(request('/api/analyze',{method:'POST',body:'{}'}),fixture())).status,403);
 const r=await w.fetch(request('/studio',{headers:{...H,cookie:'hidden'}}),fixture());assert.equal(r.status,200);assert.match(r.headers.get('cache-control'),/no-store/);
 assert.match(await r.text(),/케이스메이커 \| 스튜디오/);
 assert.equal((await w.fetch(request('/studio/?case=x'),fixture())).headers.get('Location'),'/studio?case=x');
 assert.equal(n,0);
});
test('env, Worker source, legacy aliases, unsupported paths and false host are denied',async()=>{
 const w=createWorker(),env=fixture();
 for(const p of ['/.env','/%2eenv','/assets/.env','/assets/%2eenv','/project-env.mjs','/openai.mjs','/worker.mjs','/studio-v2','/app.js','/archive/point-studio/index.html'])
  assert.equal((await w.fetch(request(p,{headers:H}),env)).status,404,p);
 assert.equal((await w.fetch(request('/studio',{headers:{...H,Host:'example.com'}}),env)).status,403);
 assert.equal((await (await w.fetch(request('/api/status',{headers:H}),fixture({TLINK_ORIGIN:''}))).json()).openaiAvailable,false);
 assert.equal((await w.fetch(new Request('http://demo-tlink.workers.dev/'),env)).status,403);
});
test('CSRF, body limits, inappropriate methods, missing rate binding and exhausted rate cannot call upstream',async()=>{
 let calls=0;const w=createWorker({transport:()=>{calls++;return ok()}});
 assert.equal((await w.fetch(request('/api/analyze',upload(undefined,{...H,origin:'https://elsewhere.test'})),fixture())).status,403);
 assert.equal((await w.fetch(request('/api/analyze',upload(undefined,{...H,'sec-fetch-site':'cross-site'})),fixture())).status,403);
 assert.equal((await w.fetch(request('/api/analyze',upload({image:'x'.repeat(3_000_001)})),fixture())).status,413);
 assert.equal((await w.fetch(request('/api/analyze',{method:'OPTIONS',headers:H}),fixture())).status,405);
 assert.equal((await w.fetch(request('/api/marketing',upload({points:[]})),fixture())).status,403);
 assert.equal((await w.fetch(request('/api/analyze',upload()),fixture({STUDIO_RATE_LIMIT:undefined}))).status,503);
 assert.equal((await w.fetch(request('/api/analyze',upload()),fixture({STUDIO_RATE_LIMIT:{limit:async()=>({success:false})}}))).status,429);
 assert.equal((await w.fetch(request('/api/analyze',upload()),fixture({OPENAI_API_KEY:undefined}))).status,503);
 assert.equal((await w.fetch(request('/api/analyze',upload()),fixture({STUDIO_BUDGET:{idFromName:()=>1,get:()=>({fetch:async()=>new Response(null,{status:429})})}}))).status,429);
 assert.equal(calls,0);
});
test('authorized analysis uses same OpenAI prompt and output as Node server; no real calls',async()=>{
 const upstream=[];
 const transport=async(_url,req)=>{upstream.push(JSON.parse(req.body));return ok();};
 const w=createWorker({transport});const wr=await w.fetch(request('/api/analyze',upload()),fixture());assert.equal(wr.status,200);
 const s=server({apiKey:'stub-key-only',transport});await new Promise(y=>s.listen(0,'127.0.0.1',y));
 try{
  const loop='http://127.0.0.1:'+s.address().port;
  const nr=await fetch(loop+'/api/analyze',upload(undefined,{...H,origin:loop}));assert.equal(nr.status,200);
  const {elapsed:e1,...a}=await wr.json(),{elapsed:e2,...b}=await nr.json();assert.deepEqual(a,b);
  assert.deepEqual(upstream[0],upstream[1]);assert.match(upstream[0].instructions,/책상에 손바닥만 한 장비만 추가한 상태입니다/);
 }finally{await new Promise(y=>s.close(y));}
});
test('static assets consist of web source and approved photo files; no deployment or archive config under public',async()=>{
 const files=await readdir(new URL('../public/',import.meta.url),{recursive:true});
 const unsupported=files.filter(f=>f!=='assets'&&f!=='.assetsignore'&&!f.endsWith('.DS_Store')&&!/^(?:[a-z0-9-]+\.(?:html|js|css)|assets\/[a-z0-9-]+\.(?:jpg|jpeg|png|webp))$/.test(f));
 assert.deepEqual(unsupported,[]);
});
test('global SQLite budget accepts precisely 40 concurrent attempts in one UTC day',async()=>{
 const {DatabaseSync}=await import('node:sqlite'),{StudioBudget}=await import('../worker.mjs');
 const db=new DatabaseSync(':memory:');
 const sql={exec:(query,...args)=>({toArray:()=>db.prepare(query).all(...args)})};
 // Match Cloudflare's eager sql.exec semantics, including schema statements.
 sql.exec=(q,...args)=>{const rows=db.prepare(q).all(...args);return {toArray:()=>rows};};
 const global=new StudioBudget({storage:{sql}});
 const spent=await Promise.all(Array.from({length:47},()=>global.fetch(new Request('https://budget.internal/consume',{method:'POST'}))));
 assert.equal(spent.filter(x=>x.status===204).length,40);
 assert.equal(spent.filter(x=>x.status===429).length,7);
 assert.equal(db.prepare('SELECT used FROM quota').get().used,40);
 db.close();
});

test('Workerd fetch uses manual redirects so bearer secrets never follow a redirect',async()=>{
 const original=globalThis.fetch;
 try{
  globalThis.fetch=async(url,init)=>{assert.equal(url,'https://api.openai.com/v1/responses');assert.equal(init.redirect,'manual');return Response.redirect('https://other.invalid');};
  const r=await workerTransport('https://api.openai.com/v1/responses',{redirect:'error'});assert.equal(r.status,302);
 }finally{globalThis.fetch=original;}
});
