import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import sharp from 'sharp';
import {createApp} from '../src/server/app.mjs';
import {hashPassword} from '../src/server/auth.mjs';
import {openLocal} from '../src/server/local.mjs';

async function fixture(t){
 const dir=await mkdtemp(join(tmpdir(),'life-v2-'));const store=await openLocal(dir);
 const passwordHash=await hashPassword('shared-upgrade-test');
 const app=createApp({...store,passwordHash,secureCookies:false});let cookie='';
 t.after(async()=>{await store.close();await rm(dir,{recursive:true,force:true})});
 const req=async(path,method='GET',data,headers={})=>{
  const raw=data instanceof Uint8Array;const res=await app(new Request('http://localhost/api'+path,{method,headers:{Origin:'http://localhost',...(cookie?{Cookie:cookie}:{}),...(data!==undefined?{'Content-Type':raw?'application/octet-stream':'application/json'}:{}),...headers},body:data===undefined?undefined:raw?data:JSON.stringify(data)}),{ip:'test'});return res;
 };
 await req('/login','POST',{password:'shared-upgrade-test'}).then(r=>cookie=r.headers.get('set-cookie').split(';')[0]);
 async function add(kind,data,id){const res=await req('/records','POST',{kind,data,...(id?{id}:{})});assert.equal(res.status,201);return res.json()}
 async function photo(sourceId){const bytes=await sharp({create:{width:2,height:2,channels:3,background:'#abcdef'}}).png().toBuffer();const res=await req('/uploads','POST',{filename:'source.png',type:'image/png',size:bytes.length,...(sourceId?{restoreSourceId:sourceId}:{})});assert.equal(res.status,201);const{id}=await res.json();await req('/uploads/'+id+'/chunks/0','PUT',bytes);const row=await(await req('/uploads/'+id+'/complete','POST',{})).json();return {row,bytes}}
 return {req,add,photo,store,app};
}
test('trash preserves original bytes, rejects anonymous media, and restores records',async t=>{
 const f=await fixture(t);const {row,bytes}=await f.photo();const removed=await f.req('/records/'+row.id,'DELETE',{version:row.version});assert.equal(removed.status,200);
 const trashResponse=await f.req('/trash');assert.equal(trashResponse.status,200);const list=await trashResponse.json();assert.equal(list.records.length,1);assert.ok(list.records[0].purgeAt);
 assert.equal((await f.req('/media/'+row.id)).status,404);assert.equal((await(await f.req('/bootstrap')).json()).records.length,0);
 const restored=await f.req('/trash/'+row.id+'/restore','POST',{version:list.records[0].version});assert.equal(restored.status,200);
 assert.deepEqual(Buffer.from(await(await f.req('/media/'+row.id)).arrayBuffer()),bytes);
});
test('locked capsules redact every normal body path until server unlock',async t=>{
 const f=await fixture(t);const letter=await f.add('letter',{title:'未来信',unlockAt:'2099-01-01T00:00:00Z',content:'SECRET-CAPSULE',rawText:'SECRET-CAPSULE',sourceText:'SECRET-CAPSULE',photos:['secret-photo']});
 for(const path of ['/bootstrap','/records','/records/'+letter.id]){const r=await f.req(path);assert.equal(r.status,200);const text=await r.text();assert.ok(!text.includes('SECRET-CAPSULE'),path);assert.ok(!text.includes('secret-photo'),path);assert.ok(text.includes('locked'));}
 const leaked=await f.req('/uploads/'+letter.id+'/complete','POST',{});assert.equal(leaked.status,404);assert.ok(!(await leaked.text()).includes('SECRET-CAPSULE'));
 assert.equal((await f.req('/records/'+letter.id,'PUT',{version:letter.version,data:{title:'绕过',unlockAt:null}})).status,409);
 const past=await f.add('letter',{title:'已到期',unlockAt:'2000-01-01T00:00:00Z',content:'OPENED'});
 assert.equal((await(await f.req('/records/'+past.id)).json()).data.content,'OPENED');
});
test('batch tags/date updates report stale versions without overwriting others',async t=>{
 const f=await fixture(t);const a=(await f.photo()).row,b=(await f.photo()).row;
 await f.req('/records/'+b.id,'PUT',{version:b.version,data:{...b.data,title:'other edit'}});
 const res=await f.req('/photos/batch','POST',{items:[{id:a.id,version:a.version},{id:b.id,version:b.version}],action:'tags',tags:['散步','牵手'],tagsMode:'add'});
 assert.equal(res.status,200);const result=await res.json();assert.deepEqual(result.updated,[a.id]);assert.deepEqual(result.conflicts,[b.id]);
 assert.deepEqual((await(await f.req('/records/'+a.id)).json()).data.tags,['散步','牵手']);
 assert.equal((await f.req('/photos/batch','POST',{items:[{id:a.id,version:2}],action:'date',date:'2026-02-31'})).status,400);
});
test('backup re-verifies password, includes trash originals and excludes credentials',async t=>{
 const f=await fixture(t);const p=(await f.photo()).row;await f.req('/records/'+p.id,'DELETE',{version:p.version});
 assert.equal((await f.req('/backup/media/'+p.id)).status,403);
 assert.equal((await f.req('/backup/manifest','POST',{password:'wrong'})).status,401);
 const response=await f.req('/backup/manifest','POST',{password:'shared-upgrade-test'});assert.equal(response.status,200);const manifest=await response.json();
 assert.equal(manifest.format,'peony-life-backup');assert.equal(manifest.records.length,1);assert.ok(!JSON.stringify(manifest).includes('scrypt:'));
 assert.equal((await f.req('/backup/media/'+p.id)).status,200);
});
test('backup restore remaps attachments and retries without overwriting current notes',async t=>{
 const f=await fixture(t);
 const manifest={format:'peony-life-backup',version:2,createdAt:new Date().toISOString(),settings:{title:'backup',names:['A','B'],tags:[],startDate:null},records:[
 {id:'old-photo',kind:'photo',data:{title:'original title',filename:'source.png',type:'image/png',size:100,tags:['散步']},createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()},
 {id:'old-note',kind:'daily',data:{title:'restored',photos:['old-photo']},createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()}
 ]};
 const prepare=await f.req('/backup/prepare','POST',{password:'shared-upgrade-test',manifest});assert.equal(prepare.status,200);assert.equal((await prepare.json()).neededPhotos.length,1);
 const restored=(await f.photo('old-photo')).row;manifest.records[0].data.size=restored.data.size;
 const res=await f.req('/backup/restore','POST',{manifest,photoMap:{'old-photo':restored.id}});assert.equal(res.status,200);
 const note=await(await f.req('/records/old-note')).json();assert.deepEqual(note.data.photos,[restored.id]);
 await f.req('/records/old-note','PUT',{version:note.version,data:{...note.data,title:'current edit'}});
 await f.req('/backup/restore','POST',{manifest,photoMap:{'old-photo':restored.id}});
 assert.equal((await(await f.req('/records/old-note')).json()).data.title,'current edit');
 const plan=await(await f.req('/backup/prepare','POST',{password:'shared-upgrade-test',manifest})).json();assert.equal(plan.neededPhotos.length,0);assert.equal(plan.photoMap['old-photo'],restored.id);
});

