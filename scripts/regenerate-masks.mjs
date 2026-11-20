import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {projectKey} from '../project-env.mjs';
import {requestPhotoAnalysis} from '../openai.mjs';
import {gallery} from '../public/gallery-data.js';
import {manufacturerMasks} from '../public/manufacturer-masks.js';
const types=['스탠드형','렉거치형','미러링스위치허브'];
const manufacturer=types.map((n,i)=>({id:'guide-'+(i+1),asset:'rec-install-'+(i+1)+'.jpg',masks:manufacturerMasks['guide-'+(i+1)],name:n}));
const known=[...manufacturer,...gallery], flags=process.argv.slice(2), all=flags.includes('--all'), ids=flags.filter(v=>!v.startsWith('--'));
const list=all?known.filter(x=>!ids.includes(x.id)):known.filter(x=>ids.includes(x.id));
if(!list.length)throw Error('공식 등록 사례 ID를 지정하세요.');
const key=projectKey();if(!key)throw Error('OpenAI 키를 설정하세요.');
const temp=new URL('../outputs/mask-candidates/',import.meta.url);await mkdir(temp,{recursive:true});
async function examine(item){
 const out=new URL(item.id+'.json',temp);
 if(!flags.includes('--redo')){try{const old=JSON.parse(await readFile(out,'utf8'));if(old.ok){console.log(item.id,'cached',old.points.length);return true}}catch{}}
 const context='공개 설치 예시. 특히 다음 공개 사진의 장비 표시 영역을 찾으세요: '+item.masks.map(x=>x.label).join(', ')+'. 가시 물체만 윤곽으로 표시하며 사진에서 제조사 색상 표시 상자가 보이면 표시 상자 자체가 아닌 실제 장비 본체를 따르세요.';
 let status=0,t=Date.now();const transport=async(...args)=>{const r=await fetch(...args);status=r.status;return r};
 try {
  const image=(await readFile(new URL('../public/assets/'+item.asset,import.meta.url))).toString('base64');
  const result=await requestPhotoAnalysis({image,key,context,transport,imageDetail:'original'});
  const data={id:item.id,asset:item.asset,ok:true,seconds:Math.round((Date.now()-t)/1000),...result};await writeFile(out,JSON.stringify(data,null,2));console.log(item.id,'ok',data.points.length,data.seconds+'s');
  return true;
 }catch(e){console.log(item.id,'failed',status||e.code||e.name);await writeFile(out,JSON.stringify({id:item.id,asset:item.asset,ok:false,error:status||e.code||e.name}));return false;}
}
let fail=0,index=0;
await Promise.all(Array.from({length:Math.min(all?3:1,list.length)},async()=>{while(index<list.length){const i=index++;if(!(await examine(list[i])))fail++;}}));
console.log('total',list.length,'failed',fail);
if(fail===list.length)process.exitCode=1;
