import test from 'node:test';
import assert from 'node:assert/strict';
import {server} from '../server.mjs';
const good={label:'장비',seen:'랙에 놓인 본체입니다.',polygon:[[3,12],[29,11],[27,23],[4,21]]};
function mock(value){return Response.json({status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify(value)}]}]})}
async function run(opts,body){const s=server(opts);await new Promise(r=>s.listen(0,'127.0.0.1',r));try{const base='http://127.0.0.1:'+s.address().port;const post=(path,data,headers={})=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(data)});await body(base,post)}finally{await new Promise(r=>s.close(r))}}
test('automatic photo analysis accepts only same-origin browser requests; marketing needs consent and approved text',async()=>{
 let calls=0;
 const transport=(_url,req)=>{calls++;const payload=JSON.parse(req.body);
  if(payload.text.format.name==='tlink_photo_observation')return mock({kind:'rack',points:[good]});
  assert.equal(payload.text.format.name,'tlink_marketing_draft');const input=JSON.parse(payload.input[0].content[0].text);assert.deepEqual(input.approved,[{label:good.label,description:good.seen}]);return mock({headline:'설치 현장',lead:'랙에 놓인 본체를 확인하세요.'});
 };
 await run({apiKey:'test-only',transport},async(base,post)=>{
   const image='/9j/2Q==';const approved={...good,customerText:good.seen,status:'approved'};
   assert.deepEqual(await (await fetch(base+'/api/status')).json(),{openaiAvailable:true,openaiModel:'gpt-6.2-astra'});
   assert.equal((await post('/api/analyze',{image})).status,403);
   const same={Origin:base,'Sec-Fetch-Site':'same-origin'};
   assert.equal((await post('/api/analyze',{image},{Origin:base})).status,403);
   assert.equal((await post('/api/analyze',{image},{...same,Origin:'http://evil.example'})).status,403);
   assert.equal((await post('/api/marketing',{points:[approved]})).status,403);
   assert.equal((await post('/api/marketing',{consent:true,points:[{...approved,status:'suggested'}]})).status,400);
   assert.equal(calls,0);
   const response=await post('/api/analyze',{image},same);assert.equal(response.status,200);assert.deepEqual((await response.json()).points,[good]);
   const draft=await post('/api/marketing',{consent:true,points:[approved],angle:'install'});assert.equal(draft.status,200);assert.equal((await draft.json()).headline,'설치 현장');
   assert.equal(calls,2);
 });
});
test('legacy files unavailable and explicitly missing key never uses a network transport',async()=>{
 await run({apiKey:'',transport:()=>assert.fail('network called')},async(base,post)=>{
   assert.equal((await post('/api/analyze',{image:'/9j/2Q=='},{Origin:base,'Sec-Fetch-Site':'same-origin'})).status,503);
   assert.equal((await fetch(base+'/app.js')).status,404);
   for(const path of ['/.env','/.env.local','/assets/.env','/assets/%2eenv'])assert.equal((await fetch(base+path)).status,404);
   assert.equal((await fetch(base+'/index.html',{redirect:'manual'})).headers.get('Location'),'/studio');
   assert.equal((await fetch(base+'/assets/rec-install-1.jpg')).status,200);
   assert.equal((await fetch(base+'/assets/%252e%252e%252fserver.mjs')).status,404);
 });
});
