// Read only bounded JPEG XMP; never decode XML entities or trust a filename.
export function motionVideoRange(input){
 const b=Buffer.isBuffer(input)?input:Buffer.from(input.buffer,input.byteOffset,input.byteLength);
 if(b.length<4||b.length>15*1024*1024||b[0]!==255||b[1]!==216)return null;
 let p=2,entropy=false,end=0,total=0;const packets=[];
 while(p<b.length){
  if(b[p]!==255){if(!entropy)return null;p++;continue;}
  while(p<b.length&&b[p]===255)p++;if(p>=b.length)return null;const marker=b[p++];
  if(entropy&&marker===0)continue;if(marker>=208&&marker<=215)continue;
  if(marker===217){end=p;break;}if(marker===216||marker===1)continue;
  if(p+2>b.length)return null;const len=b.readUInt16BE(p);if(len<2||p+len>b.length)return null;
  if(marker===225){const packet=b.subarray(p+2,p+len);if(packet.subarray(0,29).toString('latin1').startsWith('http://ns.adobe.com/xap/1.0/\0')){total+=packet.length;if(total>262144)return null;packets.push(packet.toString('utf8'));}}
  p+=len;entropy=marker===218;
 }
 if(!end||!packets.length)return null;const xml=packets.join('\n');
 const property=(name)=>xml.match(new RegExp('(?:[\\w-]+:)?'+name+'\\s*=\\s*["\']([^"\']*)["\']'))?.[1];
 const motion=property('MotionPhoto');if(motion!==undefined&&motion!=='1')return null;
 if(motion!=='1'&&property('MicroVideo')!=='1')return null;
 let length;
 for(const item of xml.matchAll(/<(?:[\w-]+:)?Item\b[^>]*>/g)){
  const attr=name=>item[0].match(new RegExp('(?:[\\w-]+:)?'+name+'\\s*=\\s*["\']([^"\']*)["\']'))?.[1];
  if(attr('Mime')==='video/mp4'&&attr('Semantic')==='MotionPhoto')length=attr('Length');
 }
 length??=property('MicroVideoOffset');if(!/^\d{1,10}$/.test(length??''))return null;const size=Number(length),start=b.length-size;
 if(!Number.isSafeInteger(size)||size<24||start<end)return null;
 let at=start,boxes=0,ftyp=false,moov=false,mdat=false;
 while(at<b.length){
  if(++boxes>1000||at+8>b.length)return null;let n=b.readUInt32BE(at),header=8;const type=b.toString('ascii',at+4,at+8);
  if(n===1){if(at+16>b.length)return null;const big=b.readBigUInt64BE(at+8);if(big>BigInt(Number.MAX_SAFE_INTEGER))return null;n=Number(big);header=16;}else if(n===0)n=b.length-at;
  if(n<header||at+n>b.length)return null;
  if(at===start){if(type!=='ftyp'||n<header+8)return null;ftyp=true;}
  if(type==='moov')moov=true;if(type==='mdat')mdat=true;at+=n;
 }
 return ftyp&&moov&&mdat&&at===b.length?{start,end:b.length}:null;
}
export function motionResponse(bytes,rangeHeader){
 const range=motionVideoRange(bytes);const headers={'Content-Type':'video/mp4','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Accept-Ranges':'bytes'};
 if(!range)return Response.json({error:'这份原图没有可播放的实况视频'},{status:404,headers:{'Cache-Control':'private, no-store'}});
 const video=bytes.subarray(range.start,range.end),size=video.length;let start=0,end=size-1,status=200;
 if(rangeHeader){const m=rangeHeader.match(/^bytes=(\d*)-(\d*)$/);let valid=!!m&&!!(m[1]||m[2]);
  if(valid){if(!m[1]){const suffix=Number(m[2]);valid=Number.isSafeInteger(suffix)&&suffix>0;start=Math.max(0,size-suffix);}else{start=Number(m[1]);end=m[2]?Math.min(Number(m[2]),size-1):size-1;valid=Number.isSafeInteger(start)&&Number.isSafeInteger(end)&&start<size&&end>=start;}}
  if(!valid)return new Response(null,{status:416,headers:{...headers,'Content-Range':'bytes */'+size}});status=206;headers['Content-Range']=`bytes ${start}-${end}/${size}`;
 }
 headers['Content-Length']=String(end-start+1);return new Response(video.subarray(start,end+1),{status,headers});
}
