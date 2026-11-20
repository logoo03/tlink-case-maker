import {test} from 'node:test';import assert from 'node:assert/strict';
import {gallery} from '../public/gallery-data.js';import {manufacturerMasks} from '../public/manufacturer-masks.js';
import {cleanPolygon,enrichMasks,approveMasks} from '../public/masks.js';
import {buildCopy,exportHTML} from '../public/marketing.js';
const square=[[20,20],[70,20],[70,60],[20,60]];
test('editor rejects crossing and degenerate shapes and works with a closed path',()=>{
 assert.equal(cleanPolygon([[0,0],[100,100],[0,100],[100,0]]),null);
 assert.equal(cleanPolygon([[1,1],[2,2],[3,3]]),null);
 assert.deepEqual(cleanPolygon([...square,square[0]]),square);
});
test('all hand-checked example polygons are valid; owner classification fixed at four, five, two',()=>{
 assert.deepEqual(['stand','rack','mirror'].map(t=>gallery.filter(g=>g.type===t).length),[4,5,2]);
 for(const {masks} of gallery)assert.equal(enrichMasks(masks).length,masks.length);
 for(const masks of Object.values(manufacturerMasks))assert.equal(enrichMasks(masks).length,masks.length);
});
test('approval gate and exports keep pending AI candidates out of HTML',()=>{
 const ai=enrichMasks([{label:'미검토 후보',seen:'밖에 보이면 안 됨',polygon:square}],'OpenAI')[0];
 assert.throws(()=>approveMasks([ai]),/미검토/);
 const approved=approveMasks([{...ai,status:'draft',label:'수정한 장비',customerText:'확인된 설명'}]);
 const html=exportHTML({src:'data:image/jpeg;base64,/9j/2Q==',masks:[...approved,ai],copy:buildCopy(approved)});
 assert.match(html,/<polygon[^>]+20,20 70,20 70,60 20,60/);assert.match(html,/수정한 장비/);assert.doesNotMatch(html,/미검토 후보|OpenAI|밖에 보이면/);
});
