import {cases,mobile,cta} from './data.js';
const home='https://www.tlinkcrm.com/', recording='https://www.tlinkcrm.com/recording.php';
export const angles={
 install:{label:'설치 공간',fact:'티링크는 현장 공간에 따라 스탠드형, 랙 거치형, 미러링 스위치 방식의 설치를 안내합니다.',source:cases,sourceLabel:'설치 형태 안내',ask:'쓰고 있는 통신 랙이나 단자함의 사진과 남은 공간을 알려주세요.'},
 mobile:{label:'사무실·외근 통합',title:'사무실 밖에서 받은 전화, 어디에 기록될까요?',fact:'티링크 모바일은 사무실 인터넷전화와 외근 직원의 스마트폰 통화를 한 녹취 서버에 모아 CRM과 연동합니다. 모바일 앱은 안드로이드 10 이상에서 사용하며 아이폰은 지원하지 않습니다.',source:mobile,sourceLabel:'모바일 CRM 안내',ask:'사무실 전화 종류와 업무용 스마트폰 운영체제를 알려주세요.'},
 summary:{label:'상담 기록 업무',title:'지난 통화를 다시 듣지 않고 내용을 확인하려면?',fact:'티링크 AI 녹취는 음성을 글로 바꾸고 핵심 내용을 요약합니다. 해당 기능이 포함된 상품 구성을 확인하세요. 경영분석 종합리포트는 기본 제공이 아닌 별도 옵션입니다.',source:recording,sourceLabel:'AI 녹취 안내',extra:home,ask:'통화가 끝난 뒤 누가 어떤 상담 기록을 남겨야 하는지 알려주세요.'}
};
export function compose(scene,key='install',note=''){
 const a=angles[key]??angles.install;
 return {title:a.title||scene.title,lead:key==='install'?scene.description:a.fact,caseText:key==='install'?'':scene.description,fact:a.fact,source:a.source,sourceLabel:a.sourceLabel,extra:a.extra,ask:a.ask,note:String(note||'').trim().slice(0,240),key};
}
export const escapeHTML=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const pinPalette=['#ffab69','#65e9d7','#c4a8ff','#f2e480'];
export function publicPoints(scene){
 return (scene.points||[]).filter(p=>p&&((p.status==='approved')||(p.status===undefined&&!scene.ai))&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&typeof p.label==='string'&&p.label.trim()).slice(0,4).map((p,i)=>({x:Math.max(0,Math.min(100,p.x)),y:Math.max(0,Math.min(100,p.y)),label:p.label,text:p.customerText?.trim()||p.seen?.trim()||'',color:pinPalette[i]}));
}
export function makeHTML(scene,copy,src){
 const e=escapeHTML;
 const points=publicPoints(scene);
 const pts=points.map((p,i)=>'<a class="pt" href="#p'+(i+1)+'" style="--pin:'+p.color+';left:'+p.x+'%;top:'+p.y+'%" aria-label="'+e(p.label)+'"><span aria-hidden="true"></span></a>').join('');
 const rows=points.map((p,i)=>'<article id="p'+(i+1)+'" style="--pin:'+p.color+'"><h3><span class="dot" aria-hidden="true"></span>'+e(p.label)+'</h3><p>'+e(p.text)+'</p></article>').join('');
 const caption=scene.id?'티링크 공식 설치 사진':'현장 설치 사진';
 const para=(k,t)=>t?'<p><b>'+k+'</b>'+e(t)+'</p>':'';
 return '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+e(copy.title)+'</title><style>*{box-sizing:border-box}body{margin:0;background:#f7f7ed;color:#17241b;font:16px/1.65 -apple-system,BlinkMacSystemFont,sans-serif;word-break:keep-all;overflow-wrap:anywhere}main{max-width:840px;margin:auto;padding:30px clamp(18px,5vw,56px) 65px}header,footer{border-top:2px solid #233a29;padding:12px 0}h1{font-size:clamp(2rem,6vw,3.9rem);line-height:1.1;letter-spacing:-.035em;margin:22px 0 14px}h2{margin:32px 0 10px;font-size:1.45rem}h3{font-size:1.05rem;margin:0 0 8px}.stage{background:#17241b;padding:16px;display:grid;place-items:center;margin:22px 0 0}.pic{position:relative;max-width:100%;line-height:0}.pic img{display:block;max-width:100%;max-height:520px;width:auto;height:auto}.pt{position:absolute;transform:translate(-50%,-50%);width:44px;height:44px;display:grid;place-items:center;border-radius:50%;text-decoration:none}.pt span,.dot{display:inline-block;width:15px;height:15px;border-radius:50%;background:var(--pin);border:2px solid #f8fff9;box-shadow:0 0 0 3px #142123,0 0 13px 5px var(--pin)}.pt:hover span,.pt:focus-visible span{outline:2px solid white;outline-offset:5px}.dot{width:10px;height:10px;margin-right:12px;vertical-align:middle;box-shadow:0 0 0 1px #263628;border:0}article{border-top:1px solid #bdc9bd;padding:15px 0}article:target{background:#e7f0d5}p{margin:8px 0}b{display:block;font-size:.78em;color:#3c5742}small{color:#415746}a{color:inherit;text-underline-offset:4px}.ask{margin:28px 0;padding:18px;background:#e7efd9}.cta{display:inline-block;background:#d2f759;padding:8px 14px;font-weight:bold;margin-top:9px}footer a{margin-right:10px} .brand{letter-spacing:.1em}</style></head><body><main><header><strong class="brand">T·LINK</strong>　설치 엑스레이</header><h1>'+e(copy.title)+'</h1><p>'+e(copy.lead)+'</p><div class="stage"><div class="pic"><img src="'+e(src)+'" alt="'+e(caption)+'">'+pts+'</div></div><small>'+e(caption)+'</small><h2>사진 속 장비</h2>'+(rows||'<p>확정된 설명점이 없습니다. 이 사진으로 구성이나 제품 모델을 특정하지 않았습니다.</p>')+para('현장 맥락',copy.caseText)+para('공식 제품 자료',copy.key==='install'?copy.fact:'')+''+'<section class="ask"><b>도입 전 확인</b><p>'+e(copy.ask)+'</p><a class="cta" href="'+cta+'">티링크 설치 상담 ↗</a></section><footer><a href="'+cases+'">공식 설치 사례</a><a href="'+copy.source+'">'+e(copy.sourceLabel)+'</a>'+(copy.extra?'<a href="'+copy.extra+'">상품 옵션 안내</a>':'')+'</footer></main></body></html>';
}
