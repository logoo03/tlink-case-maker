import {OPENAI_MODEL,OpenAIRequestError,requestPhotoAnalysis,requestMarketing,requestRevisionPlan} from './openai.mjs';
import {angles} from './public/content.js';

const publicPages = new Map([['/','/install.html'],['/install','/install.html'],['/install/','/install.html'],['/install.html','/install.html']]);
const publicFiles = new Set(['/install.css','/install.js','/install-3d.js','/install-content.js','/gallery-data.js','/manufacturer-masks.js','/masks.js','/live-masks.js']);
const studioPages = new Map([['/studio','/studio-v2.html'],['/studio/','/studio-v2.html'],['/studio-v2.html','/studio-v2.html'],['/index.html','/studio-v2.html']]);
const studioFiles = new Set(['/studio-v2.js','/studio-v2.css','/mask-editor.js','/marketing.js','/content.js','/cards.js','/revision.js','/data.js']);
const apiPaths = new Set(['/api/analyze','/api/marketing','/api/revise','/api/status']);
const validPhoto = /^\/assets\/[A-Za-z0-9][A-Za-z0-9_-]{0,95}\.(?:jpg|jpeg|png|webp)$/;
const shared = {
 'X-Content-Type-Options':'nosniff',
 'Referrer-Policy':'no-referrer',
 'X-Frame-Options':'DENY',
 'Permissions-Policy':'camera=(), microphone=(), geolocation=()',
 'Content-Security-Policy':"default-src 'self'; img-src 'self' blob: data:; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'"
};
const noStore={'Cache-Control':'private, no-store, max-age=0'};
const json=(body,status=200,headers={})=>new Response(JSON.stringify(body),{status,headers:{...shared,...noStore,...headers,'Content-Type':'application/json; charset=UTF-8'}});
const denied=(error='찾을 수 없습니다.',status=404)=>json({error},status);
const method=allow=>json({error:'지원하지 않는 요청 방식입니다.'},405,{Allow:allow});
const loopback=u=>u.hostname==='127.0.0.1'||u.hostname==='localhost';
const secure=u=>u.protocol==='https:'||loopback(u)&&u.protocol==='http:';
const httpCode=(status,message,headers={})=>json({error:message},status,headers);
export class StudioBudget {
 constructor(state){this.sql=state.storage.sql;this.sql.exec('CREATE TABLE IF NOT EXISTS quota (day TEXT PRIMARY KEY, used INTEGER NOT NULL)');}
 async fetch(request){
  if(request.method!=='POST')return new Response(null,{status:405});
  const day=new Date().toISOString().slice(0,10);
  const row=this.sql.exec('INSERT INTO quota(day,used) VALUES (?,1) ON CONFLICT(day) DO UPDATE SET used=used+1 WHERE quota.used<40 RETURNING used',day).toArray()[0];
  if(!row)return new Response(null,{status:429});
  this.sql.exec('DELETE FROM quota WHERE day < ?',day);
  return new Response(null,{status:204});
 }
}
async function sendAsset(env,request,url,path,isPrivate){
 if(!env.ASSETS?.fetch)return denied('정적 자산을 불러올 수 없습니다.',503);
 const src=new URL(path,url.origin),headers=new Headers(request.headers);
 headers.delete('Authorization');headers.delete('Cookie');headers.delete('If-None-Match');headers.delete('If-Modified-Since');headers.delete('Range');
 const asset=await env.ASSETS.fetch(new Request(src,{method:request.method,headers}));
 // The static binding is configured without HTML redirects. Never surface an unexpected asset redirect.
 if(!asset.ok&&asset.status!==404)return denied('정적 자산을 불러올 수 없습니다.',503);
 const out=new Headers(asset.headers);for(const [k,v] of Object.entries(shared))out.set(k,v);
 if(isPrivate){out.set('Cache-Control',noStore['Cache-Control']);}
 // Do not cache HTML with old references after a release; immutable routes aren't used.
 else if(path.endsWith('.html'))out.set('Cache-Control','no-cache');
 return new Response(request.method==='HEAD'?null:asset.body,{status:asset.status,headers:out});
}
class TooLarge extends Error {}
async function readJSON(req,limit){
 const size=req.headers.get('Content-Length');if(size!==null&&Number(size)>limit)throw new TooLarge();
 if(!req.body)throw Error();
 const decoder=new TextDecoder(), reader=req.body.getReader();let body='',count=0;
 try{
  while(true){
   const {value,done}=await reader.read();if(done)break;
   count+=value.byteLength;if(count>limit){await reader.cancel();throw new TooLarge();}
   body+=decoder.decode(value,{stream:true});
  }
  return JSON.parse(body+decoder.decode());
 } finally{reader.releaseLock();}
}
async function runAPI(req,u,env,transport){
 const configured=env.TLINK_ORIGIN===u.origin&&typeof env.STUDIO_RATE_LIMIT?.limit==='function'&&typeof env.STUDIO_BUDGET?.idFromName==='function'&&Boolean(env.OPENAI_API_KEY?.trim());
 if(u.pathname==='/api/status')return ['GET','HEAD'].includes(req.method)?json({openaiAvailable:configured,openaiModel:OPENAI_MODEL}):method('GET, HEAD');
 if(req.method!=='POST')return method('POST');
 if(req.headers.get('Origin')!==u.origin||req.headers.get('Sec-Fetch-Site')!=='same-origin')
   return denied('이 페이지에서만 실행할 수 있습니다.',403);
 if(!/^application\/json(?:;|$)/i.test(req.headers.get('Content-Type')??''))return denied('잘못된 요청 형식입니다.',415);
 let input;
 try{input=await readJSON(req,u.pathname==='/api/analyze'?3_000_000:16_000);}
 catch(e){return e instanceof TooLarge?denied('입력 크기를 줄여 다시 시도하세요.',413):denied('입력 형식을 확인하세요.',400);}
 const {image,provider,consent,angle,feedback,brief,points}=input??{};
 if(provider!==undefined&&provider!=='openai')return denied('지원하지 않는 분석 도구입니다.',400);
 if(u.pathname!=='/api/analyze'&&consent!==true)return denied('OpenAI에 보낼 내용에 동의한 뒤 다시 실행하세요.',403);
 if(u.pathname==='/api/analyze'&&(typeof image!=='string'||image.length<8||image.length>2_800_000||image.length%4!==0||!/^\/9j\/[A-Za-z0-9+/]*={0,2}$/.test(image)))return denied('지원되는 JPEG 사진을 다시 선택하세요.',400);
 if(u.pathname==='/api/revise'&&(typeof feedback!=='string'||!feedback.trim()))return denied('수정할 내용을 입력하세요.',400);
 if(u.pathname==='/api/marketing'&&(!Array.isArray(points)||!points.length||points.length>4||points.some(p=>p?.status!=='approved'||typeof p.label!=='string'||!p.label.trim()||typeof p.customerText!=='string'||!p.customerText.trim())))return denied('승인된 장비 설명을 1개 이상 선택하세요.',400);
 if(!configured)return denied('자동 분석이 아직 준비되지 않았습니다. 공식 사례 또는 직접 편집을 사용하세요.',503);
 const key=env.OPENAI_API_KEY;
 const ip=req.headers.get('CF-Connecting-IP')||(loopback(u)?'local':null);
 if(!ip||!/^[-.0-9a-f:]+$|^local$/i.test(ip))return denied('요청 보호가 준비되지 않았습니다.',503);
 try{
   if(!(await env.STUDIO_RATE_LIMIT.limit({key:ip}))?.success)return httpCode(429,'분당 요청 한도에 도달했습니다. 잠시 후 다시 시도하세요.',{'Retry-After':'60'});
   const global=env.STUDIO_BUDGET.get(env.STUDIO_BUDGET.idFromName('tlink-studio-quota'));
   const r=await global.fetch('https://budget.internal/consume',{method:'POST'});
   if(r.status===429)return httpCode(429,'오늘의 자동 분석·카피 제안 40회 한도에 도달했습니다. 직접 편집과 저장은 계속 사용할 수 있습니다.');
   if(r.status!==204)return denied('요청 보호가 준비되지 않았습니다.',503);
 }catch{return denied('요청 보호가 준비되지 않았습니다.',503);}
 const topic=typeof angle==='string'&&Object.hasOwn(angles,angle)?angles[angle]:null;
 try{
  if(u.pathname==='/api/revise')return json({plan:await requestRevisionPlan({feedback,key,transport}),model:OPENAI_MODEL});
  if(u.pathname==='/api/marketing')return json({...(await requestMarketing({points,brief,angle:topic?.label??'',fact:topic?.fact??'',key,transport})),model:OPENAI_MODEL});
  const t=Date.now(), result=await requestPhotoAnalysis({image,key,context:topic?.fact??'',transport,studioInstall:true});
  return json({...result,model:OPENAI_MODEL,elapsed:Math.round((Date.now()-t)/1000)});
 }catch(e){return e instanceof OpenAIRequestError?denied(e.message,e.status):denied('요청을 처리하지 못했습니다.',503);}
}
// Workerd does not implement redirect:'error'. Manual mode likewise never forwards
// bearer credentials to a redirected host, and the shared wrapper rejects all 3xx.
export const workerTransport=(url,init)=>globalThis.fetch(url,{...init,redirect:'manual'});
export function createWorker({transport=workerTransport}={}){
 return {async fetch(request,env){
  const u=new URL(request.url), host=request.headers.get('Host'), path=u.pathname;
  if(!secure(u)||u.username||u.password||host&&host.toLowerCase()!==u.host.toLowerCase())return denied('주소를 확인하세요.',403);
  if(path==='/studio/'&&request.method==='GET')return new Response(null,{status:302,headers:{...shared,...noStore,Location:'/studio'+u.search}});
  if(path.startsWith('/api/'))return apiPaths.has(path)?runAPI(request,u,env,transport):denied();
  if(studioPages.has(path)||studioFiles.has(path)){
   if(!['GET','HEAD'].includes(request.method))return method('GET, HEAD');
   return sendAsset(env,request,u,studioPages.get(path)||path,true);
  }
  if(!publicPages.has(path)&&!publicFiles.has(path)&&!validPhoto.test(path))return denied();
  if(!['GET','HEAD'].includes(request.method))return method('GET, HEAD');
  return sendAsset(env,request,u,publicPages.get(path)||path,false);
 }};
}
export default createWorker();
