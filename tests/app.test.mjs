import sharp from 'sharp';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/server/app.mjs';
import { hashPassword } from '../src/server/auth.mjs';
import { openLocal } from '../src/server/local.mjs';

async function fixture(t) {
 const dir=await mkdtemp(join(tmpdir(),'peony-test-'));
 const storage=await openLocal(dir);
 const hash=await hashPassword('a-test-password-2026');
 let app=createApp({...storage,passwordHash:hash,secureCookies:false});
 t.after(async()=>{await storage.close();await rm(dir,{recursive:true,force:true})});
 let cookie='';
 async function req(path,method='GET',data,opts={}) {
  const headers={Origin:'http://localhost',...(cookie?{Cookie:cookie}:{}),...opts.headers};
  if(data!==undefined && !(data instanceof Uint8Array)){headers['Content-Type']='application/json';data=JSON.stringify(data);}
  return app(new Request('http://localhost/api'+path,{method,headers,body:data}),{ip:'127.0.0.1'});
 }
 const login=async()=>{const res=await req('/login','POST',{password:'a-test-password-2026'});assert.equal(res.status,200);cookie=res.headers.get('set-cookie').split(';')[0];return cookie;};
 return {req,login,storage,reopen:()=>{app=createApp({...storage,passwordHash:hash,secureCookies:false});},setCookie:c=>cookie=c};
}
test('private APIs and originals reject anonymous and forged sessions',async t=>{
 const f=await fixture(t);
 for(const p of ['/bootstrap','/media/not-real','/records'])assert.equal((await f.req(p)).status,401);
 f.setCookie('peony-session=forged');assert.equal((await f.req('/bootstrap')).status,401);
 assert.equal((await f.req('/login','POST',{password:'wrong'})).status,401);
});
test('login, durable records, unknown dates, optimistic conflict and logout',async t=>{
 const f=await fixture(t);const cookie=await f.login();
 const create=await f.req('/records','POST',{id:'period-1',kind:'cycle',data:{title:'1月记录',month:1,day:16,year:null}});
 assert.equal(create.status,201);const record=await create.json();assert.equal(record.version,1);
 f.reopen();const boot=await (await f.req('/bootstrap')).json();assert.equal(boot.records[0].data.year,null);
 const updated=await f.req('/records/period-1','PUT',{version:1,data:{title:'保留原文',year:null}});assert.equal(updated.status,200);
 assert.equal((await f.req('/records/period-1','PUT',{version:1,data:{title:'覆盖'}})).status,409);
 assert.equal((await f.req('/logout','POST',{})).status,200);
 f.setCookie(cookie);assert.equal((await f.req('/bootstrap')).status,401);
});
test('writes require same origin and password rotation revokes all old sessions',async t=>{
 const f=await fixture(t);const old=await f.login();
 assert.equal((await f.req('/records','POST',{kind:'daily',data:{title:'bad'}},{headers:{Origin:'https://evil.example'}})).status,403);
 const change=await f.req('/password','POST',{currentPassword:'a-test-password-2026',newPassword:'new-private-password-2026'});
 assert.equal(change.status,200);f.setCookie(old);assert.equal((await f.req('/bootstrap')).status,401);
 assert.equal((await f.req('/login','POST',{password:'a-test-password-2026'})).status,401);
 assert.equal((await f.req('/login','POST',{password:'new-private-password-2026'})).status,200);
});
test('private responses disable caching and repeated bad passwords are limited',async t=>{
 const f=await fixture(t);let last;
 for(let i=0;i<11;i++) last=await f.req('/login','POST',{password:'bad'});
 assert.equal(last.status,429);assert.match(last.headers.get('cache-control'),/no-store/);
});
test('chunked photo upload roundtrips exact bytes and rejects malformed media',async t=>{
 const f=await fixture(t);await f.login();
 // Small valid PNG.
 const bytes=await sharp({create:{width:2,height:2,channels:4,background:'#debbc5'}}).png().toBuffer();
 const begin=await f.req('/uploads','POST',{filename:'a.png',type:'image/png',size:bytes.length,tags:['牵手']});
 assert.equal(begin.status,201);const {id}=await begin.json();
 assert.equal((await f.req('/uploads/'+id+'/chunks/0','PUT',bytes,{headers:{'Content-Type':'application/octet-stream'}})).status,200);
 const complete=await f.req('/uploads/'+id+'/complete','POST',{});assert.equal(complete.status,201);
 assert.equal((await f.req('/uploads/'+id+'/complete','POST',{})).status,200);
 const downloaded=await f.req('/media/'+id);assert.equal(downloaded.status,200);assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()),bytes);
 const bad=await (await f.req('/uploads','POST',{filename:'bad.png',type:'image/png',size:4})).json();
 await f.req('/uploads/'+bad.id+'/chunks/0','PUT',new Uint8Array([1,2,3,4]));
 assert.equal((await f.req('/uploads/'+bad.id+'/complete','POST',{})).status,400);
 assert.equal((await f.req('/uploads','POST',{filename:'big.png',type:'image/png',size:16*1024*1024})).status,400);
});
test('all content types persist, import is idempotent, no config fails closed',async t=>{
 const f=await fixture(t);await f.login();
 const kinds=['daily','place','anniversary','wish','letter','reflection','agreement','profile','cycle'];
 for(const kind of kinds)assert.equal((await f.req('/records','POST',{kind,data:{title:kind,year:null}})).status,201);
 const payload={version:1,settings:{title:'测试',startDate:'2025-11-10',names:['甲','乙']},records:[{id:'seed-example',kind:'profile',data:{title:'测试资料',groups:[]}}]};
 assert.equal((await f.req('/import','POST',payload)).status,200);
 assert.equal((await f.req('/import','POST',payload)).status,200);
 const boot=await (await f.req('/bootstrap')).json();assert.equal(boot.records.length,10);
 const closed=createApp({...f.storage,secureCookies:false});
 assert.equal((await closed(new Request('http://localhost/api/login',{method:'POST',headers:{Origin:'http://localhost','Content-Type':'application/json'},body:JSON.stringify({password:'x'})}),{ip:'x'})).status,503);
});

