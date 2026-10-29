import test from 'node:test';import assert from 'node:assert/strict';import { mkdtemp,mkdir,writeFile,rm } from 'node:fs/promises';import{tmpdir}from'node:os';import{join,resolve}from'node:path';import{spawn}from'node:child_process';
test('development server never serves private files as static resources',async t=>{
 const root=await mkdtemp(join(tmpdir(),'peony-dev-check-'));await mkdir(join(root,'.private'));
 await writeFile(join(root,'.private','probe.txt'),'private-fixture-marker');
 await writeFile(join(root,'index.html'),'<!doctype html><title>fixture</title>');
 const child=spawn(process.execPath,[resolve('scripts/dev.mjs'),'--port','4279'],{cwd:root,stdio:['ignore','pipe','pipe']});
 t.after(async()=>{child.kill('SIGTERM');await new Promise(r=>child.on('exit',r));await rm(root,{recursive:true,force:true})});
 await new Promise((resolve,reject)=>{let log='';const timeout=setTimeout(()=>reject(new Error('dev server not ready')),15000);child.stdout.on('data',c=>{log+=c;if(log.includes('Local:')){clearTimeout(timeout);resolve()}});child.once('error',reject)});
 for(const path of ['/.private/probe.txt','/@fs/'+root+'/.private/probe.txt']){
  const res=await fetch('http://localhost:4279'+path);assert.notEqual(res.status,200,path);assert.ok(!(await res.text()).includes('private-fixture-marker'),path);
 }
});

