import test from 'node:test';import assert from'node:assert/strict';import sharp from'sharp';
import{motionVideoRange,motionResponse}from'../src/server/motion.mjs';
const box=(name,data=Buffer.alloc(0))=>{const h=Buffer.alloc(8);h.writeUInt32BE(h.length+data.length);h.write(name,4);return Buffer.concat([h,data])};
export const syntheticMP4=()=>Buffer.concat([box('ftyp',Buffer.from('isom\0\0\0\0isom')),box('moov'),box('mdat',Buffer.from([0,1,2,3]))]);
async function photo(meta,video=syntheticMP4()){
 const jpeg=await sharp({create:{width:2,height:2,channels:3,background:'#dcb4c5'}}).jpeg().toBuffer();const xmp=Buffer.from('http://ns.adobe.com/xap/1.0/\0'+meta.replaceAll('$LENGTH',String(video.length)));const header=Buffer.alloc(4);header[0]=255;header[1]=225;header.writeUInt16BE(xmp.length+2,2);return Buffer.concat([jpeg.subarray(0,2),header,xmp,jpeg.subarray(2),video]);
}
test('motion parser detects both legacy and modern JPEG metadata and preserves exact video bytes',async()=>{
 for(const meta of ['<rdf GCamera:MicroVideo="1" GCamera:MicroVideoOffset="$LENGTH"/>','<rdf Camera:MotionPhoto="1"><Container:Item Item:Mime="video/mp4" Item:Semantic="MotionPhoto" Item:Length="$LENGTH"/></rdf>']){
 const b=await photo(meta),range=motionVideoRange(b);assert.ok(range);assert.deepEqual(b.subarray(range.start,range.end),syntheticMP4());
 const full=motionResponse(b);assert.equal(full.status,200);assert.equal(full.headers.get('content-type'),'video/mp4');assert.deepEqual(Buffer.from(await full.arrayBuffer()),syntheticMP4());
 const part=motionResponse(b,'bytes=2-9');assert.equal(part.status,206);assert.deepEqual(Buffer.from(await part.arrayBuffer()),syntheticMP4().subarray(2,10));assert.match(part.headers.get('cache-control'),/no-store/);
 assert.equal(motionResponse(b,'bytes=999999-').status,416);assert.equal(motionResponse(b,'bytes=0-1,3-4').status,416);
 }
});
test('motion parser rejects static, disabled, stale metadata, truncation and out-of-bounds offsets',async()=>{
 const jpeg=await sharp({create:{width:2,height:2,channels:3,background:'#abcdef'}}).jpeg().toBuffer();assert.equal(motionVideoRange(jpeg),null);assert.equal(motionResponse(jpeg).status,404);
 for(const meta of ['<x Camera:MotionPhoto="0" GCamera:MicroVideoOffset="$LENGTH"/>','<x Camera:MotionPhoto="1" GCamera:MicroVideoOffset="99999999"/>','<x Camera:MotionPhoto="1" GCamera:MicroVideoOffset="0"/>'])assert.equal(motionVideoRange(await photo(meta)),null);
 const b=await photo('<x GCamera:MicroVideo="1" GCamera:MicroVideoOffset="$LENGTH"/>');assert.equal(motionVideoRange(b.subarray(0,b.length-3)),null);
 const bad=await photo('<x GCamera:MicroVideo="1" GCamera:MicroVideoOffset="$LENGTH"/>',Buffer.from('not video'));assert.equal(motionVideoRange(bad),null);
});
