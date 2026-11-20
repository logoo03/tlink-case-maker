import {mountModel} from './install-3d.js';
import {angles,escapeHTML as esc} from './content.js';
import {zipStored} from './cards.js';
const W=1080,H=1350,M=78,END=W-M,FONT='"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif';
const ink='#17251c',paper='#f3f4e8',green='#d2f759',muted='#526456',blue='#213b2b';
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));

function type(ctx,text,x,y,{size=34,weight=500,color=ink}={}){
 ctx.fillStyle=color;ctx.font=weight+' '+size+'px '+FONT;ctx.textBaseline='top';ctx.fillText(text,x,y);
}
function wrap(ctx,text,width){
 const out=[];
 for(const para of String(text??'').trim().split(/\n/)){
   if(!para.trim()){out.push('');continue}
   let line='';
   for(const word of para.trim().split(/\s+/)){
     const join=(line?line+' ':'')+word;
     if(ctx.measureText(join).width<=width){line=join;continue}
     if(line){out.push(line);line=''}
     for(const char of word){if(line&&ctx.measureText(line+char).width>width){out.push(line);line=char}else line+=char}
   }
   if(line)out.push(line);
 }
 return out;
}
function block(ctx,text,x,y,{width=END-M,size=42,min=size,max=4,limit=Infinity,weight=500,color=ink,line=1.34}={}){
 let lines;
 for(;size>=min;size-=2){ctx.font=weight+' '+size+'px '+FONT;lines=wrap(ctx,text,width);if(lines.length<=max&&lines.length*size*line<=limit)break}
 size=Math.max(size,min);max=Math.min(max,Math.max(1,Math.floor(limit/(size*line))));ctx.font=weight+' '+size+'px '+FONT;
 if(lines.length>max){lines=lines.slice(0,max);let tail=lines[max-1];while(tail&&ctx.measureText(tail+'…').width>width)tail=tail.slice(0,-1);lines[max-1]=tail+'…'}
 lines.forEach((row,i)=>type(ctx,row,x,y+i*size*line,{size,weight,color}));return lines.length*size*line;
}
function line(ctx,y,color){ctx.fillStyle=color;ctx.fillRect(M,y,END-M,2)}
function rect(ctx,x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(x,y,w,h)}
function card(number,dark=false){
 const el=document.createElement('canvas');el.width=W;el.height=H;
 const ctx=el.getContext('2d');const fg=dark?paper:ink, rule=dark?'#55725a':'#b9c4ac';
 rect(ctx,0,0,W,H,dark?ink:paper);
 type(ctx,'T·LINK',M,71,{size:39,weight:850,color:dark?green:fg});
 type(ctx,'케이스메이커',M+178,77,{size:29,weight:650,color:fg});line(ctx,137,rule);
 line(ctx,1211,rule);type(ctx,'티링크 · 설치 가이드',M,1249,{size:24,weight:700,color:dark?'#c3d0c0':muted});
 type(ctx,String(number).padStart(2,'0')+' / 03',END-94,1244,{size:28,weight:780,color:dark?green:fg});
 return {el,ctx};
}
function loadImage(src){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('사진을 불러올 수 없습니다.'));img.src=src})}
function drawImage(ctx,img,x,y,w,h){
 const scale=Math.min(w/img.naturalWidth,h/img.naturalHeight),dw=img.naturalWidth*scale,dh=img.naturalHeight*scale,dx=x+(w-dw)/2,dy=y+(h-dh)/2;
 ctx.drawImage(img,dx,dy,dw,dh);return {x:dx,y:dy,w:dw,h:dh};
}
export const maskColors=['#ff9e57','#57e2d1','#83b9f5','#f2e480'];
const approved=masks=>(Array.isArray(masks)?masks:[]).filter(m=>m?.status==='approved'&&typeof m.label==='string'&&m.label.trim()&&Array.isArray(m.polygon)&&m.polygon.length>=3&&m.polygon.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite))).slice(0,4).map((m,i)=>({label:m.label.trim(),text:String(m.customerText??'').trim(),polygon:m.polygon.map(p=>p.map(n=>clamp(n,0,100))),color:maskColors[i]}));
const topics={install:'녹취 장비, 우리 사무실 어디에 둘까요?',mobile:'사무실 밖에서 받은 전화도 한곳에 모을 수 있나요?',summary:'지난 통화, 다시 듣지 않고 확인할 수 있나요?'};
export function buildCopy(masks,{angle='install',headline,lead,brief}={}){
 const key=Object.hasOwn(angles,angle)?angle:'install',a=angles[key],evidence=approved(masks),short=/짧|간결|한 줄/.test(String(brief||''));
 const approvedText=evidence.map(m=>m.text).filter(Boolean).slice(0,short?1:2).join(' ');
 // Optional headline and lead are presentation instructions, not new factual copy.
 const declared=/서술|문장|명사형/.test(String(headline||''));
 return {key,title:declared?({install:'공간에 맞춘 기업 녹취 설치',mobile:'사무실과 외근 통화 기록을 한곳에',summary:'통화 내용은 글로, 필요한 대화는 빠르게'}[key]):topics[key],lead:/정보 먼저|제품 먼저/.test(String(lead||''))||!approvedText?a.fact:approvedText,fact:a.fact,ask:a.ask,source:a.source,sourceLabel:a.sourceLabel,extra:a.extra};
}
export function exportHTML({src,caption='설치 현장',masks,copy,modelSource=''}){
 if(!/^data:image\/(?:jpeg|png|webp);base64,[a-z\d+/]+={0,2}$/i.test(src))throw Error('HTML에 포함할 사진의 데이터 URL이 필요합니다.');
 const items=approved(masks);
 const polys=items.map((m,i)=>'<a href="#mask-'+(i+1)+'" aria-label="'+esc(m.label)+'"><polygon points="'+m.polygon.map(p=>p.join(',')).join(' ')+'" style="--accent:'+m.color+'"></polygon></a>').join('');
 const details=items.map((m,i)=>'<article id="mask-'+(i+1)+'"><h3><i style="--accent:'+m.color+'"></i>'+esc(m.label)+'</h3><p>'+esc(m.text)+'</p></article>').join('');
 const titles=['스탠드형','랙 거치형','미러링 스위치 허브'],forms=['책상 위 독립 본체','기존 서버 랙 활용','좁은 공간의 소형 스위치'];
 const models=['stand','rack','mirror'].map((k,i)=>'<article><h3>'+titles[i]+'</h3><p>'+forms[i]+'</p><canvas data-model="'+k+'" tabindex="0" aria-label="'+titles[i]+' 모형, 화살표로 회전" width="640" height="400"></canvas></article>').join('');
 const safe=modelSource.replace(/^export\s+/gm,'').replace(/<\/script/gi,'<\\/script');
 const js=safe?'<'+'script>'+safe+';for(const c of document.querySelectorAll("[data-model]")) mountModel(c,c.dataset.model);</'+'script>':'';
 return '<!DOCTYPE html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(copy.title)+' | 티링크 케이스메이커</title><style>*{box-sizing:border-box}body{margin:0;color:#edf2ed;background:#151b1a;font:16px/1.62 system-ui,sans-serif;word-break:keep-all}h1,h2,h3,p{margin:0}a{color:inherit;text-underline-offset:.24em}.shell{width:min(1120px,calc(100% - 48px));margin:auto}header{border-bottom:1px solid #50635b;padding:19px 0;font-weight:760;letter-spacing:.055em}.hero{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,.9fr);min-height:calc(100svh - 65px);gap:clamp(26px,5vw,66px);align-items:center;padding-block:55px}.hero-photo{width:100%;justify-self:end;margin:0;display:grid;align-items:center;justify-items:end}.hero-photo .frame{width:min(100%,510px);max-width:100%;margin:0}.hero-photo img{width:100%;max-width:510px;max-height:none;height:auto}.hero-copy .labels{gap:5px 22px;margin-top:28px}.hero-copy .labels article p{margin:5px 0 0;font-size:.92rem}.hero-copy .labels article:target{background:#33443b}.hero h1{font-size:clamp(3rem,8vw,6.5rem);line-height:1;letter-spacing:-.048em;max-width:12ch;text-wrap:balance}.hero p{margin-top:24px;color:#c9d6cc;max-width:54ch;font-size:clamp(1rem,2vw,1.3rem)}.evidence{background:#eaece5;color:#172420;padding:55px 0}.section-title{font-size:clamp(2rem,4vw,3.55rem);line-height:1.08;letter-spacing:-.035em;margin-bottom:24px}.frame{position:relative;width:fit-content;margin:auto;max-width:100%}.frame img{display:block;max-width:100%;max-height:625px}.frame svg{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}.frame polygon{fill:var(--accent);fill-opacity:.38;stroke:var(--accent);stroke-width:1.3;vector-effect:non-scaling-stroke;pointer-events:auto}.frame a:focus-visible polygon,.frame a:hover polygon{fill-opacity:.68;stroke:white}.stage{padding:12px;background:#24312c}.labels{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 30px;margin-top:20px}.labels article{padding:13px 0;border-top:1px solid #8f9d90}.labels article:target{background:#d8e4d4}.labels i{display:inline-block;background:var(--accent);width:.7em;height:.7em;border-radius:100%;border:1px solid #43574d;margin-right:.6em}.models,.contact{padding:55px 0}.models-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:18px}.models-grid article{border:1px solid #56675e;padding:12px}.models-grid canvas{width:100%;height:190px;display:block;background:#25342e;touch-action:none;cursor:grab}.models-grid h3{margin:0 0 3px}.models-grid p{margin-bottom:12px}.models-grid p,.models-note{color:#c5d3c8}.contact{border-top:1px solid #5b6a61}.contact p{margin-bottom:10px;max-width:65ch}.cta{display:inline-block;padding:10px 16px;background:#d2f759;color:#192524;font-weight:775;margin:12px 0}.frame svg{animation:reveal .55s ease-out both}@keyframes reveal{from{opacity:0}to{opacity:1}}.hero>*{animation:rendezvous .62s ease-out both}.hero p{animation-delay:.09s}.cta{transition:transform .18s ease}.cta:hover{transform:translateY(-2px)}.cta:active{transform:translateY(1px)}@keyframes rendezvous{from{opacity:.5;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}}.outline:focus-visible,canvas:focus-visible{outline:3px solid #d2f759;outline-offset:4px}@media(max-width:670px){.shell{width:calc(100% - 30px)}.hero{min-height:auto;grid-template-columns:1fr;padding-block:48px;gap:25px}.hero-photo{justify-items:start}.hero-photo .frame{max-width:100%}.labels,.models-grid{grid-template-columns:1fr}}</style><body><header><div class="shell">T·LINK / 케이스메이커</div></header><main><section class="hero shell"><div class="hero-copy"><h1>'+esc(copy.title)+'</h1><p>'+esc(copy.lead)+'</p>'+(details?'<div class="labels" aria-label="사진 속 장비">'+details+'</div>':'')+'</div><figure class="hero-photo"><div class="frame"><img alt="'+esc(caption)+'" src="'+esc(src)+'"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="사진 속 장비">'+polys+'</svg></div></figure></section>'+ (js?'<section class="models shell"><h2 class="section-title">우리 공간에는 어떤 방식이 맞을까요?</h2><p class="models-note">드래그로 돌려 보기 · 휠로 확대·축소 · 설치 형태를 보여 주는 모형</p><div class="models-grid">'+models+'</div></section>':'') +'<section class="contact shell"><h2 class="section-title">도입 전에 확인하세요</h2><p>'+esc(copy.fact)+'</p><p>'+esc(copy.ask)+'</p><a class="cta" href="https://www.tlinkcrm.com/center.php">티링크 설치 상담 ↗</a><br><a href="'+esc(copy.source)+'">'+esc(copy.sourceLabel)+'</a></section></main>'+js+'</body></html>';

}
async function modelPictures(ctx){
 const nodes=['stand','rack','mirror'].map((type,i)=>{
  const canvas=document.createElement('canvas');canvas.style.cssText='position:fixed;left:-1600px;top:0;width:300px;height:248px';
  document.body.append(canvas);return {canvas,model:mountModel(canvas,type),i};
 });
 try{await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  nodes.forEach(({canvas,i})=>{const x=M+i*314;rect(ctx,x,357,296,248,'#263831');ctx.drawImage(canvas,x,357,296,248);type(ctx,['스탠드형','랙 거치형','미러링 스위치 허브'][i],x,625,{size:28,weight:790})});
 }finally{nodes.forEach(({canvas,model})=>{model?.destroy();canvas.remove()})}
}
export async function renderMarketingCards({src,caption='설치 현장',masks,copy}){
 const img=await loadImage(src),a=card(1,true),b=card(2),d=card(3),items=approved(masks);
 let c=a.ctx;
 rect(c,M,237,85,7,green);type(c,'설치 가이드',M,277,{size:33,weight:760,color:green});
 block(c,copy.title,M,355,{size:102,min:58,max:5,limit:415,weight:850,color:paper});
 block(c,copy.lead,M,786,{size:42,min:33,max:5,limit:290,color:'#d0dacd'});type(c,'다음 장에서 실제 설치 사진 보기  →',M,1125,{size:30,color:green});
 c=b.ctx;block(c,'실제 설치 현장',M,171,{size:61,weight:850});
 rect(c,M,258,END-M,540,ink);
 const f=drawImage(c,img,M+12,270,END-M-24,516);
 items.forEach(({polygon,color})=>{c.beginPath();polygon.forEach(([x,y],i)=>c[i?'lineTo':'moveTo'](f.x+f.w*x/100,f.y+f.h*y/100));c.closePath();c.fillStyle=color+'65';c.fill();c.strokeStyle=color;c.lineWidth=4;c.stroke()});

 items.forEach((m,i)=>{const x=M+(i%2)*468,y=876+Math.floor(i/2)*152;rect(c,x,y+3,12,30,m.color);block(c,m.label,x+24,y,{size:32,min:26,max:1,width:423,weight:800});block(c,m.text,x+24,y+42,{size:27,min:21,max:3,width:423,color:muted})});
 c=d.ctx;block(c,'공간에 맞는 설치를 찾으세요',M,180,{size:64,min:50,max:2,weight:850});
 await modelPictures(c);
 block(c,copy.fact,M,694,{size:31,min:24,max:3,limit:112,color:muted});
 rect(c,M,822,END-M,238,green);type(c,'티링크 설치 상담 ↗',M+31,849,{size:48,weight:835});
 block(c,copy.ask,M+31,923,{size:32,min:27,width:END-M-62,max:2});type(c,'tlinkcrm.com/center.php',M+31,1012,{size:25,weight:700});
 block(c,copy.sourceLabel+' · '+copy.source.replace(/^https:\/\/(www\.)?/,''),M,1127,{size:27,min:22,max:2,color:muted});return [a.el,b.el,d.el];
}
export async function downloadMarketingCards(arg){
 const canvases=await renderMarketingCards(arg),names=['01-question.png','02-annotated-installation.png','03-consultation.png'];
 const files=await Promise.all(canvases.map(async(c,i)=>({name:names[i],bytes:new Uint8Array(await (await new Promise((yes,no)=>c.toBlob(value=>value?yes(value):no(Error('PNG 변환 실패')),'image/png'))).arrayBuffer())})));
 const zip=zipStored(files),url=URL.createObjectURL(zip);const a=document.createElement('a');a.href=url;a.download='tlink-installation-cards.zip';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);return zip;
}
