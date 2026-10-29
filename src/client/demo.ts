import type { LifeRecord } from './api';
export function clientId(provider:Pick<Crypto,'getRandomValues'>=globalThis.crypto){const bytes=new Uint8Array(16);provider.getRandomValues(bytes);return Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('')}
export const designPreview=()=>typeof window!=='undefined'&&(window as any).__DESIGN_PREVIEW__===true;
const svg=(color:string,variant:number)=>'data:image/svg+xml;charset=utf-8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="900" height="750" viewBox="0 0 900 750"><rect width="900" height="750" fill="'+color+'"/><circle cx="650" cy="160" r="63" fill="#fff2cf"/><path d="M0 520Q140 230 320 410T650 350T900 420V750H0Z" fill="'+(variant?'#91a3a2':'#aea78f')+'"/><path d="M0 580Q190 360 360 510T710 480T900 570V750H0Z" fill="'+(variant?'#6a8c8b':'#7d9386')+'"/><path d="M0 620Q300 500 900 650V750H0Z" fill="'+(variant?'#c0d0cb':'#d9b6a6')+'"/><path d="M400 750Q580 630 500 520" stroke="#f6e5ce" stroke-width="35" fill="none"/><text x="45" y="690" fill="#fffaf0" font-family="serif" font-size="30">a little moment, with you</text></svg>');
const now=new Date().toISOString();
const SAMPLE_PNG='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGM4sXTtfwAHbQManVblfwAAAABJRU5ErkJggg==';
const sampleBytes=()=>Uint8Array.from(atob(SAMPLE_PNG),c=>c.charCodeAt(0));
const media=new Map<string,Blob>();
const demoComments=new Map<string,any[]>();
let records:LifeRecord[]=[
{id:'demo-daily-1',kind:'daily',version:1,createdAt:now,updatedAt:now,data:{title:'把普通的一天，过成喜欢的样子',content:'一起吃饭，聊聊今天的小事。原来幸福也可以这么简单。',date:'2026-10-28',mood:'开心',location:'回家的路上',author:'我们',photos:['demo-photo-1']}},
{id:'demo-daily-2',kind:'daily',version:1,createdAt:now,updatedAt:now,data:{title:'今天的风，刚刚好',content:'晚饭后走了一小段路。没有目的地，也没有着急赶去的地方。',date:'2026-10-27',mood:'平静',location:'街角',author:'我们'}},
{id:'demo-photo-1',kind:'photo',version:1,createdAt:now,updatedAt:now,data:{title:'一起走过的路',tags:['散步','牵手'],previewImage:svg('#e6cbbb',0),filename:'design-sample.png',type:'image/png',size:sampleBytes().length,original:'synthetic',thumbnail:null}},
{id:'demo-photo-2',kind:'photo',version:1,createdAt:now,updatedAt:now,data:{title:'远处有风景，身边有你',tags:['抱抱'],previewImage:svg('#bfd2d1',1),filename:'design-sample.png',type:'image/png',size:sampleBytes().length,original:'synthetic',thumbnail:null}},
{id:'demo-wish-1',kind:'wish',version:1,createdAt:now,updatedAt:now,data:{title:'找一个周末，一起去看日落',content:'带上喜欢的饮料，慢慢等天色变温柔。',done:false}},
{id:'demo-wish-2',kind:'wish',version:1,createdAt:now,updatedAt:now,data:{title:'一起做一顿家常饭',content:'有一点手忙脚乱，也会很开心。',done:false}},
{id:'demo-place-1',kind:'place',version:1,createdAt:now,updatedAt:now,data:{title:'那条走了很久的小路',content:'天气很好，走走停停，想起很多小事。',date:'2026-10-20',location:'城市公园',author:'我们',photos:['demo-photo-2']}},
{id:'demo-anniversary',kind:'anniversary',version:1,createdAt:now,updatedAt:now,data:{title:'一个值得庆祝的日子',month:11,day:10,annual:true,year:null}},
{id:'demo-letter',kind:'letter',version:1,createdAt:now,updatedAt:now,data:{title:'写给平凡日子里的你',content:'想把日子过得慢一点，好认真记住与你有关的每件小事。',author:'我们',date:'2026-10-28'}},
{id:'demo-profile-1',kind:'profile',version:1,createdAt:now,updatedAt:now,data:{slot:0,name:'你',title:'你',groups:[{label:'饮食偏好',items:[{label:'喜欢',value:'清淡、家常菜'},{label:'忌口',value:'香菜'},{label:'辣度',value:'微辣'}]}]}},
{id:'demo-profile-2',kind:'profile',version:1,createdAt:now,updatedAt:now,data:{slot:1,name:'TA',title:'TA',groups:[{label:'饮食偏好',items:[{label:'喜欢',value:'面食'},{label:'辣度',value:'不辣'}]}]}},
{id:'demo-meal-1',kind:'meal',version:1,createdAt:now,updatedAt:now,data:{title:'番茄鸡蛋面',content:'给忙碌的一天留一碗热乎乎的面。少油，汤汁多一点。',ingredients:['番茄','鸡蛋','面条'],spice:'不辣',preferredBy:[0,1],favorite:true}},
{id:'demo-meal-2',kind:'meal',version:1,createdAt:now,updatedAt:now,data:{title:'一份香气满满的拌饭',content:'点单备注：酱汁分开放，按当天想吃的搭配。',ingredients:['米饭','香菜','蔬菜'],spice:'微辣',preferredBy:[1],favorite:false}},
{id:'demo-capsule',kind:'letter',version:1,createdAt:now,updatedAt:now,data:{title:'明年的今天，见字如面',author:'我们',unlockAt:new Date(Date.now()+365*86400000).toISOString(),content:'这是一封合成示例信件。愿未来的我们，也记得今天的小小期待。',photos:['demo-photo-2']}},
{id:'demo-reflection',kind:'reflection',version:1,createdAt:now,updatedAt:now,data:{title:'练习慢慢说，好好听',event:'一次合成的沟通练习',feelingsMine:'想被认真听见。',feelingsOther:'也需要一点整理思绪的时间。',nextAgreement:'先说感受，再一起想办法。',resolved:true}},
{id:'demo-trash',kind:'wish',version:2,createdAt:now,updatedAt:now,deletedAt:now,purgeAt:new Date(Date.now()+30*86400000).toISOString(),data:{title:'一条可以找回的示例心愿',content:'恢复后会回到心愿清单。'}},
{id:'demo-cycle',kind:'cycle',version:1,createdAt:now,updatedAt:now,data:{title:'示例周期记录',year:null,month:10,day:5,displayDate:'10月5日',content:'示例数据，年份待补'}},
];
let settings={version:0,title:'花间日常',names:['你','TA'],startDate:'2026-01-01',tags:['亲亲','牵手','抱抱','散步']};
const uploads=new Map<string,any>();
export function photoSrc(record:LifeRecord,thumb=false){return designPreview()&&record.data.previewImage?record.data.previewImage:'/api/media/'+record.id+(thumb?'?thumbnail=1':'')}
let backupUntil=0;
function fail(message:string,status=400):never{const error=new Error(message);(error as any).status=status;throw error}
function live(r:LifeRecord){return !r.deletedAt&&!r.data.restorePending}
function capsule(r:LifeRecord){return r.kind==='letter'&&Date.parse(r.data.unlockAt)>Date.now()}
function safe(r:LifeRecord):LifeRecord{const copy=structuredClone(r);if(capsule(r)){copy.locked=true;copy.data={title:r.data.title,...(r.data.author?{author:r.data.author}:{}),unlockAt:r.data.unlockAt}}else delete copy.locked;return copy}
function change(r:LifeRecord,data:any){r.data=data;r.version++;r.updatedAt=new Date().toISOString();return safe(r)}
function version(r:LifeRecord,data:any){if(r.version!==data?.version)fail('示例记录已更新，请刷新后重试',409)}
function verify(password:string){if(!password?.trim())fail('演示备份也需要填写一个示例密码');backupUntil=Date.now()+300000}
function backupRights(){if(backupUntil<Date.now())fail('请先填写示例密码重新验证备份',403)}
export async function demoBackupMedia(id:string,thumbnail=false):Promise<Blob>{
 backupRights();const r=records.find(r=>r.id===id&&r.kind==='photo');if(!r)fail('未找到示例照片',404);return media.get(id)??new Blob([sampleBytes()],{type:'image/png'});
}
export async function demoApi(path:string,method='GET',data?:any):Promise<any>{
 if(/^\/photos\/[^/]+\/motion$/.test(path))return{motion:false,supported:true};
 if(path==='/activity')return{events:[]};
 if(path.includes('/comments')){const parts=path.split('/'),id=parts[2];const rows=demoComments.get(id)||[];if(method==='POST'){const row={...data,recordId:id,version:1,createdAt:new Date().toISOString()};demoComments.set(id,[...rows.filter(r=>r.id!==row.id),row]);return row}if(method==='DELETE'){demoComments.set(id,rows.filter(r=>r.id!==parts[4]));return{ok:true}}return{comments:rows};} 
 if(path.endsWith('/capture-time')){const id=path.split('/')[2];const r=records.find(r=>r.id===id);if(r){r.data.captureChecked=true;return r}fail('照片不存在')}
 if(path==='/ai/threads')return{threads:[]};
 if(path.startsWith('/ai/threads/'))return{turns:[]};
 if(path==='/ai/chat')return{id:data.turnId,threadId:data.threadId,input:data.input,state:'ready',reply:'合成界面演示：正式空间中，我能接着聊，也能根据你的要求提出新增或修改。比如添加第一次牵手，请告诉我完整日期。这里不会调用外部 AI，也不会执行真实操作。',actions:[],warnings:[],used:1,limit:100};
 if(path==='/ai/status')return{available:true,provider:'合成演示',model:'preview',used:0,limit:100};
 if(path==='/ai/generate'){if(data?.consent!==true||!data.input?.trim())fail('请填写示例文字并确认');return{text:'合成示例 · 一起收藏普通的一天\n\n今天的片段，被认真放进了生活里。这是界面演示草稿，正式空间会由配置的 AI 服务根据你选择的文字生成。',mode:data.mode,used:1,limit:100};}
 if(path==='/bootstrap')return structuredClone({settings,records:records.filter(live).map(safe),trashCount:records.filter(r=>r.deletedAt&&Date.parse(r.purgeAt!)>Date.now()).length});
 if(path==='/records'&&method==='GET')return {records:records.filter(live).map(safe)};
 if(path==='/trash')return {records:records.filter(r=>r.deletedAt&&Date.parse(r.purgeAt!)>Date.now()).map(safe)};
 if(path==='/logout'||path==='/password')throw new Error('这里是独立的界面演示；正式空间才使用密码登录。');
 if(path==='/import')throw new Error('请在正式的私密空间导入资料；设计预览不保存数据。');
 if(path==='/settings'){settings={...settings,...data.data,version:settings.version+1};return structuredClone(settings)}
 if(path==='/backup/verify'){verify(data.password);return{ok:true}}
 if(path==='/backup/manifest'){verify(data.password);return structuredClone({format:'peony-life-backup',version:2,createdAt:new Date().toISOString(),settings,records:records.filter(r=>!r.data.restorePending&&(!r.purgeAt||Date.parse(r.purgeAt)>Date.now()))})}
 if(path==='/backup/prepare'){verify(data.password);const neededPhotos:LifeRecord[]=[],photoMap:Record<string,string>={};for(const r of data.manifest.records.filter((r:LifeRecord)=>r.kind==='photo')){const existing=records.find(x=>x.kind==='photo'&&(x.id===r.id||x.data.restoredFrom===r.id));if(existing)photoMap[r.id]=existing.id;else neededPhotos.push(r)}return structuredClone({neededPhotos,photoMap})}
 if(path==='/backup/restore'){backupRights();let added=0,skipped=0;for(const source of data.manifest.records){if(source.kind==='photo'){const target=records.find(r=>r.id===data.photoMap[source.id]);if(!target)fail('示例恢复缺少照片');if(target.data.restorePending){const preview=target.data.previewImage;target.data={...source.data,restoredFrom:source.id,previewImage:preview};if(source.deletedAt){target.deletedAt=source.deletedAt;target.purgeAt=source.purgeAt}added++}else skipped++;continue}if(records.some(r=>r.id===source.id||r.data.restoredFrom===source.id)){skipped++;continue}records.push({...structuredClone(source),id:clientId(),version:1,data:{...source.data,restoredFrom:source.id,...(source.data.photos?{photos:source.data.photos.map((id:string)=>data.photoMap[id]??id)}:{})}});added++}return {added,skipped}}
 if(path==='/photos/batch'){
  if(!Array.isArray(data.items)||!data.items.length||data.items.length>200||!['tags','date','trash'].includes(data.action)||data.items.some((i:any)=>typeof i.id!=='string'||!Number.isInteger(i.version))||new Set(data.items.map((i:any)=>i.id)).size!==data.items.length)fail('请选择1到200张照片');
  if(data.action==='tags'&&(!Array.isArray(data.tags)||data.tags.length>30||data.tags.some((t:any)=>typeof t!=='string'||t.length>40)))fail('分类格式不正确');
  if(data.action==='date'&&!/^\d{4}-\d{2}-\d{2}$/.test(data.date))fail('请填写日期');
  const updated:string[]=[],conflicts:string[]=[];for(const item of data.items){const r=records.find(r=>r.id===item.id&&r.kind==='photo'&&live(r));if(!r||r.version!==item.version){conflicts.push(item.id);continue}if(data.action==='trash'){r.deletedAt=new Date().toISOString();r.purgeAt=new Date(Date.now()+30*86400000).toISOString()}change(r,data.action==='tags'?{...r.data,tags:[...new Set(data.tagsMode==='replace'?data.tags:[...(r.data.tags??[]),...data.tags])]}:data.action==='date'?{...r.data,date:data.date}:r.data);updated.push(r.id)}return{updated,conflicts};
 }
 const trash=path.match(/^\/trash\/([^/]+)\/(restore|purge)$/);if(trash){const r=records.find(r=>r.id===trash[1]&&r.deletedAt);if(!r)fail('未找到回收站记录',404);version(r,data);if(trash[2]==='purge'){records=records.filter(x=>x.id!==r.id);media.delete(r.id)}else{delete r.deletedAt;delete r.purgeAt;change(r,r.data)}return{ok:true}}
 if(path==='/records'&&method==='POST'){const record={...structuredClone(data),id:data.id??clientId(),version:1,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};records.push(record);return safe(record)}
 const item=path.match(/^\/records\/([^/]+)$/);
 if(item){const old=records.find(x=>x.id===item[1]&&live(x));if(!old)fail('未找到示例记录',404);if(method==='GET')return safe(old);version(old,data);if(method==='DELETE'){old.deletedAt=new Date().toISOString();old.purgeAt=new Date(Date.now()+30*86400000).toISOString();change(old,old.data);return{ok:true}}if(capsule(old))fail('时间胶囊开启前不能编辑');return change(old,structuredClone(data.data))}
 if(path==='/uploads'){const id=clientId();uploads.set(id,{...data,parts:[]});return{id,chunkSize:1024*1024}}
 const chunk=path.match(/^\/uploads\/(.+)\/chunks\/(\d+)$/);if(chunk){uploads.get(chunk[1]).parts[Number(chunk[2])]=data;return{ok:true}}
 const thumb=path.match(/^\/uploads\/(.+)\/thumbnail$/);if(thumb)return{ok:true};
 const complete=path.match(/^\/uploads\/(.+)\/complete$/);if(complete){const u=uploads.get(complete[1]);const bytes=new Blob(u.parts,{type:u.type});media.set(complete[1],bytes);const row={id:complete[1],kind:'photo',version:1,createdAt:now,updatedAt:now,data:{title:u.filename,filename:u.filename,tags:u.tags??[],type:u.type,size:bytes.size,original:'synthetic',thumbnail:null,...(u.restoreSourceId?{restoredFrom:u.restoreSourceId,restorePending:true}:{}),previewImage:URL.createObjectURL(bytes)}};records.push(row);uploads.delete(complete[1]);return safe(row)}
 throw new Error('此操作请在正式私密空间中使用。');
}
