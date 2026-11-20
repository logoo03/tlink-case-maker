import {types,official} from './install-content.js';
import {gallery} from './gallery-data.js';
import * as maskGeometry from './masks.js';
import {liveMasks} from './live-masks.js';
import {manufacturerMasks} from './manufacturer-masks.js';
import {mountModel} from './install-3d.js';
const $=id=>document.getElementById(id);
let choice=2,media=0,activePin=0;
const casePhoto=$('casePhoto'),imageBox=$('imageBox');
const rm=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
function el(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n}
function button(text,cb,cls='',pressed){const b=el('button',text,cls);b.type='button';if(typeof pressed==='boolean')b.setAttribute('aria-pressed',String(pressed));b.addEventListener('click',cb);return b;}
function name(n,s){n.setAttribute('aria-label',s);return n}
function mkType(d,i){
 const art=el('article',undefined,'type'),stage=el('div',undefined,'stage'),canvas=name(el('canvas'),d.name+' 3D 모형. 드래그 또는 화살표로 회전하고 휠 또는 더하기·빼기로 확대·축소합니다.');
 canvas.tabIndex=0;canvas.dataset.type=d.id;
 const reset=button('리셋',()=>model?.reset(),'reset');name(reset,d.name+' 모형 각도와 확대 초기화');
 let model;
 const fallback=el('img');fallback.src='/assets/'+d.media.find(m=>m.id.startsWith('guide')).asset;fallback.alt=d.name+' 제조사 예시 (3D 대체)';fallback.hidden=true;
 stage.append(canvas,fallback,el('span',undefined,'axis'),el('span',d.placard,'formtag'),reset);
 const select=button(undefined,()=>choose(i,true),'select-type',i===choice);select.append(el('span',d.name,'title'),el('span',d.place,'place'));const arrow=el('span','↓','arrow');arrow.setAttribute('aria-hidden','true');select.append(arrow);
 art.append(stage,select);
 requestAnimationFrame(()=>{try{model=mountModel(canvas,d.id);if(!model)throw Error()}catch{canvas.hidden=true;fallback.hidden=false;reset.hidden=true;stage.setAttribute('title','이 환경에서는 3D 모형 대신 공식 예시를 표시합니다.')}});
 return art;
}
function choose(i,scroll){
 choice=i;media=0;activePin=0;
 renderType();
 if(scroll){
  const hash='#'+types[i].id;
  if(location.hash!==hash)history.pushState(null,'',hash);
  $('detailHeading').focus({preventScroll:true});
  $('detailSection').scrollIntoView({behavior:rm()?'instant':'smooth',block:'start'});
 }
}
let mediaSet=[];
const svgNS='http://www.w3.org/2000/svg';
const createSVG=(tag,attrs={})=>{const n=document.createElementNS(svgNS,tag);Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,v));return n};
function confirmed(m){
 const live=liveMasks[m.id]??liveMasks[m.asset];
 const accepted=Array.isArray(live)?live:live?.masks;
 const valid=items=>(items||[]).flatMap(p=>{
   if(typeof p?.label!=='string'||(p.status&&p.status!=='approved'))return [];
   try{const polygon=maskGeometry.cleanPolygon(p.polygon);return polygon?.length>=3?[{...p,polygon}]:[]}catch{return []}
 });
 const reviewed=valid(accepted);
 return reviewed.length?reviewed:valid(m.masks);
}
let scanId=0;
function silhouettes(m,interactive=false){
 const svg=createSVG('svg',{viewBox:'0 0 100 100',preserveAspectRatio:'none',class:'mask-map',...(!interactive?{'aria-hidden':'true'}:{})});
 confirmed(m).forEach((p,i)=>{
  const poly=createSVG('polygon',{points:(maskGeometry.svgPointData?.(p.polygon)||p.polygon.map(v=>v.join(',')).join(' ')),'data-color':i%4,class:'device-mask'+(interactive&&i===activePin?' is-selected':'')});
  if(interactive){poly.setAttribute('tabindex','0');poly.setAttribute('role','button');poly.setAttribute('aria-label',p.label);poly.setAttribute('aria-pressed',String(i===activePin));poly.onclick=()=>selectMask(i,true);poly.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selectMask(i,true)}}}
  svg.append(poly);
  if(interactive){
   const id='device-scan-'+(++scanId), clip=createSVG('clipPath',{id});clip.append(createSVG('polygon',{points:poly.getAttribute('points')}));svg.append(clip);
   const scan=createSVG('g',{'clip-path':'url(#'+id+')','aria-hidden':'true',class:'mask-scan'});
   scan.append(createSVG('rect',{x:'0',y:'-12',width:'100',height:'4',class:'scan-light'}));
   svg.append(scan);
  }
 });return svg
}
function selectMedia(i,scroll=false){
 media=i;activePin=0;renderMedia();
 $('exampleBar').querySelector('button').setAttribute('aria-pressed',String(i===0));
 [...$('caseTabs').children].forEach((n,k)=>n.setAttribute('aria-pressed',String(i===k+1)));
 if(scroll){$('caseTitle').focus({preventScroll:true});$('caseTitle').closest('.story').scrollIntoView({behavior:rm()?'instant':'smooth',block:'center'})}
}
function renderType(){
 const t=types[choice],guide=t.media.find(m=>m.id.startsWith('guide'));
 mediaSet=[{...guide,masks:manufacturerMasks[guide.id]||[]},...gallery.filter(c=>c.type===t.id).map(c=>({...c,kind:'실제 설치 현장',provenance:'티링크 공식 설치 갤러리'}))];
 document.querySelectorAll('.select-type').forEach((b,i)=>b.setAttribute('aria-pressed',String(i===choice)));
 $('detailHeading').textContent=t.name+' 설치 사례';$('detailIntro').textContent=t.intro;
 $('exampleBar').replaceChildren(button('제조사 설치 예시 보기',()=>selectMedia(0,true),'example-toggle',true));
 $('caseTabs').replaceChildren(...mediaSet.slice(1).map((m,j)=>{
   const thumb=button(undefined,()=>selectMedia(j+1,true),'case-thumb',false),frame=el('span',undefined,'thumb-frame'),photo=el('img');photo.src='/assets/'+m.asset;photo.alt='';photo.loading='lazy';frame.append(photo,silhouettes(m));thumb.append(frame,el('span',m.name,'thumb-label'));return thumb
 }));
 $('featureList').replaceChildren(...t.features.map(([title,text])=>{const d=el('div');d.append(el('dt',title),el('dd',text));return d}));
 renderMedia();
}
function renderMedia(){
 const m=mediaSet[media];
 const src='/assets/'+m.asset;if(casePhoto.getAttribute('src')!==src){imageBox.dataset.loading='true';casePhoto.src=src}casePhoto.alt=m.alt||m.name;
 $('proofBadge').textContent=m.kind||'';$('caseTitle').textContent=m.name;$('caseTitle').tabIndex=-1;$('caseIntro').textContent=m.intro||'';
 renderMasks();
}
function renderMasks(){
 const m=mediaSet[media], masks=confirmed(m),p=masks[activePin];
 $('pinLayer').replaceChildren(silhouettes(m,true));
 $('pinList').replaceChildren(...masks.map((v,i)=>{const b=button(v.label,()=>selectMask(i,false),'mask-key',i===activePin);b.dataset.color=i%4;return b}));
 $('pinDetail').replaceChildren(...(p?[el('strong',p.label),el('p',p.text||'')]:[]));
}
function selectMask(i,svg){activePin=i;renderMasks();(svg?$('pinLayer').querySelectorAll('.device-mask')[i]:$('pinList').children[i])?.focus({preventScroll:true});}
casePhoto.addEventListener('load',()=>{if(!casePhoto.naturalWidth||!casePhoto.naturalHeight)return;const ratio=casePhoto.naturalWidth/casePhoto.naturalHeight;imageBox.style.setProperty('--img-size',Math.min(640,422*ratio)+'px');imageBox.style.setProperty('--img-ratio',String(ratio));delete imageBox.dataset.loading});
casePhoto.addEventListener('error',()=>{imageBox.dataset.loading='true'});
function sync(){const i=types.findIndex(t=>'#'+t.id===location.hash);choose(i<0?2:i,false)}
$('typeGrid').append(...types.map(mkType));sync();window.addEventListener('popstate',sync);