test('expired trash is purged after thirty days and failed file purge is retryable',async t=>{
 const {purgeExpired}=await import('../src/server/advanced.mjs');
 const f=await fixture(t);const {row}=await f.photo();await f.req('/records/'+row.id,'DELETE',{version:row.version});
 const trash=(await(await f.req('/trash')).json()).records[0];
 assert.equal((await purgeExpired(f.store,Date.parse(trash.deletedAt)+29*86400000)).purged,0);
 const originalDelete=f.store.files.delete;let first=true;
 f.store.files.delete=async key=>{if(first){first=false;throw new Error('fixture storage failure')}return originalDelete(key)};
 const failed=await purgeExpired(f.store,Date.parse(trash.deletedAt)+31*86400000);assert.equal(failed.failed,1);
 assert.ok(await f.store.repo.get('records',row.id));
 const retry=await purgeExpired(f.store,Date.parse(trash.deletedAt)+31*86400000);assert.equal(retry.purged,1);assert.equal(await f.store.repo.get('records',row.id),null);
});
test('batch validates every proposed tag update before changing any photo',async t=>{
 const f=await fixture(t);const a=(await f.photo()).row,b=(await f.photo()).row;
 const many=Array.from({length:30},(_,i)=>'tag'+i);
 const changed=await(await f.req('/records/'+b.id,'PUT',{version:b.version,data:{...b.data,tags:many}})).json();
 const res=await f.req('/photos/batch','POST',{items:[{id:a.id,version:a.version},{id:b.id,version:changed.version}],action:'tags',tagsMode:'add',tags:['another']});
 assert.equal(res.status,400);
 assert.deepEqual((await(await f.req('/records/'+a.id)).json()).data.tags,[]);
});


test('restore rejects invalid timestamps before writing any records',async t=>{
 const f=await fixture(t);
 const manifest={format:'peony-life-backup',version:2,settings:{title:'test',names:['A','B'],tags:[],startDate:null},records:[{id:'invalid-time',kind:'daily',data:{title:'bad'},createdAt:{value:'bad'},updatedAt:'2026-10-28T00:00:00Z'}]};
 assert.equal((await f.req('/backup/prepare','POST',{password:'shared-upgrade-test',manifest})).status,400);
 assert.equal(await f.store.repo.get('records','invalid-time'),null);
 assert.equal((await f.req('/records','POST',{kind:'letter',data:{title:'invalid date',unlockAt:'2026-02-31T00:00:00Z'}})).status,400);
});
test('malformed backup content cannot persist objects into rendered text fields',async t=>{
 const f=await fixture(t);
 const base={format:'peony-life-backup',version:2,settings:{title:'test',names:['A','B'],tags:[],startDate:null}};
 for(const [kind,data] of [['daily',{title:'bad',content:{private:'unexpected'}}],['profile',{name:'A',groups:[{label:'偏好',items:{}}]}],['reflection',{title:'bad',event:['not text']}]] ){
  const manifest={...base,records:[{id:'bad-'+kind,kind,data}]};
  assert.equal((await f.req('/backup/prepare','POST',{password:'shared-upgrade-test',manifest})).status,400);
  assert.equal(await f.store.repo.get('records','bad-'+kind),null);
 }
});
test('legacy profile with more than100 short preferences remains exportable',async t=>{
 const f=await fixture(t);await f.store.repo.put('records','legacy-profile',{id:'legacy-profile',kind:'profile',data:{name:'A',groups:[{label:'偏好',items:Array.from({length:101},(_,i)=>({label:'项'+i,value:'说明'}))}]},createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()},0);
 const res=await f.req('/backup/manifest','POST',{password:'shared-upgrade-test'});assert.equal(res.status,200);assert.equal((await res.json()).records[0].data.groups[0].items.length,101);
});
