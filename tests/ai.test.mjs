import test from 'node:test';import assert from 'node:assert/strict';
import{mkdtemp,rm}from'node:fs/promises';import{tmpdir}from'node:os';import{join}from'node:path';
import{createApp}from'../src/server/app.mjs';import{openLocal}from'../src/server/local.mjs';import{hashPassword}from'../src/server/auth.mjs';
async function fixture(t,ai={apiKey:'fake-test-key'},fetchImpl=async()=>Response.json({choices:[{message:{content:'一个合成草稿'}}]})){
 const dir=await mkdtemp(join(tmpdir(),'life-ai-'));const storage=await openLocal(dir);const app=createApp({...storage,passwordHash:await hashPassword('ai-test-password'),secureCookies:false,ai,fetchImpl});t.after(async()=>{await storage.close();await rm(dir,{recursive:true,force:true})});let cookie='';
 const req=(path,method='GET',data,headers={},signal)=>app(new Request('http://localhost/api'+path,{method,headers:{Origin:'http://localhost',...(cookie?{Cookie:cookie}:{}),'Content-Type':'application/json',...headers},body:data===undefined?undefined:JSON.stringify(data),signal}),{ip:'test'});
 const login=async()=>{const r=await req('/login','POST',{password:'ai-test-password'});cookie=r.headers.get('set-cookie').split(';')[0]};return{req,login,storage};
}
test('AI status and generation require auth, valid config and explicit reviewed-text consent',async t=>{
 const f=await fixture(t,{});assert.equal((await f.req('/ai/status')).status,401);await f.login();const status=await f.req('/ai/status');assert.equal(status.status,200);assert.equal((await status.json()).available,false);
 assert.equal((await f.req('/ai/generate','POST',{mode:'capture',input:'一起吃饭',consent:true})).status,503);
 const configured=await fixture(t);await configured.login();assert.equal((await configured.req('/ai/generate','POST',{mode:'capture',input:'一起吃饭'})).status,400);
 assert.equal((await configured.req('/ai/generate','POST',{mode:'capture',input:'一起吃饭',consent:true},{Origin:'https://evil.example'})).status,403);
});
test('AI forwards only bounded reviewed text, masks contact patterns and never returns credentials or writes records',async t=>{
 let called;const f=await fixture(t,undefined,async(url,options)=>{called={url,options};return Response.json({choices:[{message:{content:'今天一起吃饭。'}}]})});await f.login();
 const r=await f.req('/ai/generate','POST',{mode:'polish',input:'联系我18800001234 test@example.com 一起吃饭',consent:true,recordIds:['secret'],model:'evil',baseURL:'http://127.0.0.1'});assert.equal(r.status,200);const b=await r.json();assert.equal(b.text,'今天一起吃饭。');assert.ok(!JSON.stringify(b).includes('fake-test-key'));
 assert.equal(called.url,'https://api.chatanywhere.org/v1/chat/completions');const sent=JSON.parse(called.options.body);assert.equal(sent.model,'gpt-4o-mini');assert.ok(!sent.messages[1].content.includes('18800001234'));assert.ok(!sent.messages[1].content.includes('test@example.com'));assert.ok(!JSON.stringify(sent).includes('secret'));assert.equal((await f.storage.repo.list('records')).length,0);
 assert.equal((await f.req('/ai/generate','POST',{mode:'unknown',input:'test',consent:true})).status,400);assert.equal((await f.req('/ai/generate','POST',{mode:'capture',input:'字'.repeat(6001),consent:true})).status,400);
});
test('AI rejects unknown provider hosts and sanitizes upstream errors',async t=>{
 let calls=0;const f=await fixture(t,{apiKey:'fake-test-key',baseURL:'http://localhost/v1'},async()=>{calls++;throw Error('should not call')});await f.login();assert.equal((await(await f.req('/ai/status')).json()).available,false);assert.equal(calls,0);
 const bad=await fixture(t,undefined,async()=>Response.json({error:'fake-test-key'},{status:429}));await bad.login();const r=await bad.req('/ai/generate','POST',{mode:'meal',input:'清淡两人餐',consent:true});assert.equal(r.status,429);assert.ok(!(await r.text()).includes('fake-test-key'));
});
test('AI limits shared daily attempts and concurrent requests atomically',async t=>{
 let release,started;const wait=new Promise(r=>started=r);const f=await fixture(t,undefined,async()=>{started();await new Promise(r=>release=r);return Response.json({choices:[{message:{content:'ok'}}]})});await f.login();
 const first=f.req('/ai/generate','POST',{mode:'recap',input:'合成日常',consent:true});await wait;
 assert.equal((await f.req('/ai/generate','POST',{mode:'capture',input:'another',consent:true})).status,429);release();assert.equal((await first).status,200);
 const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());await f.storage.repo.put('ai_usage',day,{count:100});assert.equal((await f.req('/ai/generate','POST',{mode:'capture',input:'quota',consent:true})).status,429);
});
test('AI handles cancelled and malformed responses, releases its lease, and never leaks upstream secrets',async t=>{
 const f=await fixture(t,undefined,async()=>Response.json({choices:[{message:{content:{bad:true}}}]}));await f.login();const r=await f.req('/ai/generate','POST',{mode:'capture',input:'test',consent:true});assert.equal(r.status,502);assert.equal(await f.storage.repo.get('ai_usage','inflight'),null);
 const cancelled=await fixture(t,undefined,async(url,options)=>{throw new DOMException('fake-test-key','AbortError')});await cancelled.login();const controller=new AbortController();controller.abort();const response=await cancelled.req('/ai/generate','POST',{mode:'capture',input:'test',consent:true},{},controller.signal);assert.equal(response.status,499);assert.ok(!(await response.text()).includes('fake-test-key'));assert.equal(await cancelled.storage.repo.get('ai_usage','inflight'),null);
});
