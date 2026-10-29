import {validData,validSettings,safeId,validISO,validTimestamp,MAX_PHOTO} from './domain.mjs';
const DAYS30=30*86400000;
export const locked=(row,now=Date.now())=>row.kind==='letter'&&!!row.data.unlockAt&&Date.parse(row.data.unlockAt)>now;
export const active=row=>!row.deletedAt&&!row.purging&&!row.data.restorePending;
export function publicRecord(row,now=Date.now()){
 if(!locked(row,now))return row;
 return {id:row.id,kind:row.kind,version:row.version,createdAt:row.createdAt,updatedAt:row.updatedAt,...(row.deletedAt?{deletedAt:row.deletedAt,purgeAt:row.purgeAt}:{}),locked:true,data:{title:row.data.title,author:row.data.author,unlockAt:row.data.unlockAt}};
}
export function trashValue(row,now=Date.now()){return {...row,deletedAt:new Date(now).toISOString(),purgeAt:new Date(now+DAYS30).toISOString(),updatedAt:new Date(now).toISOString()}}
export async function purgeOne({repo,files},row,expected=row.version){
 if(!row.deletedAt)return {conflict:true};
 let claimed=row;
 if(!row.purging){claimed=await repo.put('records',row.id,{...row,purging:true},expected);if(!claimed)return {conflict:true};}
 else if(expected!==row.version)return {conflict:true};
 if(row.kind==='daily'){for(const comment of await repo.list('comments'))if(comment.recordId===row.id)await repo.delete('comments',JSON.stringify([row.id,comment.id]),comment.version);}
 if(row.kind==='photo'){await files.delete(row.data.original);if(row.data.thumbnail)await files.delete(row.data.thumbnail);}
 return {deleted:await repo.delete('records',row.id,claimed.version)};
}
export async function purgeExpired({repo,files},now=Date.now()){
 let purged=0,failed=0;const until=Date.now()+20000;
 for(const row of await repo.list('records')){
  if(Date.now()>until||purged+failed>=50)break;
  if(row.deletedAt&&Date.parse(row.purgeAt)<=now){try{const r=await purgeOne({repo,files},row);if(r.deleted)purged++;else failed++;}catch{failed++;}}
 }
 return {purged,failed};
}
function manifestOK(m){
 if(!m||m.format!=='peony-life-backup'||m.version!==2||!Array.isArray(m.records)||m.records.length>5000||!validSettings(m.settings)||Buffer.byteLength(JSON.stringify(m),'utf8')>2*1024*1024)return false;
 if(m.comments!==undefined&&(!Array.isArray(m.comments)||m.comments.length>10000||m.comments.some(c=>!c||!safeId(c.id)||!safeId(c.recordId)||![0,1].includes(c.actor)||typeof c.content!=='string'||!c.content.trim()||c.content.length>2000||!validTimestamp(c.createdAt)||!m.records.some(r=>r.id===c.recordId&&r.kind==='daily'))))return false;
 const seen=new Set();
 return m.records.every(r=>{
  if(!r||!safeId(r.id)||seen.has(r.id)||!validData(r.kind,r.data))return false;seen.add(r.id);
  if(r.publishedBy!==undefined&&r.publishedBy!==null&&r.publishedBy!==0&&r.publishedBy!==1)return false;
  if(r.batchId!==undefined&&!safeId(r.batchId))return false;
  if(['createdAt','updatedAt','deletedAt','purgeAt'].some(k=>r[k]!==undefined&&!validTimestamp(r[k])))return false;
  if(r.kind==='photo'&&(!['image/png','image/jpeg','image/webp'].includes(r.data.type)||!Number.isInteger(r.data.size)||r.data.size<1||r.data.size>MAX_PHOTO||typeof r.data.filename!=='string'||r.data.filename.length>200))return false;
  return true;
 });
}
export async function advancedRoutes({path,request,url,who,repo,files,response,json,fail,security,verifyPassword,rateLimit,context}){
 const all=()=>repo.list('records');
 async function verify(){
  const b=await json(request,3*1024*1024);await rateLimit(context.ip??'unknown');const sec=await security();
  if(!await verifyPassword(b.password,sec.passwordHash))fail(401,'当前密码不正确');
  const fresh=await repo.get('sessions',who.key);if(!fresh)fail(401,'请重新进入空间');
  if(!await repo.put('sessions',who.key,{...fresh,backupUntil:Date.now()+5*60000},fresh.version))fail(409,'会话刚发生变化，请重试');
  return b;
 }
 const recent=()=>{if(!who.backupUntil||who.backupUntil<Date.now())fail(403,'请重新确认空间密码后操作备份');};
 if(path==='/trash'&&request.method==='GET')return response({records:(await all()).filter(r=>r.deletedAt&&Date.parse(r.purgeAt)>Date.now()).map(r=>publicRecord(r))});
 const trash=path.match(/^\/trash\/([A-Za-z0-9_-]+)\/(restore|purge)$/);
 if(trash&&request.method==='POST'){
  const b=await json(request);const row=await repo.get('records',trash[1]);if(!row?.deletedAt)fail(404,'回收站记录不存在');
  if(!Number.isInteger(b.version)||b.version!==row.version)fail(409,'记录已变化，请刷新后重试');
  if(trash[2]==='purge'){const result=await purgeOne({repo,files},row,b.version);if(!result.deleted)fail(409,'删除未完成，请刷新重试');return response({ok:true});}
  if(row.purging||Date.parse(row.purgeAt)<=Date.now())fail(409,'这条记录已过保留期限');
  const value={...row};delete value.deletedAt;delete value.purgeAt;value.updatedAt=new Date().toISOString();
  const restored=await repo.put('records',row.id,value,b.version);if(!restored)fail(409,'记录已变化，请刷新重试');return response(publicRecord(restored));
 }
 if(path==='/photos/batch'&&request.method==='POST'){
  const b=await json(request);if(!Array.isArray(b.items)||!b.items.length||b.items.length>200||b.items.some(x=>!safeId(x.id)||!Number.isInteger(x.version)||x.version<1)||new Set(b.items.map(x=>x.id)).size!==b.items.length||!['tags','date','trash'].includes(b.action))fail(400,'批量操作格式不正确');
  if(b.action==='tags'&&(!Array.isArray(b.tags)||b.tags.length>30||b.tags.some(x=>typeof x!=='string'||!x.trim()||x.length>40)||!['add','replace'].includes(b.tagsMode)))fail(400,'分类格式不正确');
  if(b.action==='date'&&b.date!==null&&!validISO(b.date))fail(400,'请选择有效日期');
  const updated=[],conflicts=[],planned=[];
  for(const item of b.items){
   const row=await repo.get('records',item.id);if(!row||row.kind!=='photo'||!active(row)||row.version!==item.version){conflicts.push(item.id);continue;}
   const value=b.action==='trash'?trashValue(row):{...row,updatedAt:new Date().toISOString(),data:{...row.data,...(b.action==='date'?{date:b.date}:{tags:[...new Set(b.tagsMode==='add'?[...(row.data.tags??[]),...b.tags]:b.tags)]})}};
   if(!validData('photo',value.data))fail(400,'批量修改后的分类过多');
   planned.push({row,value,version:item.version});
  }
  for(const {row,value,version} of planned){
   if(await repo.put('records',row.id,value,version))updated.push(row.id);else conflicts.push(row.id);
  }
  return response({updated,conflicts});
 }
 if(path==='/backup/verify'&&request.method==='POST'){await verify();return response({ok:true});}
 if(path==='/backup/manifest'&&request.method==='POST'){
  await verify();const rows=(await all()).filter(r=>!r.purging&&!r.data.restorePending&&(!r.deletedAt||Date.parse(r.purgeAt)>Date.now()));const site=await repo.get('settings','site');
  const settings={title:'花间日常',names:['你','TA'],tags:[],startDate:null,...site?.data};
  const m={format:'peony-life-backup',version:2,createdAt:new Date().toISOString(),settings,records:rows,comments:(await repo.list('comments')).filter(c=>!c.deletedAt&&rows.some(r=>r.id===c.recordId&&r.kind==='daily'))};
  if(!manifestOK(m))fail(413,'记录内容超过单次备份上限，请联系维护者协助导出');return response(m);
 }
 const backupMedia=path.match(/^\/backup\/media\/([A-Za-z0-9_-]+)$/);
 if(backupMedia&&request.method==='GET'){
  recent();const row=await repo.get('records',backupMedia[1]);if(row?.kind!=='photo'||row.purging)fail(404,'备份照片不存在');
  const thumb=url.searchParams.get('thumbnail')==='1';const key=thumb?row.data.thumbnail:row.data.original;if(!key)fail(404,'没有缩略图');
  const body=files.stream?await files.stream(key):await files.get(key);if(!body)fail(404,'照片在备份期间发生变化，请重试');
  return new Response(body,{headers:{'Content-Type':thumb?'image/jpeg':row.data.type,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }
 if(path==='/backup/prepare'&&request.method==='POST'){
  const b=await verify();if(!manifestOK(b.manifest))fail(400,'备份清单无效或超过大小上限');
  const current=await all(),neededPhotos=[],photoMap={};
  for(const source of b.manifest.records.filter(r=>r.kind==='photo')){
   const existing=current.find(r=>r.kind==='photo'&&!r.purging&&(r.id===source.id||r.data.restoredFrom===source.id));
   if(existing)photoMap[source.id]=existing.id;else neededPhotos.push(source);
  }
  return response({neededPhotos,photoMap});
 }
 if(path==='/backup/restore'&&request.method==='POST'){
  recent();const b=await json(request,3*1024*1024);if(!manifestOK(b.manifest)||!b.photoMap||typeof b.photoMap!=='object'||Array.isArray(b.photoMap)||Object.entries(b.photoMap).some(([k,v])=>!safeId(k)||!safeId(v)))fail(400,'备份恢复内容无效');
  const m=b.manifest,targets=new Map();
  for(const source of m.records.filter(r=>r.kind==='photo')){
   const id=b.photoMap[source.id];if(!id)fail(400,'请先恢复完整照片文件');
   const target=await repo.get('records',id);if(target?.kind!=='photo'||target.purging||target.data.size!==source.data.size||target.data.type!==source.data.type)fail(400,'恢复的照片与清单不一致');
   targets.set(source.id,target);
  }
  let added=0,skipped=0;
  for(const source of m.records){
   if(source.kind==='photo'){
    const target=targets.get(source.id);
    if(target.data.restorePending&&target.data.restoredFrom===source.id){
     const data={...source.data,original:target.data.original,thumbnail:target.data.thumbnail,type:target.data.type,size:target.data.size,motion:target.data.motion??false,restoredFrom:source.id,restorePending:false};delete data.deleting;
     const value={...target,data,createdAt:source.createdAt??target.createdAt,updatedAt:new Date().toISOString(),...(source.deletedAt?{deletedAt:new Date().toISOString(),purgeAt:new Date(Date.now()+DAYS30).toISOString()}:{} )};
     if(!await repo.put('records',target.id,value,target.version))fail(409,'恢复中的照片已变化，请重试');added++;
    }else skipped++;
    continue;
   }
   const existing=await repo.get('records',source.id);if(existing){skipped++;continue;}
   const data={...source.data,...(source.data.photos?{photos:source.data.photos.map(id=>b.photoMap[id]??id)}:{})};
   const value={id:source.id,kind:source.kind,data,...(source.publishedBy===0||source.publishedBy===1?{publishedBy:source.publishedBy}:{}),createdAt:source.createdAt??new Date().toISOString(),updatedAt:source.updatedAt??new Date().toISOString(),...(source.deletedAt?{deletedAt:new Date().toISOString(),purgeAt:new Date(Date.now()+DAYS30).toISOString()}:{} )};
   if(await repo.put('records',source.id,value,0))added++;else skipped++;
  }
  for(const c of m.comments??[]){const parent=await repo.get('records',c.recordId);if(parent?.kind==='daily')await repo.put('comments',JSON.stringify([c.recordId,c.id]),{id:c.id,recordId:c.recordId,actor:c.actor,content:c.content,createdAt:c.createdAt},0);}
  if(!await repo.get('settings','site'))await repo.put('settings','site',{data:m.settings},0);
  return response({added,skipped});
 }
 const item=path.match(/^\/records\/([A-Za-z0-9_-]+)$/);
 if(item){
  const row=await repo.get('records',item[1]);if(!row||!active(row))fail(404,'记录不存在');
  if(request.method==='GET')return response(publicRecord(row));
  if(request.method==='PUT'&&locked(row))fail(409,'信件已经封存，到开启时间后才能编辑');
  if(request.method==='DELETE'){
   const b=await json(request);if(!Number.isInteger(b.version)||b.version<1)fail(400,'请刷新后重试');
   const saved=await repo.put('records',row.id,trashValue(row),b.version);if(!saved)fail(409,'记录已变化，请刷新后重试');
   return response({ok:true,version:saved.version,purgeAt:saved.purgeAt});
  }
 }
 if(path.match(/^\/media\/[A-Za-z0-9_-]+$/)){
  const row=await repo.get('records',path.split('/').at(-1));if(row&&!active(row))fail(404,'照片不存在');
 }
 return undefined;
}

