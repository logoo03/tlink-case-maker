import test from 'node:test';
import assert from 'node:assert/strict';
import {makeHTML,publicPoints,pinPalette} from '../public/content.js';
const p={x:26,y:52,label:'장비 <A>',seen:'보이는 설명',proof:'CONFIDENTIAL',origin:'AI 후보'};
const copy={title:'현장 사례',lead:'설치 사진',key:'install',fact:'제품 소개',ask:'문의',source:'https://www.tlinkcrm.com/',sourceLabel:'제품',note:'PRIVATE_NOTE'};
test('customer HTML embeds photo and links color dots to approved customer copy without editorial metadata',()=>{
 const s={id:'one',mode:'DRAFT_VERSION',points:[{...p,status:'approved',customerText:'게시 가능한 설명'},{...p,label:'미검토 장비',status:'suggested'}]};
 const html=makeHTML(s,copy,'data:image/jpeg;base64,abc');
 assert.match(html,/class="pt" href="#p1"/);assert.match(html,/id="p1"/);assert.match(html,/data:image\/jpeg;base64,abc/);
 assert.match(html,/장비 &lt;A&gt;/);assert.match(html,/게시 가능한 설명/);assert(html.includes(pinPalette[0]));
 assert.doesNotMatch(html,/미검토 장비|DRAFT_VERSION|CONFIDENTIAL|AI 후보|PRIVATE_NOTE|확인 근거|보이는 설명/);
});
test('legacy curated points eligible, legacy AI points require explicit approval',()=>{
 assert.equal(publicPoints({points:[p]}).length,1);assert.equal(publicPoints({ai:true,points:[p]}).length,0);
 assert.equal(publicPoints({ai:true,points:[{...p,status:'approved'}]}).length,1);
});
