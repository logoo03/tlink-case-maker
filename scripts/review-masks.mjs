import {readFile,writeFile} from 'node:fs/promises';
import {gallery} from '../public/gallery-data.js';
import {manufacturerMasks} from '../public/manufacturer-masks.js';
import {cleanPolygon} from '../public/masks.js';
const official=[...Object.entries(manufacturerMasks).filter(([k])=>k.startsWith('guide')).map(([id,masks],i)=>({id,masks,asset:'rec-install-'+(i+1)+'.jpg'})),...gallery];
function inside(X,Y,p){let c=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const [x,y]=p[i],[u,v]=p[j];if((y>Y)!==(v>Y)&&X<x+(Y-y)*(u-x)/(v-y))c=!c;}return c;}
function measure(a,b){let intersection=0,union=0,covered=0,spill=0,na=0,nb=0;for(let x=.5;x<100;x+=.5)for(let y=.5;y<100;y+=.5){const i=inside(x,y,a),j=inside(x,y,b);na+=i;nb+=j;intersection+=i&&j;union+=i||j;covered+=i&&!j;spill+=j&&!i;}return [intersection/(union||1),covered/(na||1),spill/(nb||1)];}
const rows=[];
for(const pic of official){
 let data;try{data=JSON.parse(await readFile(new URL('../outputs/mask-candidates/'+pic.id+'.json',import.meta.url),'utf8'))}catch{continue}
 const found=(data.points||[]).map(x=>({name:x.label,polygon:cleanPolygon(x.polygon)})).filter(x=>x.polygon);
 const best=pic.masks.map((p,i)=>({manual:i,ranked:found.map((c,j)=>({candidate:j,...Object.fromEntries(['iou','miss','spill'].map((k,l)=>[k,measure(p.polygon,c.polygon)[l]]))})).sort((a,b)=>b.iou-a.iou)}));
 rows.push({id:pic.id,pic,found,best});
 console.log(pic.id,best.map((b,i)=>{const c=b.ranked[0];return i+': '+(c?c.candidate+' '+[c.iou,c.miss,c.spill].map(x=>Math.round(100*x)+'%').join('/'):'none')}).join(' | '),found.map(s=>s.name).join(' / '));
}
if(process.argv.includes('--save-candidates')){
 const all=Object.fromEntries(rows.map(r=>[r.id,r.found.map(c=>c.polygon)]));await writeFile(new URL('../outputs/mask-candidates/aggregate.json',import.meta.url),JSON.stringify(all,null,2));
}
if(process.argv.includes('--apply')){
 // IDs are explicitly allowed only after browser side-by-side comparison.
 const accepted=process.argv.slice(2).filter(v=>v.includes(':'));
 const out={};
 for(const line of accepted){
  const [id,...choices]=line.split(':');const row=rows.find(r=>r.id===id);if(!row)throw Error('잘못된 사례 '+id);
  const masks=row.pic.masks.map(p=>({...p}));
  choices.forEach(choice=>{const [manual,ai]=choice.split('=').map(Number);const candidate=row.found[ai],score=row.best[manual]?.ranked.find(c=>c.candidate===ai);if(!candidate||!score||score.iou<.50)throw Error('일치도가 충분하지 않은 마스크: '+line);masks[manual]={...masks[manual],polygon:candidate.polygon};});
  out[id]=masks;
 }
 await writeFile(new URL('../public/live-masks.js',import.meta.url),'// 공개 공식 사진에 대한 OpenAI 윤곽 중 수동 대조를 통과한 좌표.\nexport const liveMasks='+JSON.stringify(out,null,2)+';\n');
 console.log('published to local cache only:',Object.keys(out).length);
}
