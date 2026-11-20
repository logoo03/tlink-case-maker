// Local conceptual scenes. Geometry uses XYZ, perspective and depth-sorted faces, not photographs or CAD.
const orange='#ff6c22', orangeFront='#fb601c', edge='#191f27', steel='#3b4b59', grey='#687983', black='#11171b', gold='#e7a263';
const mix=(hex,a)=>'#'+hex.slice(1).match(/../g).map(v=>Math.round(Math.min(255,parseInt(v,16)*a)).toString(16).padStart(2,'0')).join('');
function scene(type){
 const faces=[],lines=[];
 function box(x,y,z,w,h,d,color,outline=true){
  const v=[[x-w/2,y-h/2,z-d/2],[x+w/2,y-h/2,z-d/2],[x+w/2,y+h/2,z-d/2],[x-w/2,y+h/2,z-d/2],[x-w/2,y-h/2,z+d/2],[x+w/2,y-h/2,z+d/2],[x+w/2,y+h/2,z+d/2],[x-w/2,y+h/2,z+d/2]];
  const sides=[[0,3,2,1],[4,5,6,7],[0,4,7,3],[1,2,6,5],[3,7,6,2],[0,1,5,4]];
  sides.forEach((s,i)=>faces.push({p:s.map(j=>v[j]),n:[[0,0,-1],[0,0,1],[-1,0,0],[1,0,0],[0,1,0],[0,-1,0]][i],c:mix(color,[.72,.99,.76,.87,1.23,.6][i]),stroke:outline?'rgba(14,22,30,.55)':null}));
 }
 function wire(points,color,width=3){for(let i=1;i<points.length;i++)lines.push({p:points.slice(i-1,i+1),c:color,w:width})}
 function grid(){
  for(let i=-12;i<=12;i++){const p=i*.17;const col=i===0?'#3e6176':'#223c4b';wire([[-2.04,-1.15,p],[2.04,-1.15,p]],col,1);wire([[p,-1.15,-2.04],[p,-1.15,2.04]],col,1)}
 }
 function vents(x,y,z,n=6){for(let i=0;i<n;i++)box(x+i*.071,y,z,.028,.145,.014,edge,false)}
 function ports(x,y,z,n=8,scale=1){for(let i=0;i<n;i++){const a=x+i*.14*scale;box(a,y,z,.102*scale,.076*scale,.022,black,false);box(a,y+.051*scale,z,.029,.013,.027,i%3?'#76e1af':'#e6d77b',false)}}
 grid();
 if(type==='stand'){
  // Compact desktop server: the underside rests on the desk plane.
  box(0,-.21,0,2.42,.14,1.39,grey);
  for(const x of [-1.05,1.05])for(const z of [-.54,.54])box(x,-.70,z,.079,.88,.078,steel);
  box(-.32,.242,.15,.35,.764,.51,orange);
  box(-.32,.243,.414,.334,.727,.025,orangeFront);
  box(-.32,.437,.433,.215,.126,.016,edge,false);
  box(-.366,.452,.444,.037,.031,.014,'#70d4ff',false);
  box(-.317,.398,.445,.111,.011,.013,'#9aa9ae',false);
  for(let i=0;i<5;i++)box(-.418+.049*i,.079,.434,.021,.104,.016,edge,false);
  box(.61,-.112,-.30,.53,.056,.31,'#6b8090');
  wire([[-.34,-.041,-.144],[-.43,-.075,-.21],[-.42,-.121,-.38],[-.18,-.124,-.53],[.34,-.123,-.47]],'#ecb67c',2);
 }else if(type==='rack'){
  box(0,-1.06,0,1.7,.17,1.14,edge);box(0,.98,0,1.7,.13,1.14,steel);box(0,-.02,-.51,1.61,1.9,.08,edge);
  for(const x of [-.79,.79])for(const z of [-.49,.49]){box(x,-.01,z,.09,2,.085,grey);for(let i=0;i<18;i++)box(x,-.88+i*.10,z+.05,.025,.032,.019,black,false)}
  for(const y of [.66,.42,-.36,-.67]){box(0,y,0,1.39,.155,.84,steel);box(0,y,.431,1.38,.148,.05,edge);ports(-.54,y,.473,8);box(.63,y,.468,.04,.043,.023,'#7fedaa',false)}
  box(0,.03,0,1.4,.1875,.86,orange);box(0,.027,.455,1.4,.163,.047,orangeFront);box(-.37,.035,.488,.52,.084,.023,black);box(-.51,.035,.505,.045,.029,.018,'#81eab5',false);
  for(let i=0;i<6;i++)box(.09+i*.071,.025,.489,.028,.075,.014,edge,false);
  for(let i=0;i<4;i++){const x=-.6+i*.11;wire([[x,-.36,.47],[x-.07,-.48,.56],[x-.06,-.55,.68],[x+.09,-.57,.68],[x+.20,-.3,.69],[x+.23,.36,.65],[x+.27,.42,.47]],i%2?'#5eb9f0':'#edb865',2)}
 }else{
  // Low-profile router-like switch on a desk; cable runs are illustrative only.
  box(0,-.21,0,2.42,.14,1.39,grey);
  for(const x of [-1.05,1.05])for(const z of [-.54,.54])box(x,-.70,z,.079,.88,.078,steel);
  box(-.11,-.058,.17,.87,.155,.54,orange);
  box(-.11,-.053,.447,.824,.112,.023,orangeFront);
  box(-.11,.024,.17,.82,.008,.48,orange,false);
  ports(-.428,-.061,.465,7,.71);
  for(let i=0;i<4;i++){const x=-.428+i*.15;wire([[x,-.063,.467],[x,-.08,.50],[x+.025,-.10,.54],[x+.09,-.108,.55],[x+.16,-.108,.512],[x+.24,-.109,.419],[x+.34,-.109,.315],[x+.45,-.109,.22]],i%3?'#5fb9ed':'#438dc3',2.7)}

 }
 return {faces,lines};
}
export function mountModel(canvas,type){
 const ctx=canvas.getContext('2d',{alpha:true});if(!ctx)throw Error('Canvas 2D unavailable');const model=scene(type);
 let yaw=-.53,pitch=.30,zoom=1, frame=0,down=null;
 const limit=(n,l,h)=>Math.max(l,Math.min(h,n));
 function draw(){frame=0;if(!ctx)return;
  const ratio=Math.min(devicePixelRatio||1,2),w=canvas.clientWidth||280,h=canvas.clientHeight||200;
  if(canvas.width!==Math.round(w*ratio)||canvas.height!==Math.round(h*ratio)){canvas.width=Math.round(w*ratio);canvas.height=Math.round(h*ratio)}
  ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,w,h);
  const c=Math.cos(yaw),s=Math.sin(yaw),d=Math.cos(pitch),e=Math.sin(pitch);
  const rot=([x,y,z])=>{const u=x*c+z*s,v=z*c-x*s;return [u,y*d-v*e,y*e+v*d]};
  const scale=Math.min(h*.385,w*.245)*zoom;
  const project=([x,y,z])=>{const p=6.5/Math.max(3.4,6.5-z);return [w/2+x*p*scale,h*.47-y*p*scale]};
  const drawables=[];
  for(const a of model.faces){const p=a.p.map(rot),n=rot(a.n),avg=p.reduce((t,v)=>t+v[2],0)/p.length;
   if(n[0]*(-p[0][0])+n[1]*(-p[0][1])+n[2]*(6.5-p[0][2])>0)drawables.push({...a,p,z:avg})}
  for(const a of model.lines){const p=a.p.map(rot);drawables.push({...a,p,z:(p[0][2]+p[1][2])/2})}
  drawables.sort((a,b)=>a.z-b.z);
  for(const a of drawables){ctx.beginPath();a.p.map(project).forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));if(a.p.length>2){ctx.closePath();ctx.fillStyle=a.c;ctx.fill();if(a.stroke){ctx.lineWidth=.65;ctx.strokeStyle=a.stroke;ctx.stroke()}}else{ctx.lineCap='round';ctx.lineWidth=a.w;ctx.strokeStyle=a.c;ctx.stroke()}}
 }
 const queue=()=>{canvas.dataset.rotation=yaw.toFixed(4)+','+pitch.toFixed(4);canvas.dataset.zoom=zoom.toFixed(4);if(!frame)frame=requestAnimationFrame(draw)};
 const reset=()=>{yaw=-.53;pitch=.30;zoom=1;queue()};
 const pDown=e=>{if(e.button!==0)return;down={x:e.clientX,y:e.clientY,id:e.pointerId};canvas.setPointerCapture(e.pointerId);canvas.style.cursor='grabbing'};
 const pMove=e=>{if(!down||down.id!==e.pointerId)return;yaw+=(e.clientX-down.x)*.012;pitch=limit(pitch+(e.clientY-down.y)*.01,-1.05,1.05);down.x=e.clientX;down.y=e.clientY;queue()};
 const pUp=()=>{down=null;canvas.style.cursor='grab'};
 const wheel=e=>{e.preventDefault();zoom=limit(zoom*Math.exp(-e.deltaY*.0015),.63,2.05);queue()};
 const key=e=>{switch(e.key){case 'ArrowLeft':yaw-=.16;break;case 'ArrowRight':yaw+=.16;break;case 'ArrowUp':pitch=limit(pitch-.12,-1.05,1.05);break;case 'ArrowDown':pitch=limit(pitch+.12,-1.05,1.05);break;case '+':case '=':zoom=limit(zoom*1.15,.63,2.05);break;case '-':zoom=limit(zoom*.87,.63,2.05);break;case 'Home':reset();break;default:return}e.preventDefault();queue()};
 const evs={pointerdown:pDown,pointermove:pMove,pointerup:pUp,pointercancel:pUp,lostpointercapture:pUp,wheel,keydown:key};
 for(const [k,v] of Object.entries(evs))canvas.addEventListener(k,v,{passive:k!=='wheel'&&k!=='keydown'});
 canvas.style.touchAction='none';canvas.style.cursor='grab';canvas.tabIndex=0;canvas.dataset.renderer='canvas-3d';
 const observer=new ResizeObserver(queue);observer.observe(canvas);queue();
 return {reset,destroy(){if(frame)cancelAnimationFrame(frame);observer.disconnect();for(const [k,v] of Object.entries(evs))canvas.removeEventListener(k,v)}};
}
