export const HEX=['#ff9e57','#57e2d1','#83b9f5','#f2e480'], MAX_MASKS=4, MAX_VERTICES=16;
export const clampPercent=n=>Math.round(Math.min(100,Math.max(0,n))*100)/100;
export const sanitize=(v,n)=>typeof v==='string'?v.replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,n):'';
const equals=(a,b)=>a[0]===b[0]&&a[1]===b[1];
function overlap(a,b,c,d){
 const sign=(p,q,r)=>(q[0]-p[0])*(r[1]-p[1])-(r[0]-p[0])*(q[1]-p[1]);
 const x=sign(a,b,c),y=sign(a,b,d),z=sign(c,d,a),w=sign(c,d,b);
 const inside=(p,q,r)=>r[0]>=Math.min(p[0],q[0])&&r[0]<=Math.max(p[0],q[0])&&r[1]>=Math.min(p[1],q[1])&&r[1]<=Math.max(p[1],q[1]);
 if(x===0&&inside(a,b,c)||y===0&&inside(a,b,d)||z===0&&inside(c,d,a)||w===0&&inside(c,d,b))return true;
 return x*y<0&&z*w<0;
}
export function cleanPolygon(points){
 if(!Array.isArray(points)||points.length<3||points.length>MAX_VERTICES+1||!points.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)))return null;
 const v=points.map(p=>p.map(clampPercent));if(equals(v[0],v.at(-1)))v.pop();
 if(v.length<3||v.length>MAX_VERTICES||new Set(v.map(x=>x.join(','))).size!==v.length)return null;
 let area=0;
 for(let i=0;i<v.length;i++){
  const a=v[i],b=v[(i+1)%v.length];area+=a[0]*b[1]-a[1]*b[0];
  for(let j=i+2;j<v.length;j++){if(i===0&&j===v.length-1)continue;if(overlap(a,b,v[j],v[(j+1)%v.length]))return null;}
 }
 return Math.abs(area)>2?v:null;
}
export function enrichMasks(masks,origin='template'){
 return (Array.isArray(masks)?masks:[]).slice(0,MAX_MASKS).flatMap((p,i)=>{
  const polygon=cleanPolygon(p.polygon),label=sanitize(p.label,48),customerText=sanitize(p.text??p.seen??p.customerText,200);
  return polygon&&label&&customerText?[{id:origin+'-'+i,label,customerText,polygon,status:origin==='OpenAI'?'candidate':'draft',origin}]:[];
 });
}
export function approveMasks(masks){
 if(!Array.isArray(masks)||!masks.length||masks.length>MAX_MASKS)throw Error('설명할 장비 윤곽을 1~4개 추가하세요.');
 return masks.map((p,i)=>{
  if(p.status!=='draft')throw Error('미검토 AI 후보는 작업 목록으로 가져온 뒤 승인하세요.');
  const polygon=cleanPolygon(p.polygon),label=sanitize(p.label,48),customerText=sanitize(p.customerText,200);
  if(!polygon)throw Error((i+1)+'번째 윤곽의 꼭짓점이 겹치거나 교차합니다. 사진에서 수정하세요.');
  if(!label||!customerText)throw Error((i+1)+'번째 장비의 이름과 공개 설명을 모두 입력하세요.');
  return {id:p.id,label,customerText,polygon,status:'approved'};
 });
}

export const svgPointData=polygon=>polygon.map(pair=>pair.join(',')).join(' ');
