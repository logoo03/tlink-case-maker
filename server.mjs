import {OPENAI_MODEL,OpenAIRequestError,requestPhotoAnalysis,requestMarketing,requestRevisionPlan,normalize} from './openai.mjs';
import {projectKey} from './project-env.mjs';
import {angles} from './public/content.js';
import {createServer} from 'node:http';
import {readFile,lstat} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
export {normalize};
const root=join(dirname(fileURLToPath(import.meta.url)),'public');
const files=new Map([['/','install.html'],['/install','install.html'],['/studio','studio-v2.html'],
 ...['install.html','install.css','install.js','install-3d.js','install-content.js','gallery-data.js','manufacturer-masks.js','mask-editor.js','masks.js','live-masks.js','marketing.js','studio-v2.js','studio-v2.css','studio-v2.html','content.js','cards.js','revision.js','data.js'].map(x=>['/'+x,x])]);
const types={html:'text/html; charset=UTF-8',css:'text/css; charset=UTF-8',js:'text/javascript; charset=UTF-8',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp'};
const csp="default-src 'self'; img-src 'self' blob: data:; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'";
function json(res,code,obj){res.writeHead(code,{'Content-Type':'application/json; charset=UTF-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(obj))}
export function server({apiKey=process.env.OPENAI_API_KEY,transport=fetch}={}){
 const available=typeof apiKey==='string'&&Boolean(apiKey.trim());
 return createServer(async(req,res)=>{
   let url;try{url=new URL(req.url,'http://localhost')}catch{return json(res,400,{error:'잘못된 요청입니다.'})}
   if(!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.host??''))return json(res,403,{error:'localhost에서만 사용할 수 있습니다.'});
   if(req.method==='POST'&&req.headers.origin&&req.headers.origin!=='http://'+req.headers.host)return json(res,403,{error:'이 페이지에서만 실행할 수 있습니다.'});
   if(req.method==='GET'&&url.pathname==='/api/status')return json(res,200,{openaiAvailable:available,openaiModel:OPENAI_MODEL});
   if(req.method==='POST'&&['/api/analyze','/api/revise','/api/marketing'].includes(url.pathname)){
     if(url.pathname==='/api/analyze'&&(req.headers.origin!=='http://'+req.headers.host||req.headers['sec-fetch-site']!=='same-origin'))return json(res,403,{error:'이 페이지에서만 사진을 분석할 수 있습니다.'});
     if(req.headers['sec-fetch-site']&&req.headers['sec-fetch-site']!=='same-origin')return json(res,403,{error:'이 페이지에서만 실행할 수 있습니다.'});
     if(!/^application\/json\b/i.test(req.headers['content-type']??''))return json(res,415,{error:'잘못된 요청 형식입니다.'});
     const max=url.pathname==='/api/analyze'?3_000_000:16_000;
     try{
       const chunks=[];let bytes=0;for await(const chunk of req){bytes+=chunk.length;if(bytes>max)return json(res,413,{error:'입력 크기를 줄여 다시 시도하세요.'});chunks.push(chunk)}
       let input;try{input=JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{return json(res,400,{error:'입력 형식을 확인하세요.'})}
       const {image,provider,consent,angle,feedback,brief,points}=input||{};
       if(url.pathname!=='/api/analyze'&&consent!==true)return json(res,403,{error:'OpenAI에 보낼 내용에 동의한 뒤 다시 실행하세요.'});
       if(provider!==undefined&&provider!=='openai')return json(res,400,{error:'지원하지 않는 분석 도구입니다.'});
       if(!available)return json(res,503,{error:'OpenAI API 키가 설정되지 않았습니다. 공식 사례 또는 직접 편집을 사용하세요.'});
       const topic=typeof angle==='string'&&Object.hasOwn(angles,angle)?angles[angle]:null;
       if(url.pathname==='/api/revise')return json(res,200,{plan:await requestRevisionPlan({feedback,key:apiKey,transport}),model:OPENAI_MODEL});
       if(url.pathname==='/api/marketing')return json(res,200,{...(await requestMarketing({points,brief,angle:topic?.label??'',fact:topic?.fact??'',key:apiKey,transport})),model:OPENAI_MODEL});
       const start=Date.now(),result=await requestPhotoAnalysis({image,key:apiKey,context:topic?.fact??'',transport,studioInstall:true});
       return json(res,200,{...result,model:OPENAI_MODEL,elapsed:Math.round((Date.now()-start)/1000)});
     }catch(err){if(err instanceof OpenAIRequestError)return json(res,err.status,{error:err.message});return json(res,503,{error:'요청을 처리하지 못했습니다. 잠시 후 다시 시도하세요.'})}
   }
   if(req.method==='GET'&&url.pathname==='/index.html'){res.writeHead(302,{Location:'/studio'}).end();return}
   const isAsset=/^\/assets\/[a-zA-Z0-9][a-zA-Z0-9_-]{0,95}\.(jpg|jpeg|png|webp)$/.test(url.pathname);
   const p=files.get(url.pathname)||(isAsset?url.pathname.slice(1):null);
   if(req.method!=='GET'||!p)return json(res,404,{error:'찾을 수 없습니다.'});
   try{const path=join(root,p);if(isAsset&&!(await lstat(path)).isFile())return json(res,404,{error:'찾을 수 없습니다.'});const raw=await readFile(path);res.writeHead(200,{'Content-Type':types[p.split('.').pop()],'X-Content-Type-Options':'nosniff','Content-Security-Policy':csp});res.end(raw)}catch{return json(res,404,{error:'찾을 수 없습니다.'})}
 });
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const port=Number(process.env.PORT??4173);
 server({apiKey:projectKey()}).listen(port,'127.0.0.1',()=>console.log('티링크 설치 가이드 : http://127.0.0.1:'+port));
}
