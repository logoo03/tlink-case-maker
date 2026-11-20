import {createRequire} from 'node:module';import {readFile} from 'node:fs/promises';import {gallery} from '../public/gallery-data.js';import {manufacturerMasks} from '../public/manufacturer-masks.js';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_CORE||'playwright-core');
const base=process.env.QA_URL||'http://127.0.0.1:4178';
const fixtures=[...Object.entries(manufacturerMasks).filter(([id])=>id.startsWith('guide')).map(([id,masks],i)=>({id,asset:'rec-install-'+(i+1)+'.jpg',masks})),...gallery];
const data=JSON.parse(await readFile(new URL('../outputs/mask-candidates/aggregate.json',import.meta.url),'utf8'));
const colors=['#ffb16e','#64dfcd','#80b9ff','#f9d878'];
function frame(asset,polygons){return '<div class="frame"><img src="'+base+'/assets/'+asset+'" alt=""><svg viewBox="0 0 100 100" preserveAspectRatio="none">'+polygons.map((p,i)=>'<polygon points="'+p.map(v=>v.join(',')).join(' ')+'" style="--ink:'+colors[i]+'"></polygon>').join('')+'</svg></div>'}
const row=f=>'<article><h2>'+f.id+' · '+f.asset+'</h2><div class="grid">'+frame(f.asset,[])+frame(f.asset,f.masks.map(x=>x.polygon))+frame(f.asset,data[f.id]||[])+'</div></article>';
const heading='<style>body{margin:16px;background:#171f24;color:white;font:15px system-ui}h1,h2{margin:6px 0;font-size:16px}article{padding:8px;border-top:1px solid #515f65}.grid{display:grid;grid-template-columns:repeat(3, minmax(0,1fr));gap:9px}.frame{position:relative;max-width:340px;margin:auto}.frame img{display:block;width:100%;height:auto}.frame svg{position:absolute;inset:0;width:100%;height:100%}polygon{fill:var(--ink);fill-opacity:.32;stroke:var(--ink);stroke-width:1.7;vector-effect:non-scaling-stroke}</style><h1>검토 우선순위: 원본 / 기존 수동 / OpenAI 좌표</h1>';
const output=process.argv[2]||'/tmp/tlink-mask-review.png';
const b=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined,headless:true});
try{
 const p=await b.newPage({viewport:{width:1100,height:900}});await p.goto(base);await p.setContent(heading+fixtures.map(row).join(''));
 await p.evaluate(()=>Promise.all([...document.images].map(x=>x.decode())));await p.screenshot({path:output,fullPage:true});console.log(output);
}finally{await b.close()}
