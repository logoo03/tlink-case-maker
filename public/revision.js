// All alternative copy is assembled from an approved source block. Feedback affects presentation, not the evidence.
const intros={
 install:{
  cabinet:['서버 자리는 단자함 밖에서 찾았습니다.','좁은 단자함, 서버는 어디에 둘까요?','단자함 밖에 놓은 녹취 서버','공간이 빠듯한 현장의 녹취 구성'],
  rack:['이미 있는 통신 랙에서 시작하세요.','기존 통신 랙, 활용할 수 있을까요?','기존 랙 활용부터 검토하세요','기존 서버 랙의 설치 조건'],
  unknown:['현장 사진부터 살펴보세요.','우리 공간에는 어떤 구성이 맞을까요?','현장에 맞는 녹취 구성','녹취 서버의 설치 조건']},
 mobile:{any:['외근 중의 통화도 한곳에서.','밖에서 받은 전화, 어디에 남을까요?','외근 통화도 한곳으로','유선·모바일 녹취의 연동 조건']},
 summary:{any:['상담 기록은 다시 듣는 대신 읽으세요.','지난 통화, 다시 들어야 할까요?','통화 내용을 글로 확인하세요','STT 변환과 통화 요약']}
};
const compactFacts={
 install:{cabinet:'은평 사례에서는 서버를 벽에 두고 단자함 안에는 미러링 스위치만 넣었습니다.',rack:'티링크는 기존 서버 랙에 녹취 장비를 장착하는 방식을 안내합니다. 실제 적용 여부는 현장별로 확인합니다.',unknown:'현장 공간과 기존 장비를 확인한 뒤 녹취 서버 설치 형태를 결정합니다.'},
 mobile:{any:'사무실 전화와 스마트폰 통화를 한 서버에서 관리합니다. 모바일 앱은 안드로이드 10 이상을 지원하며 아이폰은 지원하지 않습니다.'},
 summary:{any:'통화를 글로 바꾸고 핵심 내용을 요약하는 상품 구성이 있습니다. 경영분석 종합리포트는 별도 옵션입니다.'}
};
export function localPlan(feedback){
 const t=String(feedback).trim();const short=/짧|줄여|줄이|간결|간단|한\s*줄|축약|간략|핵심|short/i.test(t);
 const technical=/기술|전산|전문|담당자|구체|technical/i.test(t), buyer=/고객|부드|쉬운|쉽게|친근|영업|자연|부담|친절|구매|buyer/i.test(t);
 const question=/질문|의문|호기심|question/i.test(t),statement=/서술|진술|단정|평서|선언|강조|헤드라인|statement/i.test(t);
 if(!short&&!technical&&!buyer&&!question&&!statement)return null;
 return {hook:question?'question':statement?'statement':short?'compact':'question',tone:technical?'technical':buyer?'buyer':'plain',length:short?'short':'normal'};
}
export function applyPlan(base,scene,plan){
 const id=base.key==='install'?(scene.revisionGroup||scene.id||'unknown'):'any';const variants=intros[base.key][id]??intros.install.unknown;
 const index=plan.hook==='compact'?2:plan.hook==='statement'?0:plan.tone==='technical'?3:1;
 const short=compactFacts[base.key][id]??compactFacts.install.unknown;
 const ask=plan.tone==='buyer'?({install:'지금 쓰는 장비 사진을 준비해 설치 공간부터 상담해 보세요.',mobile:'업무용 스마트폰 종류를 알려주시면 사용 조건을 확인할 수 있습니다.',summary:'가장 자주 남기는 상담 메모부터 이야기해 보세요.'}[base.key]):base.ask;
 return {...base,title:variants[index],lead:plan.length==='short'?short:base.lead,ask};
}
