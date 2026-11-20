import {HEX,MAX_MASKS,MAX_VERTICES,clampPercent,cleanPolygon,svgPointData} from './masks.js';
const NS='http://www.w3.org/2000/svg';
const one=(tag,a={})=>{const n=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(a))n.setAttribute(k,v);return n};
const fmt=svgPointData;
export function mountMaskEditor(svg,{onUpdate,onSelection,onMessage}){
 let shapes=[],selected=-1,drawing=null,drag=null,history=[],preview=null;
 const snapshot=()=>({shapes:structuredClone(shapes),selected});
 const remember=()=>{history.push(snapshot());if(history.length>30)history.shift()};
 const clamp=clampPercent;
 function point(e){const r=svg.getBoundingClientRect();return [clamp(100*(e.clientX-r.left)/r.width),clamp(100*(e.clientY-r.top)/r.height)]}
 function render(){
  svg.classList.toggle('is-drawing',Boolean(drawing));
  const children=[];
  shapes.forEach((p,i)=>{
   const color=HEX[i],selectedNow=i===selected,outline=one('polygon',{points:fmt(p.polygon),'data-mask':i,'class':'drawn-mask'+(selectedNow?' selected':''),style:'--mask:'+color+(cleanPolygon(p.polygon)?'':';--mask:#ff6969')});
   children.push(outline);
   if(selectedNow)p.polygon.forEach(([x,y],j)=>children.push(one('circle',{'data-vtx':j,'aria-label':(j+1)+'번째 꼭짓점. 화살표로 이동, Delete로 삭제',role:'button',tabindex:0,cx:x,cy:y,r:1.35,class:'handle',style:'--mask:'+color})));
  });
  if(drawing){children.push(one('polyline',{points:fmt(drawing),class:'open-line'}));drawing.forEach(([x,y],i)=>children.push(one('circle',{cx:x,cy:y,r:1.08,class:'open-handle','data-close':i===0?'yes':'no'})));}
  if(preview&&!drawing)children.push(one('polygon',{points:fmt(preview.polygon),class:'candidate-ghost','aria-hidden':'true'}));
  svg.replaceChildren(...children);
 }
 function update(choose=false){render();onUpdate(shapes,{drawing:Boolean(drawing),draftSize:drawing?.length||0,undo:history.length>0,selected});if(choose)onSelection(selected)}
 function select(i){selected=i;update(true)}
 function add(p){
  if(shapes.length>=MAX_MASKS){onMessage('윤곽은 최대 네 개까지 추가할 수 있습니다.');return false}
  remember();shapes.push(structuredClone(p));selected=shapes.length-1;drawing=null;update(true);return true;
 }
 function finish(){
  if(!drawing)return;
  const poly=cleanPolygon(drawing);
  if(!poly){onMessage('겹치지 않는 꼭짓점 세 개 이상을 순서대로 추가하세요.');return;}
  if(add({id:crypto.randomUUID(),polygon:poly,label:'',customerText:'',origin:'manual',status:'draft'}))onMessage('윤곽을 만들었습니다. 장비 이름과 공개 설명을 입력하세요.');
 }
 svg.addEventListener('pointerdown',e=>{
  if(e.button!==0)return;
  if(drawing){e.preventDefault();if(e.target.dataset.close==='yes'&&drawing.length>=3){finish();return}if(drawing.length<MAX_VERTICES){drawing.push(point(e));update();}return;}
  const item=e.target.dataset.mask,vt=e.target.dataset.vtx;
  if(item===undefined&&vt===undefined)return;
  if(item!==undefined&&selected!==Number(item))select(Number(item));
  if(selected<0)return;
  const [x,y]=point(e);drag={id:e.pointerId,vt:vt===undefined?-1:Number(vt),start:[x,y],base:structuredClone(shapes[selected].polygon),before:snapshot(),changed:false};
  svg.setPointerCapture(e.pointerId);e.preventDefault()
 });
 svg.addEventListener('pointermove',e=>{
  if(!drag||drag.id!==e.pointerId)return;
  const pos=point(e),dx=pos[0]-drag.start[0],dy=pos[1]-drag.start[1];
  if(Math.abs(dx)+Math.abs(dy)<.1&&!drag.changed)return;drag.changed=true;
  if(drag.vt>=0)shapes[selected].polygon[drag.vt]=pos;
  else{
   const xs=drag.base.map(p=>p[0]),ys=drag.base.map(p=>p[1]);
   const mx=Math.max(-Math.min(...xs),Math.min(100-Math.max(...xs),dx)),my=Math.max(-Math.min(...ys),Math.min(100-Math.max(...ys),dy));
   shapes[selected].polygon=drag.base.map(([x,y])=>[clamp(x+mx),clamp(y+my)]);
  }
  render();
 });
 function end(e){if(!drag||drag.id!==e.pointerId)return;if(drag.changed){history.push(drag.before);if(history.length>30)history.shift()}drag=null;update();}
 svg.addEventListener('pointerup',end);svg.addEventListener('pointercancel',end);
 svg.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&drawing){drawing=null;update();return;}
  if(e.key==='Enter'&&drawing){e.preventDefault();finish();return;}
  const j=Number(e.target.dataset.vtx);if(!Number.isInteger(j)||selected<0)return;
  const p=shapes[selected].polygon,k=e.shiftKey?2:.5,step={ArrowUp:[0,-k],ArrowDown:[0,k],ArrowLeft:[-k,0],ArrowRight:[k,0]}[e.key];
  if(!step&&!['Delete','Backspace'].includes(e.key))return;
  e.preventDefault();if(!step&&p.length<=3){onMessage('윤곽에는 꼭짓점이 세 개 이상 필요합니다.');return}
  remember();if(step)p[j]=[clamp(p[j][0]+step[0]),clamp(p[j][1]+step[1])];else p.splice(j,1);update();
  svg.querySelector('[data-vtx="'+Math.min(j,p.length-1)+'"]')?.focus();
 });
 return {
  load(list){shapes=structuredClone(list);preview=null;history=[];drawing=null;selected=list.length?0:-1;update(true)},
  select,add,finish,
  preview(p){preview=p;render()},
  draw(){if(shapes.length>=MAX_MASKS){onMessage('윤곽은 최대 네 개입니다.');return;}drawing=[];update()},
  cancel(){drawing=null;update()},
  undo(){if(drawing){drawing.pop();update();return;}const x=history.pop();if(x){shapes=x.shapes;selected=x.selected;update(true)}},
  erase(){if(selected<0)return;remember();shapes.splice(selected,1);selected=shapes.length?Math.min(selected,shapes.length-1):-1;update(true)},
  patch(key,value){if(selected<0)return;shapes[selected][key]=value;onUpdate(shapes,{drawing:Boolean(drawing),draftSize:drawing?.length||0,undo:history.length>0,selected,panel:false})},
  shapes(){return structuredClone(shapes)}
 };
}
