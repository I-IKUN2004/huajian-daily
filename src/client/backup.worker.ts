import {buildBackup,restoreBackup,BACKUP_LIMITS} from './backup-utils.mjs';
// Keep all ZIP parsing, CRC work and photo transfers off the React thread.
const scope=globalThis as any;
let active=false,aborted=false,lastProgress=0,sequence=0,preview=false,requestSequence=0,lastVerified=0,verificationPassword='';
const delegated=new Map<number,{resolve:(value:any)=>void,reject:(e:Error)=>void}>();
function delegate(payload:any){const id=requestSequence++;return new Promise<any>((resolve,reject)=>{delegated.set(id,{resolve,reject});scope.postMessage({type:'request',id,...payload});});}
async function renewVerification(){if(lastVerified&&Date.now()-lastVerified>120000){await request('/backup/verify','POST',{password:verificationPassword});lastVerified=Date.now();}}
const acknowledgements=new Map<number,{resolve:()=>void,reject:(e:Error)=>void}>();
const controller=new AbortController();
async function request(path:string,method='GET',data?:any):Promise<any>{
 if(!['/backup/manifest','/backup/prepare','/backup/verify'].includes(path))await renewVerification();
 if(preview){const result=await delegate({path,method,data});if(path==='/backup/manifest'||path==='/backup/prepare')lastVerified=Date.now();return result;}
 const binary=data instanceof Uint8Array;
 const response=await fetch('/api'+path,{method,credentials:'same-origin',signal:controller.signal,headers:data===undefined?{}:{'Content-Type':binary?'application/octet-stream':'application/json'},body:data===undefined?undefined:binary?new Blob([new Uint8Array(data).buffer]):JSON.stringify(data)});
 const body=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(body.error||(response.status===401||response.status===403?'验证已过期，请重新输入共享密码后重试':'请求失败，请稍后重试'));
 if(path==='/backup/manifest'||path==='/backup/prepare')lastVerified=Date.now();
 return body;
}
function progress(value:any){const now=Date.now();if(now-lastProgress<150&&value.loaded!==value.total)return;lastProgress=now;scope.postMessage({type:'progress',...value});}
async function emitChunk(chunk:Uint8Array){if(aborted)throw new Error('操作已取消');const sequenceId=sequence++;await new Promise<void>((resolve,reject)=>{acknowledgements.set(sequenceId,{resolve,reject});scope.postMessage({type:'chunk',sequence:sequenceId,chunk},[chunk.buffer]);});}
scope.onmessage=async(event:MessageEvent)=>{
 const message=event.data;
 if(message.type==='response'){const pending=delegated.get(message.id);if(pending){delegated.delete(message.id);message.error?pending.reject(new Error(message.error)):pending.resolve(message.value);}return;}
 if(message.type==='ack'){const ack=acknowledgements.get(message.sequence);if(ack){acknowledgements.delete(message.sequence);message.error?ack.reject(new Error(message.error)):ack.resolve();}return;}
 if(message.type==='cancel'){aborted=true;controller.abort();for(const ack of acknowledgements.values())ack.reject(new Error('操作已取消'));return;}
 if(active)return;active=true;preview=!!message.preview;verificationPassword=message.password;
 try{
  if(message.type==='export'){
   progress({phase:'验证共享密码',loaded:0,total:1});
   const manifest=await request('/backup/manifest','POST',{password:message.password});
   const readMedia=async(id:string,thumbnail:boolean)=>{await renewVerification();if(preview)return delegate({media:true,photoId:id,thumbnail});const response=await fetch('/api/backup/media/'+encodeURIComponent(id)+(thumbnail?'?thumbnail=1':''),{credentials:'same-origin',signal:controller.signal});if(!response.ok){const error=await response.json().catch(()=>({}));throw new Error(error.error||'照片下载失败，请重新验证密码后重试');}const limit=thumbnail?BACKUP_LIMITS.thumbnail:BACKUP_LIMITS.original;const declared=Number(response.headers.get('Content-Length'));if(declared>limit)throw new Error('照片文件超过备份大小上限');if(!response.body)throw new Error('浏览器无法读取照片数据');const reader=response.body.getReader(),chunks:Uint8Array[]=[];let size=0;try{while(true){const{done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit)throw new Error('照片文件超过备份大小上限');chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}return new Blob(chunks as BlobPart[]);};
   const result=await buildBackup(manifest,readMedia,emitChunk,{maxBytes:message.streaming?BACKUP_LIMITS.archive:BACKUP_LIMITS.fallback,cancelled:()=>aborted,onProgress:progress});
   scope.postMessage({type:'done',result});
  }else if(message.type==='restore'){
   const result=await restoreBackup(message.file,{
    prepare:(manifest:any)=>request('/backup/prepare','POST',{password:message.password,manifest}),
    createUpload:(row:any)=>request('/uploads','POST',{filename:row.data.filename||row.data.title||'restored-photo',type:row.data.type,size:row.data.size,tags:row.data.tags||[],restoreSourceId:row.id}),
    uploadChunk:(id:string,index:number,bytes:Uint8Array)=>request('/uploads/'+id+'/chunks/'+index,'PUT',bytes),
    uploadThumbnail:(id:string,bytes:Uint8Array)=>request('/uploads/'+id+'/thumbnail','PUT',bytes),
    completeUpload:(id:string)=>request('/uploads/'+id+'/complete','POST',{}),
    commit:(manifest:any,photoMap:any)=>request('/backup/restore','POST',{manifest,photoMap}),
   },{cancelled:()=>aborted,onProgress:progress});
   scope.postMessage({type:'done',result});
  }else throw new Error('未知备份操作');
 }catch(error){scope.postMessage({type:'error',message:error instanceof Error?error.message:'备份处理失败'});}finally{verificationPassword='';}
};
