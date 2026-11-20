import {publicPoints} from './content.js';
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
 type(ctx,'설치 엑스레이',M+178,77,{size:29,weight:650,color:fg});line(ctx,137,rule);
 line(ctx,1211,rule);type(ctx,'T·LINK  /  FIELD PROOF',M,1249,{size:24,weight:700,color:dark?'#c3d0c0':muted});
 type(ctx,String(number).padStart(2,'0')+' / 03',END-94,1244,{size:28,weight:780,color:dark?green:fg});
 return {el,ctx};
}
function loadImage(src){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('사진을 불러올 수 없습니다.'));img.src=src})}
function drawImage(ctx,img,x,y,w,h){
 const scale=Math.min(w/img.naturalWidth,h/img.naturalHeight),dw=img.naturalWidth*scale,dh=img.naturalHeight*scale,dx=x+(w-dw)/2,dy=y+(h-dh)/2;
 ctx.drawImage(img,dx,dy,dw,dh);return {x:dx,y:dy,w:dw,h:dh};
}
function mark(ctx,color,x,y,r=24){
 ctx.save();ctx.shadowColor=color;ctx.shadowBlur=17;ctx.beginPath();ctx.arc(x,y,r*.63,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();ctx.restore();
 ctx.beginPath();ctx.arc(x,y,r*.64,0,Math.PI*2);ctx.strokeStyle='#142325';ctx.lineWidth=5;ctx.stroke();
 ctx.beginPath();ctx.arc(x,y,r*.52,0,Math.PI*2);ctx.strokeStyle='#f7fff8';ctx.lineWidth=2;ctx.stroke();
}

export async function renderCards(scene,copy){
 const img=await loadImage(scene.src);
 const first=card(1,true),second=card(2),third=card(3);
 let c=first.ctx;
 rect(c,M,229,102,7,green);
 type(c,'도입 전에 묻습니다',M,272,{size:31,weight:750,color:green});
 let h=block(c,copy.title||scene.title,M,347,{size:110,min:62,max:6,limit:420,line:1.08,weight:850,color:paper});
 const leadY=Math.max(790,347+h+49);
 block(c,copy.lead||scene.description,M,leadY,{size:39,min:31,max:5,limit:290,line:1.4,color:'#d0dacd'});
 type(c,'다음 장에서 설치 사진 보기  →',M,1127,{size:31,weight:720,color:green});

 c=second.ctx;
 block(c,'사진 속 장비',M,171,{size:61,min:46,max:1,weight:850});
 const photo={x:M,y:260,w:END-M,h:510};
 rect(c,photo.x,photo.y,photo.w,photo.h,ink);
 const frame=drawImage(c,img,photo.x+14,photo.y+14,photo.w-28,photo.h-28);
 const points=publicPoints(scene);
 points.forEach(p=>mark(c,p.color,frame.x+frame.w*clamp(p.x,0,100)/100,frame.y+frame.h*clamp(p.y,0,100)/100,28));
 block(c,scene.id?'티링크 공식 설치 사진':'현장 설치 사진',M,792,{size:25,min:21,max:1,color:muted});
 if(points.length)points.forEach((p,i)=>{
   const small=points.length>2,x=M+(small?(i%2)*468:0),y=870+(small?Math.floor(i/2):i)*148,width=small?386:END-M-55;
   mark(c,p.color,x+20,y+20,19);
   block(c,p.label,x+51,y,{size:32,min:26,max:1,weight:800,width});
   block(c,p.text,x+51,y+42,{size:28,min:23,max:small?3:2,color:muted,width});
 });
 else block(c,'설명점이 없는 현장 사진입니다.',M,890,{size:35,min:29,max:2,color:muted});

 c=third.ctx;
 rect(c,M,196,103,7,blue);
 type(c,'공식 제품 자료',M,241,{size:30,weight:750,color:blue});
 let title=copy.key==='mobile'?'사무실과 외근의 기록을 한곳에':copy.key==='summary'?'다시 듣는 대신, 핵심부터':'현장에 맞는 설치 방법';
 h=block(c,title,M,306,{size:79,min:65,weight:850,max:2,line:1.14});
 block(c,copy.fact||copy.lead,M,343+h,{size:41,min:33,max:6,line:1.35,color:muted});
 const boxY=820;rect(c,M,boxY,END-M,265,green);
 type(c,'티링크 설치 상담  →',M+34,boxY+34,{size:45,weight:850});
 block(c,copy.ask||'현장과 통신 환경을 알려주세요.',M+35,boxY+110,{size:36,min:28,max:3,width:END-M-66,weight:650});
 type(c,'tlinkcrm.com/center.php',M+35,boxY+216,{size:25,weight:750});
 block(c,(copy.sourceLabel||'공식 자료')+'  ·  '+String(copy.source||'tlinkcrm.com/case.php').replace(/^https:\/\/(www\.)?/,''),M,1123,{size:24,min:21,max:2,color:muted});
 if(copy.extra)block(c,'상품 옵션  ·  '+String(copy.extra).replace(/^https:\/\/(www\.)?/,''),M,1164,{size:22,min:20,max:1,color:muted});
 return [first.el,second.el,third.el];
}

const TABLE=new Uint32Array(256);
for(let i=0;i<256;i++){let c=i;for(let bit=0;bit<8;bit++)c=c&1?0xedb88320^(c>>>1):c>>>1;TABLE[i]=c>>>0}
function crc32(bytes){let c=0xffffffff;for(const byte of bytes)c=TABLE[(c^byte)&255]^(c>>>8);return (c^0xffffffff)>>>0}
export function zipStored(files){
 const encoder=new TextEncoder(),parts=[],central=[];
 let offset=0,centralSize=0;
 for(const {name,bytes} of files){
   const label=encoder.encode(name),crc=crc32(bytes),local=new Uint8Array(30+label.length),l=new DataView(local.buffer);
   l.setUint32(0,0x04034b50,true);l.setUint16(4,20,true);l.setUint16(6,0x800,true);l.setUint16(12,0x21,true);l.setUint32(14,crc,true);
   l.setUint32(18,bytes.length,true);l.setUint32(22,bytes.length,true);l.setUint16(26,label.length,true);local.set(label,30);
   const entry=new Uint8Array(46+label.length),e=new DataView(entry.buffer);
   e.setUint32(0,0x02014b50,true);e.setUint16(4,20,true);e.setUint16(6,20,true);e.setUint16(8,0x800,true);e.setUint16(14,0x21,true);e.setUint32(16,crc,true);
   e.setUint32(20,bytes.length,true);e.setUint32(24,bytes.length,true);e.setUint16(28,label.length,true);e.setUint32(42,offset,true);entry.set(label,46);
   parts.push(local,bytes);central.push(entry);offset+=local.length+bytes.length;centralSize+=entry.length;
 }
 const end=new Uint8Array(22),v=new DataView(end.buffer);
 v.setUint32(0,0x06054b50,true);v.setUint16(8,files.length,true);v.setUint16(10,files.length,true);v.setUint32(12,centralSize,true);v.setUint32(16,offset,true);
 return new Blob([...parts,...central,end],{type:'application/zip'});
}
const png=canvas=>new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('카드 PNG를 만들 수 없습니다.')),'image/png'));
export async function downloadCards(scene,copy){
 const canvas=await renderCards(scene,copy),names=['01-question.png','02-field-photo.png','03-consultation.png'];
 const files=await Promise.all(canvas.map(async (el,index)=>({name:names[index],bytes:new Uint8Array(await (await png(el)).arrayBuffer())})));
 const zip=zipStored(files),url=URL.createObjectURL(zip),a=document.createElement('a');
 a.href=url;a.download='tlink-instagram-cards.zip';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
 return zip;
}
