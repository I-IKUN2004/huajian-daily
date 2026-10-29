import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,mkdir,writeFile,readFile,rm}from'node:fs/promises';import{tmpdir}from'node:os';import{join,resolve}from'node:path';import{spawnSync}from'node:child_process';
test('standalone preview preserves JavaScript dollar patterns and escaped closing tags',async t=>{
 const root=await mkdtemp(join(tmpdir(),'peony-export-'));t.after(()=>rm(root,{recursive:true,force:true}));
 await mkdir(join(root,'dist','assets'),{recursive:true});
 const source='const dollar="$&";const closing="</script>";';
 await writeFile(join(root,'dist','index.html'),'<html><head><script type="module" src="/assets/app.js"></script><link rel="stylesheet" href="/assets/app.css"></head><body><div id="root"></div></body></html>');
 await writeFile(join(root,'dist','assets','app.js'),source);await writeFile(join(root,'dist','assets','app.css'),'body{color:#333}');
 const out=join(root,'preview.html');const run=spawnSync(process.execPath,[resolve('scripts/make-preview.mjs'),out],{cwd:root,encoding:'utf8'});assert.equal(run.status,0,run.stderr);
 const html=await readFile(out,'utf8');const code=html.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
 assert.equal(code,source.replaceAll('</script','<\\/script'));
 const js=join(root,'check.mjs');await writeFile(js,code);assert.equal(spawnSync(process.execPath,['--check',js]).status,0);
});

