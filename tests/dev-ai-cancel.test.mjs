import test from'node:test';import assert from'node:assert/strict';import{mkdtemp,writeFile,readFile,rm}from'node:fs/promises';import{join,resolve}from'node:path';import{tmpdir}from'node:os';import{spawn}from'node:child_process';
async function marker(path){for(let i=0;i<60;i++){try{if(await readFile(path,'utf8'))return true}catch{}await new Promise(r=>setTimeout(r,25))}return false}
test('local browser cancellation aborts the actual upstream request through the HTTP adapter',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'dev-ai-cancel-'));const started=join(dir,'started'),aborted=join(dir,'aborted');const mock=join(dir,'mock.mjs');
 await writeFile(join(dir,'index.html'),'<!doctype html><title>test</title>');
 await writeFile(mock,`import{writeFile}from'node:fs/promises';globalThis.fetch=async(_url,options)=>{await writeFile(${JSON.stringify(started)},'1');return new Promise((resolve,reject)=>{const abort=async()=>{await writeFile(${JSON.stringify(aborted)},'1');reject(new DOMException('cancelled','AbortError'))};if(options.signal.aborted)abort();else options.signal.addEventListener('abort',abort,{once:true})})};`);
 const child=spawn(process.execPath,['--import',mock,resolve('scripts/dev.mjs'),'--port','4281'],{cwd:dir,env:{...process.env,SPACE_PASSWORD:'dev-ai-test-password',CHATANYWHERE_API_KEY:'fake-test-key'},stdio:['ignore','pipe','pipe']});
 t.after(async()=>{child.kill();await new Promise(r=>child.once('exit',r));await rm(dir,{recursive:true,force:true})});
 await new Promise((resolve,reject)=>{let log='';const timer=setTimeout(()=>reject(Error('server not ready')),10000);child.stdout.on('data',d=>{log+=d;if(log.includes('Local:')){clearTimeout(timer);resolve()}});child.once('error',reject)});
 const origin='http://localhost:4281';const login=await fetch(origin+'/api/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({password:'dev-ai-test-password'})});assert.equal(login.status,200);
 const controller=new AbortController();const pending=fetch(origin+'/api/ai/generate',{method:'POST',headers:{Origin:origin,Cookie:login.headers.get('set-cookie').split(';')[0],'Content-Type':'application/json'},body:JSON.stringify({mode:'capture',input:'合成测试',consent:true}),signal:controller.signal}).catch(e=>e);
 assert.ok(await marker(started));controller.abort();await pending;assert.ok(await marker(aborted),'upstream signal must follow browser disconnect');
});