test('stale settings are rejected and invalid imports write nothing',async t=>{
 const f=await fixture(t);await f.login();
 const s=(await (await f.req('/bootstrap')).json()).settings;
 const a=await f.req('/settings','PUT',{data:{...s,title:'first'}});assert.equal(a.status,200);
 assert.equal((await f.req('/settings','PUT',{data:{...s,title:'stale'}})).status,409);
 const bad=await f.req('/import','POST',{version:1,settings:{title:3,names:null},records:[{id:'should-not-exist',kind:'daily',data:{title:'invalid import'}}]});
 assert.equal(bad.status,400);
 assert.ok(!(await (await f.req('/bootstrap')).json()).records.some(r=>r.id==='should-not-exist'));
});
test('invalid calendar dates and truncated image headers are rejected',async t=>{
 const f=await fixture(t);await f.login();
 assert.equal((await f.req('/records','POST',{kind:'cycle',data:{year:2026,month:2,day:31}})).status,400);
 assert.equal((await f.req('/records','POST',{kind:'cycle',data:{year:null,month:2,day:31}})).status,400);
 const bytes=new Uint8Array([137,80,78,71,13,10,26,10]);
 const u=await (await f.req('/uploads','POST',{filename:'broken.png',type:'image/png',size:bytes.length})).json();
 await f.req('/uploads/'+u.id+'/chunks/0','PUT',bytes);
 assert.equal((await f.req('/uploads/'+u.id+'/complete','POST',{})).status,400);
});
test('permanent purge locks trash metadata before deleting bytes and retries uploads',async t=>{
 const f=await fixture(t);await f.login();
 // Valid tiny PNG generated from the same fixture used for roundtrip tests.
 const bytes=await sharp({create:{width:2,height:2,channels:4,background:'#debbc5'}}).png().toBuffer();
 const u=await (await f.req('/uploads','POST',{filename:'one.png',type:'image/png',size:bytes.length})).json();
 await f.req('/uploads/'+u.id+'/chunks/0','PUT',bytes);
 const photo=await (await f.req('/uploads/'+u.id+'/complete','POST',{})).json();
 assert.equal((await f.req('/uploads/'+u.id+'/chunks/0','PUT',bytes)).status,200);
 await f.req('/records/'+u.id,'DELETE',{version:photo.version});
 const trashed=(await(await f.req('/trash')).json()).records[0];
 const actualDelete=f.storage.files.delete;let release,started;const paused=new Promise(r=>started=r);
 f.storage.files.delete=async key=>{if(key.startsWith('originals/')){started();await new Promise(r=>release=r)}await actualDelete(key)};
 const deletion=f.req('/trash/'+u.id+'/purge','POST',{version:trashed.version});await paused;
 const edited=await f.req('/records/'+u.id,'PUT',{version:photo.version,data:{...photo.data,title:'concurrent'}});
 release();const deleted=await deletion;assert.equal(edited.status,404);assert.equal(deleted.status,200);
});


