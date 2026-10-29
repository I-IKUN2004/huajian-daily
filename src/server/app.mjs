import{socialRoutes}from'./social.mjs';
import{captureMetadata}from'./photo-time.mjs';
import {motionVideoRange,motionResponse} from './motion.mjs';
import {aiRoutes} from './ai.mjs';
import {advancedRoutes,active,publicRecord} from './advanced.mjs';
import { randomUUID } from 'node:crypto';
import { hashPassword, verifyPassword, digest, newToken, parseCookie } from './auth.mjs';
import { KINDS,DEFAULT_SETTINGS,safeId,validData,mediaType,MAX_PHOTO,CHUNK_SIZE,validSettings,validImage } from './domain.mjs';
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
async function readBytes(request,max){const reader=request.body?.getReader();if(!reader)return new Uint8Array();const chunks=[];let size=0;for(;;){const{done,value}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();fail(413,'文件或内容过大');}chunks.push(value);}return Buffer.concat(chunks,size);}
async function json(request,max=65536){try{return JSON.parse(Buffer.from(await readBytes(request,max)).toString());}catch(e){if(e.status)throw e;fail(400,'内容格式不正确');}}
export function createApp({repo,files,passwordHash,secureCookies=true,ai,fetchImpl=fetch}) {
 const cookieName=secureCookies?'__Host-peony-session':'peony-session';
 const response=(data,status=200,headers={})=>new Response(data===null?null:JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff',...headers}});
 const cookie=(token,age)=>cookieName+'='+token+'; Path=/; HttpOnly; SameSite=Strict; Max-Age='+age+(secureCookies?'; Secure':'');
 async function security(){return (await repo.get('settings','security'))??{passwordHash,revision:digest(passwordHash??'')};}
 async function session(request){const token=parseCookie(request,cookieName);if(!token)return null;const row=await repo.get('sessions',digest(token));if(!row||row.expiresAt<Date.now())return null;const sec=await security();if(row.revision!==sec.revision)return null;return {key:digest(token),...row};}
 async function rateLimit(ip){const key=digest('login:'+ip);for(let n=0;n<12;n++){const now=Date.now();const old=await repo.get('attempts',key);const fresh=!old||old.until<now;const count=fresh?1:old.count+1;if(count>10)fail(429,'尝试次数较多，请15分钟后再试');const next=await repo.put('attempts',key,{count,until:fresh?now+15*60000:old.until},old?.version??0);if(next)return;}fail(429,'请稍后再试');}
 const currentSettings=async()=>{const site=await repo.get('settings','site');return {...DEFAULT_SETTINGS,...site?.data,version:site?.version??0};};
 async function ensureOrigin(request,url){if(!['GET','HEAD'].includes(request.method)&&request.headers.get('origin')!==url.origin)fail(403,'请从本站页面操作');}
 const recordShape=(kind,data,id=randomUUID())=>({id,kind,data,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
 async function getUpload(id){if(!safeId(id))fail(404,'未找到上传');const u=await repo.get('uploads',id);if(!u||u.expiresAt<Date.now())fail(404,'上传已过期，请重新选择照片');return u;}
 return async function handle(request,context={}) {
  try {
   const url=new URL(request.url);const path=url.pathname.replace(/^\/api/,'').replace(/\/$/,'')||'/';
   await ensureOrigin(request,url);
   if(!passwordHash)fail(503,'空间尚未配置访问密码');
   if(path==='/login'&&request.method==='POST'){
    await rateLimit(context.ip??'unknown');
    const body=await json(request);const sec=await security();
    if(!await verifyPassword(body.password,sec.passwordHash))fail(401,'密码不正确，再想一想');
    const token=newToken();await repo.put('sessions',digest(token),{revision:sec.revision,expiresAt:Date.now()+7*86400000});
    return response({ok:true},200,{'Set-Cookie':cookie(token,7*86400)});
   }
   const who=await session(request);if(!who)fail(401,'请先输入密码进入');
   if(path==='/session'&&request.method==='GET')return response({authenticated:true});
   if(path==='/logout'&&request.method==='POST'){await repo.delete('sessions',who.key);return response({ok:true},200,{'Set-Cookie':cookie('',0)});}
   if(path==='/password'&&request.method==='POST'){
    const b=await json(request);const sec=await security();
    if(!await verifyPassword(b.currentPassword,sec.passwordHash))fail(401,'当前密码不正确');
    if(typeof b.newPassword!=='string'||b.newPassword.length<10||b.newPassword.length>128)fail(400,'新密码需为10至128个字符');
    const updated=await repo.put('settings','security',{passwordHash:await hashPassword(b.newPassword),revision:newToken()},sec.version??0);
    if(!updated)fail(409,'密码刚刚发生变化，请重新登录');
    return response({ok:true},200,{'Set-Cookie':cookie('',0)});
   }
   const social=await socialRoutes({path,request,repo,files,response,json,fail});if(social)return social;
   const aiResult=await aiRoutes({path,request,repo,ai,fetchImpl,response,json,fail});if(aiResult)return aiResult;
   const advanced=await advancedRoutes({path,request,url,who,repo,files,response,json,fail,security,verifyPassword,rateLimit,context});if(advanced)return advanced;
   if(path==='/bootstrap'&&request.method==='GET'){const rows=await repo.list('records');return response({settings:await currentSettings(),records:rows.filter(active).map(r=>publicRecord(r)),trashCount:rows.filter(r=>r.deletedAt&&Date.parse(r.purgeAt)>Date.now()).length});}
   if(path==='/settings'&&request.method==='PUT'){
    const b=await json(request);const old=await repo.get('settings','site');const data=b.data;
    if(!validSettings(data)||!Array.isArray(data.tags)||!Number.isInteger(data.version)||data.version<0)fail(400,'设置格式不正确，请刷新页面后重试');
    const saved=await repo.put('settings','site',{data:{title:data.title,names:data.names,tags:[...new Set(data.tags)],startDate:data.startDate||null}},data.version);if(!saved)fail(409,'设置刚被修改，请刷新重试');return response(saved);
   }
   if(path==='/import'&&request.method==='POST'){
    const b=await json(request,512000);
    if(b.version!==1||!Array.isArray(b.records)||b.records.length>500||b.records.some(x=>!safeId(x.id)||x.kind==='photo'||!validData(x.kind,x.data)))fail(400,'请选择本站的私密资料JSON文件');
    if(b.settings&&!validSettings(b.settings))fail(400,'导入设置格式不正确');
    let added=0;
    for(const row of b.records){if(await repo.put('records',row.id,recordShape(row.kind,row.data,row.id),0))added++;}
    const existing=await repo.get('settings','site');
    if(!existing&&b.settings){const s=b.settings;if(typeof s.title!=='string'||!Array.isArray(s.names)||s.names.length!==2)fail(400,'导入设置格式不正确');await repo.put('settings','site',{data:{...DEFAULT_SETTINGS,title:s.title.slice(0,60),names:s.names.map(x=>String(x).slice(0,30)),startDate:s.startDate||null}},0);}
    return response({added,skipped:b.records.length-added});
   }
   if(path==='/records'&&request.method==='GET')return response((await repo.list('records')).filter(active).map(r=>publicRecord(r)));
   if(path==='/records'&&request.method==='POST'){
    const b=await json(request);if(b.kind==='photo'||!validData(b.kind,b.data))fail(400,'记录格式不正确');
    const id=b.id??randomUUID();if(!safeId(id))fail(400,'记录编号无效');const row=await repo.put('records',id,{...recordShape(b.kind,b.data,id),publishedBy:[0,1].includes(b.actor)?b.actor:null},0);if(!row)fail(409,'记录已存在');return response(publicRecord(row),201);
   }
   const match=path.match(/^\/records\/([A-Za-z0-9_-]+)$/);
   if(match){
    const old=await repo.get('records',match[1]);if(!old)fail(404,'记录不存在');
    const b=await json(request);
    if(!Number.isInteger(b.version)||b.version<1)fail(400,'请刷新页面后重试');
    if(request.method==='PUT'){
     if(old.data.deleting)fail(409,'照片正在删除，请刷新后重试');
     if(!validData(old.kind,b.data))fail(400,'记录格式不正确');
     const data=old.kind==='photo'?{...b.data,original:old.data.original,thumbnail:old.data.thumbnail,type:old.data.type,size:old.data.size,motion:old.data.motion??false,capturedAt:old.data.capturedAt??null,captureChecked:old.data.captureChecked??false}:b.data;
     const row=await repo.put('records',old.id,{...old,data,updatedAt:new Date().toISOString()},b.version);if(!row)fail(409,'这条记录刚被修改，请刷新后再试');return response(publicRecord(row));
    }
   }
   if(path==='/uploads'&&request.method==='POST'){
    const b=await json(request);if(!['image/png','image/jpeg','image/webp'].includes(b.type)||!Number.isInteger(b.size)||b.size<1||b.size>MAX_PHOTO||typeof b.filename!=='string'||b.filename.length>200)fail(400,'支持JPEG、PNG、WebP，原图最大15 MiB');
    if(b.restoreSourceId!==undefined&&!safeId(b.restoreSourceId))fail(400,'恢复来源编号无效');
    const id=randomUUID();await repo.put('uploads',id,{id,publishedBy:[0,1].includes(b.actor)?b.actor:null,batchId:safeId(b.batchId)?b.batchId:id,...(b.restoreSourceId?{restoreSourceId:b.restoreSourceId}:{}),filename:b.filename,type:b.type,size:b.size,tags:Array.isArray(b.tags)?b.tags.filter(x=>typeof x==='string'&&x.length<40).slice(0,30):[],expiresAt:Date.now()+86400000},0);
    return response({id,chunkSize:CHUNK_SIZE},201);
   }
   const chunk=path.match(/^\/uploads\/([A-Za-z0-9_-]+)\/chunks\/(\d+)$/);
   if(chunk&&request.method==='PUT'){
    if((await repo.get('records',chunk[1]))?.kind==='photo')return response({ok:true});
    const u=await getUpload(chunk[1]);const index=Number(chunk[2]);const count=Math.ceil(u.size/CHUNK_SIZE);
    if(index<0||index>=count)fail(400,'照片分块编号不正确');const bytes=await readBytes(request,CHUNK_SIZE);
    const expected=Math.min(CHUNK_SIZE,u.size-index*CHUNK_SIZE);if(bytes.length!==expected)fail(400,'照片分块不完整');
    const key=u.id+'_'+index;const hash=digest(bytes);const prior=await repo.get('chunks',key);
    if(prior&&prior.hash!==hash)fail(409,'重试的照片内容已变化，请重新上传');
    await files.set('chunks/'+key,bytes);await repo.put('chunks',key,{hash,size:bytes.length},0);return response({ok:true});
   }
   const thumb=path.match(/^\/uploads\/([A-Za-z0-9_-]+)\/thumbnail$/);
   if(thumb&&request.method==='PUT'){
    if((await repo.get('records',thumb[1]))?.kind==='photo')return response({ok:true});
    const u=await getUpload(thumb[1]);const bytes=await readBytes(request,400000);if(!await validImage(bytes,'image/jpeg'))fail(400,'缩略图格式不正确');
    await files.set('thumbs/'+u.id,bytes);return response({ok:true});
   }
   const complete=path.match(/^\/uploads\/([A-Za-z0-9_-]+)\/complete$/);
   if(complete&&request.method==='POST'){
    const id=complete[1];const existing=await repo.get('records',id);if(existing){if(existing.kind!=='photo')fail(404,'未找到上传');return response(existing);}
    const u=await getUpload(id);const parts=[];const count=Math.ceil(u.size/CHUNK_SIZE);
    for(let i=0;i<count;i++){const key=id+'_'+i;const part=await files.get('chunks/'+key);const meta=await repo.get('chunks',key);if(!part||!meta||digest(part)!==meta.hash)fail(409,'照片尚未完整上传，请重试');parts.push(part);}
    const bytes=Buffer.concat(parts,u.size);if(!await validImage(bytes,u.type))fail(400,'照片文件内容与格式不一致');
    await files.set('originals/'+id,bytes);const thumbnail=await files.get('thumbs/'+id);
    const capture=await captureMetadata(bytes);
    const row={...recordShape('photo',{...capture,...(capture.capturedAt?{date:capture.capturedAt.slice(0,10)}:{}),title:u.filename,filename:u.filename,tags:u.tags,type:u.type,size:u.size,...(u.restoreSourceId?{restoredFrom:u.restoreSourceId,restorePending:true}:{}),motion:u.type==='image/jpeg'&&!!motionVideoRange(bytes),original:'originals/'+id,thumbnail:thumbnail?'thumbs/'+id:null},id),publishedBy:u.publishedBy??null,batchId:u.batchId??id};
    const saved=await repo.put('records',id,row,0);
    for(let i=0;i<count;i++){await files.delete('chunks/'+id+'_'+i);await repo.delete('chunks',id+'_'+i);}await repo.delete('uploads',id);
    const result=saved??await repo.get('records',id);if(result?.kind!=='photo')fail(409,'上传记录已发生变化，请重试');
    return response(result,saved?201:200);
   }
   const motionInfo=path.match(/^\/photos\/([A-Za-z0-9_-]+)\/motion$/);
   if(motionInfo&&request.method==='GET'){
    const row=await repo.get('records',motionInfo[1]);if(!row||row.kind!=='photo'||!active(row))fail(404,'照片不存在');
    if(row.data.type!=='image/jpeg')return response({motion:false,supported:false});
    const bytes=await files.get(row.data.original);if(!bytes)fail(404,'照片文件不存在');
    return response({motion:!!motionVideoRange(bytes),supported:true});
   }
   const media=path.match(/^\/media\/([A-Za-z0-9_-]+)$/);
   if(media&&request.method==='GET'){
    const row=await repo.get('records',media[1]);if(!row||row.kind!=='photo'||row.data.deleting)fail(404,'照片不存在');
    if(url.searchParams.get('motion')==='1'){const bytes=await files.get(row.data.original);if(!bytes)fail(404,'照片文件不存在');return motionResponse(bytes,request.headers.get('range'));}
    const isThumb=url.searchParams.get('thumbnail')==='1'&&row.data.thumbnail;
    const key=isThumb?row.data.thumbnail:row.data.original;
    const body=files.stream?await files.stream(key):await files.get(key);if(!body)fail(404,'照片文件不存在');
    return new Response(body,{headers:{'Content-Type':isThumb?'image/jpeg':row.data.type,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox",'Content-Disposition':(url.searchParams.get('download')==='1'?'attachment':'inline')+"; filename*=UTF-8''"+encodeURIComponent(row.data.filename)}});
   }
   fail(404,'未找到内容');
  } catch(error){return response({error:error.status?error.message:'暂时无法保存，请稍后重试'},error.status??500);}
 };
}

