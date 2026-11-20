import {types} from './install-content.js';
import {gallery} from './gallery-data.js';
import {manufacturerMasks} from './manufacturer-masks.js';
import {liveMasks} from './live-masks.js';
import {HEX,MAX_MASKS,enrichMasks,approveMasks,sanitize} from './masks.js';
import {mountMaskEditor} from './mask-editor.js';
import {buildCopy,exportHTML,renderMarketingCards,downloadMarketingCards} from './marketing.js';
const $=id=>document.getElementById(id);
const notice=msg=>{$('notice').textContent=msg};
const msg=txt=>{$('downloadStatus').textContent=txt};
function el(tag,label,cls){const n=document.createElement(tag);if(label!==undefined)n.textContent=label;if(cls)n.className=cls;return n;}
function btn(text,fn,cls){const b=el('button',text,cls);b.type='button';b.addEventListener('click',fn);return b;}
const maker=types.map(t=>{const g=t.media.find(m=>m.id.startsWith('guide'));return {id:g.id,name:t.name+' · 제조사 예시',asset:g.asset,masks:liveMasks[g.id]??manufacturerMasks[g.id]}});
const samples=[...maker,{id:'featured-eunpyeong',name:'은평***클럽 · 벽걸이 서버와 단자함',asset:'rec-case-photo.jpg',masks:manufacturerMasks['featured-eunpyeong']},...gallery.map(e=>({...e,masks:liveMasks[e.id]??e.masks}))];
$('sample').append(...samples.map(s=>{const o=el('option',s.name);o.value=s.id;return o}));
let photo=null,candidates=[],selected=-1,shapes=[],options={},approved=null,approvedSign='',copy=null,proposal=null,applied=null,seq=0,renderSeq=0,requestBusy=false,copyBusy=false,api=false;
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const photoCache=new Map();
const apiInfo=fetch('/api/status').then(r=>r.ok?r.json():null).then(d=>{api=d?.openaiAvailable===true;controls();return api}).catch(()=>false);
const stateKey=()=>photo?.key?'tlink-mask-studio:'+photo.key:null;
const signature=list=>JSON.stringify(list.map(p=>[p.polygon,p.label,p.customerText]));
const origin={template:'제조사·공식 사례 참고',manual:'수동 윤곽',OpenAI:'OpenAI 후보를 가져옴'};
const inspectOrigin=p=>origin[p?.origin]??'담당자 검토';
const editor=mountMaskEditor($('maskOverlay'),{
 onUpdate(list,meta){
  shapes=list;options=meta;selected=meta.selected;
  if(approved&&signature(shapes)!==approvedSign){invalidate();notice('윤곽이나 설명이 바뀌었습니다. 다시 검토하고 승인하세요.');}
  if(meta.panel!==false)populateFields();
  drawList();controls();store();
 },
 onSelection(){populateFields()},
 onMessage:notice
});
function invalidate(){
 approved=null;approvedSign='';copy=null;proposal=null;applied=null;copyBusy=false;renderSeq++;
 $('copyProposal').hidden=true;
 $('cardStrip').replaceChildren();msg('');controls();
}
function controls(){
 const ready=Boolean(photo),filled=shapes.length>0;
 $('photoBoard').hidden=!ready;$('empty').hidden=ready;$('photoBoard').classList.toggle('analyzing',requestBusy);
 $('draw').disabled=!ready||shapes.length>=MAX_MASKS||options.drawing;
 $('finish').hidden=!options.drawing;$('finish').disabled=(options.draftSize??0)<3;
 $('keyboardRect').hidden=!options.drawing;$('cancelDraw').hidden=!options.drawing;
 $('undo').disabled=!(options.undo||options.draftSize);
 $('approve').disabled=!ready||!filled||options.drawing||requestBusy;
 $('approve').firstChild.textContent=approved?'검토 완료 · 다시 생성 ':'검토 완료 · 홍보물 생성 ';
 $('result').hidden=!approved;$('waiting').hidden=Boolean(approved);$('editAgain').hidden=!approved;
 $('deliveryNav').setAttribute('aria-disabled',String(!approved));
 $('copyAI').hidden=!api;$('suggestCopy').disabled=!approved||copyBusy;
 $('suggestCopy').textContent=copyBusy?'카피 작성 중…':'카피 제안받기';
 $('downloadHTML').disabled=!approved||!copy;$('downloadCards').disabled=!approved||!copy;
}
function drawList(){
 $('maskCount').textContent=shapes.length+' / '+MAX_MASKS;
 $('maskList').replaceChildren(...(shapes.length?shapes.map((p,i)=>{
  const b=btn(undefined,()=>{editor.select(i);$('maskList').children[i]?.focus({preventScroll:true})},'maskPick');b.append(el('strong',p.label.trim()||'이름 없는 장비'),el('span',p.polygon.length+'점'));b.style.setProperty('--mask',HEX[i]);b.setAttribute('aria-pressed',String(i===selected));return b;
 }):[el('p',photo?'사진 위에 장비를 그리거나 제안을 가져오세요.':'사진을 먼저 올리세요.','staff')]));
 $('candidateBox').hidden=!candidates.length;$('candidateCount').textContent=candidates.length+'개';
 $('candidates').replaceChildren(...candidates.map((p,i)=>{
  const d=el('div',undefined,'candidate');d.append(el('h4',p.label),el('p',p.customerText));const b=btn('작업 목록에 가져오기',()=>{
   if(shapes.length>=MAX_MASKS)return;candidates.splice(i,1);editor.preview(null);editor.add({...p,id:crypto.randomUUID(),status:'draft'});$('label').focus();
  });b.disabled=shapes.length>=MAX_MASKS;
  d.addEventListener('pointerenter',()=>editor.preview(p));d.addEventListener('pointerleave',()=>editor.preview(null));b.addEventListener('focus',()=>editor.preview(p));b.addEventListener('blur',()=>editor.preview(null));d.append(b);return d;
 }));
}
function populateFields(){
 const p=shapes[selected];$('fields').hidden=!p;if(!p)return;
 $('label').value=p.label;$('explanation').value=p.customerText;$('selectedOrigin').textContent=inspectOrigin(p);
}
function store(){
 const key=stateKey();if(!key)return;
 try{sessionStorage.setItem(key,JSON.stringify(shapes.map(p=>({...p,status:'draft'}))))}catch{}
}
function restore(fallback){
 const key=stateKey();if(!key)return fallback;
 try{const item=JSON.parse(sessionStorage.getItem(key)||'null');if(Array.isArray(item))return item.slice(0,MAX_MASKS).map(p=>({...p,status:'draft'}));}catch{}
 return fallback;
}
function loadImage(src){return new Promise((ok,no)=>{const img=new Image();img.onload=()=>ok(img);img.onerror=no;img.src=src})}
function imageURL(img,max=1450,quality=.91){
 const c=document.createElement('canvas'),scale=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight));c.width=Math.max(1,Math.round(img.naturalWidth*scale));c.height=Math.max(1,Math.round(img.naturalHeight*scale));const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(img,0,0,c.width,c.height);return c.toDataURL('image/jpeg',quality);
}
async function digest(file){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer()))].map(n=>n.toString(16).padStart(2,'0')).join('')}
async function usePhoto(info,initial,turn){
 const img=await loadImage(info.src);
 if(turn!==seq){if(info.blob)URL.revokeObjectURL(info.src);return}
 if(photo?.blob)URL.revokeObjectURL(photo.src);
 photo={...info,img};requestBusy=false;candidates=[];invalidate();$('candidateBox').open=false;
 $('photo').src=photo.src;$('photo').alt=info.caption;
 $('photoBoard').style.setProperty('--photo-width',Math.min(740,535*img.naturalWidth/img.naturalHeight)+'px');
 $('photoName').textContent=info.name;
 editor.load(restore(initial));
 notice(info.blob?'사진을 올렸습니다. 분석 준비 중입니다.':'공식 예시에서 확인된 윤곽을 불러왔습니다.');
}
$('upload').addEventListener('change',async e=>{
 const f=e.target.files[0];if(!f)return;
 if(!/^image\/(jpeg|png|webp)$/.test(f.type)||f.size>20_000_000){notice('20MB 이하의 JPG, PNG, WebP를 올리세요.');return;}
 const turn=++seq,u=URL.createObjectURL(f);$('sample').value='';
 try{await usePhoto({src:u,caption:'현장 설치 사진',name:f.name,key:await digest(f),blob:true},[],turn);if(turn===seq)await analyzePhoto(turn)}
 catch{URL.revokeObjectURL(u);if(turn===seq){notice('사진 파일을 읽지 못했습니다. 다른 파일을 선택하세요.');requestBusy=false;controls()}}
});
$('sample').addEventListener('change',async e=>{
 const s=samples.find(a=>a.id===e.target.value);if(!s)return;
 const turn=++seq;$('upload').value='';
 try{await usePhoto({src:'/assets/'+s.asset,caption:s.name+' · 티링크 설치 자료',name:s.name,key:'sample-'+s.id,blob:false},enrichMasks(s.masks),turn)}
 catch{if(turn===seq){notice('공식 예시를 열 수 없습니다. 다른 사진을 선택하세요.');requestBusy=false;controls()}}
});
async function analyzePhoto(turn){
 const enabled=await apiInfo;if(turn!==seq||!photo?.blob||requestBusy)return;
 if(!enabled){notice('사진을 올렸습니다. 현재 자동 분석을 사용할 수 없어 윤곽을 직접 그릴 수 있습니다.');return;}
 const p=photo;if(photoCache.has(p.key)){candidates=structuredClone(photoCache.get(p.key));drawList();$('candidateBox').open=Boolean(candidates.length);notice('이 탭에서 먼저 분석한 결과를 불러왔습니다. 검토 목록에 넣은 장비만 결과물에 사용합니다.');return;}
 requestBusy=true;controls();notice('사진을 분석해 장비 윤곽과 설명을 찾는 중입니다.');
 try{
  const response=await fetch('/api/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image:imageURL(p.img,1450,.90).split(',')[1]})});
  const d=await response.json();if(turn!==seq)return;if(!response.ok)throw Error(d.error);
  candidates=enrichMasks(d.points,'OpenAI');photoCache.set(p.key,structuredClone(candidates));drawList();$('candidateBox').open=Boolean(candidates.length);
  notice(candidates.length?'장비 후보 '+candidates.length+'개를 찾았습니다. 사용할 후보를 작업 목록에 가져오세요.':'눈에 띄는 장비 윤곽을 찾지 못했습니다. 사진에서 직접 그릴 수 있습니다.');
 }catch(e){if(turn===seq)notice((e.message||'자동 분석이 실패했습니다.')+' 윤곽을 직접 그릴 수 있습니다.')}
 finally{if(turn===seq){requestBusy=false;controls();}}
}
$('draw').addEventListener('click',()=>{editor.draw();$('maskOverlay').focus();notice('장비 가장자리를 차례로 눌러 꼭짓점을 만들고, 시작점을 다시 누르거나 윤곽 닫기를 선택하세요.')});
$('keyboardRect').addEventListener('click',()=>{editor.add({id:crypto.randomUUID(),label:'',customerText:'',polygon:[[35,35],[65,35],[65,65],[35,65]],origin:'manual',status:'draft'});$('maskOverlay').querySelector('.handle')?.focus();notice('화살표로 각 꼭짓점을 이동할 수 있고 Shift와 함께 누르면 더 크게 이동합니다.')});
$('finish').addEventListener('click',()=>{editor.finish();if(selected>=0)$('label').focus()});
$('cancelDraw').addEventListener('click',()=>{editor.cancel();notice('윤곽 그리기를 취소했습니다.')});
$('undo').addEventListener('click',()=>editor.undo());
$('deleteMask').addEventListener('click',()=>{editor.erase();$('draw').focus();notice('선택한 윤곽을 삭제했습니다. 실행 취소로 되돌릴 수 있습니다.')});
$('label').addEventListener('input',e=>editor.patch('label',e.target.value));
$('explanation').addEventListener('input',e=>editor.patch('customerText',e.target.value));
$('deliveryNav').addEventListener('click',e=>{if(!approved)e.preventDefault()});
$('approve').addEventListener('click',()=>{
 if(!photo||requestBusy)return;
 try{
  approved=approveMasks(editor.shapes());approvedSign=signature(shapes);proposal=null;applied=null;
  $('copyProposal').hidden=true;
  notice('장비 윤곽 '+approved.length+'개를 승인했습니다. 별도로 남은 후보와 내부 편집 메모는 포함되지 않습니다.');generate();
  $('deliveryHeading').focus({preventScroll:true});$('deliveryStep').scrollIntoView({behavior:reduced()?'instant':'smooth'});
 }catch(e){notice(e.message)}
});
function signedArgs(url=photo?.src){return {src:url,caption:photo?.caption,masks:approved,copy}}
async function generate(){
 if(!approved)return;
 const turn=++renderSeq,tmp=buildCopy(approved,{angle:$('angle').value,brief:$('brief').value});copy=applied?{...tmp,...applied}:tmp;
 $('headline').textContent=copy.title;$('lead').textContent=copy.lead;$('copyMode').textContent=applied?'담당자가 검토한 OpenAI 카피':'승인한 설명으로 자동 구성';msg('');controls();
 try{const cards=await renderMarketingCards(signedArgs());if(turn!==renderSeq)return;cards.forEach((c,i)=>{c.setAttribute('role','img');c.setAttribute('aria-label',['고객 질문 카드','마스크 설치 사례 카드','상담 안내 카드'][i]);});$('cardStrip').replaceChildren(...cards)}
 catch{if(turn===renderSeq)msg('카드 미리보기를 만들지 못했습니다.')}
}
function resetCopy(){proposal=null;applied=null;$('copyProposal').hidden=true;generate()}
$('regenerate').addEventListener('click',resetCopy);$('angle').addEventListener('change',resetCopy);
$('editAgain').addEventListener('click',()=>{invalidate();$('reviewStep').scrollIntoView({behavior:reduced()?'instant':'smooth'});$('draw').focus({preventScroll:true});notice('마스크를 편집합니다. 홍보물을 저장하려면 다시 승인하세요.')});
$('suggestCopy').addEventListener('click',async()=>{
 if(!approved||!api||copyBusy)return;const masks=approved,angle=$('angle').value;copyBusy=true;controls();
 try{
  const r=await fetch('/api/marketing',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({consent:true,angle,brief:$('brief').value,points:masks})}),d=await r.json();
  if(approved!==masks||angle!==$('angle').value)return;if(!r.ok)throw Error(d.error);
  proposal={title:sanitize(d.headline,55),lead:sanitize(d.lead,160)};if(!proposal.title||!proposal.lead)throw Error('사용할 수 있는 카피가 없습니다.');
  $('copyProposalText').textContent='검토용 추천: '+proposal.title+' / '+proposal.lead;$('copyProposal').hidden=false;msg('근거와 일치하는지 확인한 문구만 적용하세요.');
 }catch(e){if(approved===masks)msg(e.message)}finally{if(approved===masks){copyBusy=false;controls()}}
});
$('applyCopy').addEventListener('click',()=>{if(!approved||!proposal)return;applied={...proposal};generate()});
$('downloadHTML').addEventListener('click',async()=>{
 if(!approved||!copy||!photo)return;
 const base=approved,config=signedArgs(imageURL(photo.img));$('downloadHTML').disabled=true;
 try{
  const response=await fetch('/install-3d.js');if(!response.ok)throw Error('3D 미리보기를 내장하지 못했습니다. 다시 시도하세요.');
  const modelSource=await response.text();if(base!==approved)return;
  const body=exportHTML({...config,modelSource}),u=URL.createObjectURL(new Blob([body],{type:'text/html;charset=utf-8'})),a=el('a');a.href=u;a.download='tlink-installation-case.html';a.click();setTimeout(()=>URL.revokeObjectURL(u),45000);msg('사진과 3D 모형을 한 HTML에 저장했습니다.')
 }catch(e){msg(e.message)}finally{controls()}
});
$('downloadCards').addEventListener('click',async()=>{if(!approved||!copy||!photo)return;$('downloadCards').disabled=true;try{await downloadMarketingCards(signedArgs());msg('1080×1350 인스타그램 PNG 3장 ZIP을 저장했습니다. 자동 게시는 하지 않았습니다.')}catch(e){msg(e.message)}finally{controls()}});
controls();const pre=new URLSearchParams(location.search).get('case');
const migrated=pre==='eunpyeong'?'featured-eunpyeong':pre==='ian'?'case-12':pre;
if(samples.some(x=>x.id===migrated)){$('sample').value=migrated;$('sample').dispatchEvent(new Event('change'));}
