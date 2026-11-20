import test from 'node:test';
import assert from 'node:assert/strict';
import {requestPhotoAnalysis, STUDIO_INSTALL_FACTS, requestRevisionPlan, requestMarketing, OpenAIRequestError} from '../openai.mjs';

const jpeg='/9j/2Q==';
const key='fake-test-key';
function result(output) {
  return Response.json({status:'completed',output:[
    {type:'reasoning',summary:[]},
    {type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify(output)}]}
  ]});
}
test('vision sends local JPEG and strict private request, limits points', async ()=>{
  const photo=await requestPhotoAnalysis({image:jpeg,key,context:'공개 현장',transport:async (url,req)=>{
    const body=JSON.parse(req.body);
    assert.equal(url,'https://api.openai.com/v1/responses');
    assert.equal(req.headers.Authorization,'Bearer '+key);
    assert.equal(req.redirect,'error');
    assert.equal(body.store,false);
    assert.deepEqual(body.tools,[]);
    assert.equal(body.tool_choice,'none');
    assert.equal(body.model,'gpt-6.2-astra');
    assert.equal(body.text.format.strict,true);
    assert.equal(body.input[0].content[1].image_url,'data:image/jpeg;base64,'+jpeg);
    assert.match(body.input[0].content[0].text,/공개 현장/);
    return result({kind:'rack',points:[
      {polygon:[[-1,20],[12,20],[12,30]],label:'무효',seen:'무효'},
      {polygon:[[45,70],[70,70],[60,78]],label:' 배선 ',seen:'파란 선이 보입니다.'},
      {polygon:[[93,20],[98,25],[96,32]],label:'랙',seen:'금속 프레임이 보입니다.'},
      {polygon:[[40,40],[41,41],[42,42]],label:'추가',seen:'무시할 세 번째 점'},
    ]});
  }});
  assert.equal(photo.kind,'rack');
  assert.equal(photo.points.length,2);
  assert.deepEqual(photo.points[0],{polygon:[[45,70],[70,70],[60,78]],label:'배선',seen:'파란 선이 보입니다.'});
});
test('unknown output never returns invented hotspots', async ()=>{
  const photo=await requestPhotoAnalysis({image:jpeg,key,transport:async ()=>result({kind:'unknown',points:[{x:30,y:30,label:'랙',seen:'금속'}]})});
  assert.deepEqual(photo,{kind:'unknown',points:[]});
});
test('revision sends text only and returns no factual prose', async ()=>{
  const plan=await requestRevisionPlan({feedback:'전산 담당자에게, 짧게',key,transport:async (_url,req)=>{
    const body=JSON.parse(req.body);
    assert.deepEqual(body.input[0].content.map(part=>part.type),['input_text']);
    assert.equal(body.text.format.name,'tlink_revision_plan');
    return result({hook:'statement',tone:'technical',length:'short',invented:'untrusted text'});
  }});
  assert.deepEqual(plan,{hook:'statement',tone:'technical',length:'short'});
});
test('empty key or malformed image never calls transport', async ()=>{
  const transport=()=>assert.fail('called network');
  await assert.rejects(requestPhotoAnalysis({image:jpeg,key:'',transport}), {code:'missing_key',status:503});
  await assert.rejects(requestPhotoAnalysis({image:'not-an-image',key,transport}), {code:'invalid_image',status:400});
  await assert.rejects(requestRevisionPlan({feedback:' ',key,transport}), {code:'invalid_feedback',status:400});
});
test('provider failures are safe and do not echo upstream body', async ()=>{
  for(const [status,code] of [[401,'auth'],[404,'auth'],[429,'rate_limit'],[500,'unavailable']]){
    await assert.rejects(requestPhotoAnalysis({image:jpeg,key,transport:async ()=>new Response('untrusted response '+key,{status})}),e=>{
      assert.ok(e instanceof OpenAIRequestError);
      assert.equal(e.code,code);
      assert.ok(!e.message.includes(key));
      return true;
    });
  }
});
test('refusals and out-of-schema editorial changes reject', async ()=>{
  await assert.rejects(requestPhotoAnalysis({image:jpeg,key,transport:async ()=>Response.json({
    status:'completed',output:[{type:'message',role:'assistant',content:[{type:'refusal',refusal:'response'}]}]
  })}), {code:'invalid_response',status:502});
  await assert.rejects(requestRevisionPlan({feedback:'짧게',key,transport:async ()=>result({hook:'arbitrary',tone:'plain',length:'short'})}), {code:'invalid_response',status:502});
});

test('marketing transmits only approved text, not the photo, polygon, or other fields', async()=>{
 const label='설치된 장비',customerText='사진에서 배선을 확인할 수 있습니다.',p={label,customerText,polygon:[[10,20],[33,20],[23,60]],image:jpeg};
 await assert.rejects(requestMarketing({points:[{...p,status:'suggested'}],key,transport:()=>assert.fail('network called')}),{code:'invalid_marketing'});
 const draft=await requestMarketing({points:[{...p,status:'approved'}],key,angle:'설치',brief:'간결하게',transport:async (_url,req)=>{
   const body=JSON.parse(req.body);
   assert.deepEqual(body.input[0].content.map(part=>part.type),['input_text']);
   const input=JSON.parse(body.input[0].content[0].text);
   assert.deepEqual(input.approved,[{label,description:customerText}]);assert.equal(body.store,false);
   return result({headline:'사진 속 설치 환경',lead:'사진에서 장비 배치를 확인하세요.'});
 }});
 assert.equal(draft.headline,'사진 속 설치 환경');
});

test('Studio photo prompt includes exact approved descriptions without forcing classification',async()=>{
 let studio,base;
 const capture=write=>async(_url,req)=>{write(JSON.parse(req.body));return result({kind:'unknown',points:[]})};
 await requestPhotoAnalysis({image:jpeg,key,studioInstall:true,transport:capture(x=>studio=x)});
 await requestPhotoAnalysis({image:jpeg,key,transport:capture(x=>base=x)});
 for(const phrase of Object.values(STUDIO_INSTALL_FACTS)){
  assert(studio.instructions.includes(phrase));
  assert(!base.instructions.includes(phrase));
 }
 for(const phrase of ['미러링 스위치 허브형','책상에 손바닥만 한 장비만 추가한 상태입니다.','책상·선반·랙·단자함','구별할 수 없는 장비'])assert(studio.instructions.includes(phrase));
 assert.equal(studio.store,false);assert.equal(studio.input[0].content[1].detail,'original');
});
