import http from 'node:http';
import { Readable } from 'node:stream';
import { mkdir,readFile,writeFile } from 'node:fs/promises';
import { createServer as createViteServer } from 'vite';
import { openLocal } from '../src/server/local.mjs';
import { createApp } from '../src/server/app.mjs';
import { hashPassword,newToken } from '../src/server/auth.mjs';
await mkdir('.private',{recursive:true});
let password=process.env.SPACE_PASSWORD;
if(!password){try{password=(await readFile('.private/access.txt','utf8')).trim()}catch{password=newToken();await writeFile('.private/access.txt',password,{mode:0o600})}}
const storage=await openLocal('.private/data');
const app=createApp({...storage,passwordHash:process.env.SPACE_PASSWORD_HASH||await hashPassword(password),secureCookies:false,ai:{apiKey:process.env.CHATANYWHERE_API_KEY,model:process.env.CHATANYWHERE_MODEL,baseURL:process.env.CHATANYWHERE_BASE_URL}});
const vite=await createViteServer({server:{middlewareMode:true,allowedHosts:['terminal.local','localhost'],fs:{deny:['**/.private/**','**/.git/**','**/.env*']}},appType:'spa'});
const portArg=process.argv.indexOf('--port');
const port=Number(process.env.PORT||(portArg>=0?process.argv[portArg+1]:3000));
const hostArg=process.argv.indexOf('--host');
const host=process.env.HOST||(hostArg>=0?process.argv[hostArg+1]:'127.0.0.1');
const server=http.createServer(async(req,res)=>{
 let pathname;try{pathname=decodeURIComponent(req.url?.split('?')[0]||'')}catch{res.writeHead(400);res.end('Bad request');return;}
 if(pathname.split('/').includes('.private')){res.writeHead(403,{'Cache-Control':'no-store'});res.end('Forbidden');return;}
 if(req.url==='/__mobile'){res.writeHead(200,{'Content-Type':'text/html'});res.end('<!doctype html><html><title>Mobile design check</title><body style="margin:0;background:#e7ded8;display:grid;place-items:center"><iframe title="Mobile design preview" src="/__design" style="border:0;width:390px;height:844px;background:white"></iframe></body></html>');return;}
 if(req.url==='/__design'){const html=(await readFile('index.html','utf8')).replace('<head>','<head><script>window.__DESIGN_PREVIEW__=true</script>');res.writeHead(200,{'Content-Type':'text/html','Cache-Control':'no-store'});res.end(await vite.transformIndexHtml('/__design',html));return;}
 if(req.url?.startsWith('/api/')){
  try{
   const controller=new AbortController();
   req.once('aborted',()=>controller.abort());res.once('close',()=>{if(!res.writableEnded)controller.abort()});
   const url='http://'+req.headers.host+req.url;
   const request=new Request(url,{method:req.method,headers:req.headers,signal:controller.signal,body:['GET','HEAD'].includes(req.method)?undefined:Readable.toWeb(req),duplex:'half'});
   const result=await app(request,{ip:req.socket.remoteAddress});
   if(res.destroyed)return;
   res.writeHead(result.status,Object.fromEntries(result.headers));if(result.body)Readable.fromWeb(result.body).pipe(res);else res.end();
  }catch{if(res.destroyed)return;res.writeHead(500,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({error:'暂时无法完成请求'}))}
 }else vite.middlewares(req,res);
});
server.listen(port,host,()=>{console.log('Local: http://localhost:'+port);console.log('本地访问密码保存在 .private/access.txt，仅用于本地验证。')});
async function close(){server.close();await vite.close();await storage.close()}
process.on('SIGTERM',close);process.on('SIGINT',()=>close().then(()=>process.exit(0)));

