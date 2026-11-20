import test from 'node:test';
import assert from 'node:assert/strict';
import {zipStored} from '../public/cards.js';

test('Instagram ZIP preserves all three byte arrays and the directory offsets',async()=>{
 const files=[1,2,3].map(n=>({name:'0'+n+'.png',bytes:Uint8Array.from([0x89,0x50,0x4e,0x47,n])}));
 const zip=new DataView(await zipStored(files).arrayBuffer());
 const end=zip.byteLength-22;
 assert.equal(zip.getUint32(end,true),0x06054b50);
 assert.equal(zip.getUint16(end+10,true),files.length);
 let off=zip.getUint32(end+16,true);
 for(const file of files){
  assert.equal(zip.getUint32(off,true),0x02014b50);
  let start=zip.getUint32(off+42,true);
  assert.equal(zip.getUint32(start,true),0x04034b50);
  const len=zip.getUint16(start+26,true);
  assert.equal(new TextDecoder().decode(new Uint8Array(zip.buffer,start+30,len)),file.name);
  assert.deepEqual(new Uint8Array(zip.buffer,start+30+len,file.bytes.length),file.bytes);
  off+=46+zip.getUint16(off+28,true);
 }
});
