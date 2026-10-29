import React,{useEffect,useRef,useState} from 'react';
import {api} from './api';
import {designPreview,demoBackupMedia} from './demo';
type Props={onRefresh:()=>Promise<void>;onNotice:(message:string)=>void};
type Progress={phase:string;loaded:number;total:number};
export default function BackupPanel({onRefresh,onNotice}:Props){
 const[password,setPassword]=useState(''),[file,setFile]=useState<File|null>(null),[busy,setBusy]=useState(false),[progress,setProgress]=useState<Progress|null>(null),[error,setError]=useState('');
 const job=useRef<{worker:Worker;reject:(error:Error)=>void;stream:any}|null>(null);
 useEffect(()=>()=>{if(job.current){job.current.worker.terminate();job.current.stream?.abort().catch(()=>{});job.current.reject(new Error('操作已取消'));job.current=null;}},[]);
 function cancel(){const current=job.current;if(!current)return;current.worker.postMessage({type:'cancel'});current.worker.terminate();current.stream?.abort().catch(()=>{});current.reject(new Error('操作已取消。已恢复的照片会保留，可用同一备份重试。'));job.current=null;}
 async function run(type:'export'|'restore'){
  if(busy||!password.trim()||(type==='restore'&&!file))return;
  setBusy(true);setError('');setProgress({phase:type==='export'?'准备导出':'检查备份',loaded:0,total:1});let stream:any=null,worker:Worker|null=null;
  try{
   if(type==='export'&&typeof(window as any).showSaveFilePicker==='function'){
    const handle=await(window as any).showSaveFilePicker({suggestedName:'peony-life-'+new Date().toISOString().slice(0,10)+'.zip',types:[{description:'ZIP 备份',accept:{'application/zip':['.zip']}}]});stream=await handle.createWritable();
   }
   const parts:BlobPart[]=[];
   worker=new Worker(new URL('./backup.worker.ts',import.meta.url),{type:'module'});
   const result:any=await new Promise((resolve,reject)=>{
    job.current={worker:worker!,reject,stream};
    worker!.onerror=()=>reject(new Error('浏览器无法启动备份处理，请更新浏览器后重试'));
    worker!.onmessage=async event=>{const message=event.data;
     if(message.type==='progress')setProgress({phase:message.phase,loaded:message.loaded,total:message.total});
     else if(message.type==='request'){try{const value=message.media?await demoBackupMedia(message.photoId,message.thumbnail):await api(message.path,message.method,message.data);worker?.postMessage({type:'response',id:message.id,value});}catch(e:any){worker?.postMessage({type:'response',id:message.id,error:e?.message||'备份请求失败'});}}
     else if(message.type==='error')reject(new Error(message.message));
     else if(message.type==='done')resolve(message.result);
     else if(message.type==='chunk'){try{if(stream)await stream.write(message.chunk);else parts.push(message.chunk);worker?.postMessage({type:'ack',sequence:message.sequence});}catch(e){worker?.postMessage({type:'ack',sequence:message.sequence,error:'无法写入备份文件，请检查磁盘空间'});reject(e);}}
    };
    worker!.postMessage({type,password,file:type==='restore'?file:undefined,streaming:!!stream,preview:designPreview()});
   });
   if(!job.current)throw new Error('操作已取消');
   if(type==='export'){
    if(stream)await stream.close();else{const blob=new Blob(parts,{type:'application/zip'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='peony-life-'+new Date().toISOString().slice(0,10)+'.zip';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
    if(!job.current)throw new Error('操作已取消');
    onNotice(stream?'完整备份已保存，请妥善保管。':'完整备份已生成，请在浏览器下载记录中确认保存。');
   }else{
    const summary=`恢复完成：新增 ${result.added} 条，跳过 ${result.skipped} 条已有记录。`;
    try{await onRefresh();onNotice(summary);}catch{onNotice(summary+' 列表暂未刷新，请重新打开。');}
   }
   setPassword('');setProgress({phase:type==='export'?'导出完成':'恢复完成',loaded:1,total:1});
  }catch(e:any){await stream?.abort().catch(()=>{});const message=e?.name==='AbortError'?'操作已取消':e?.message||'备份处理失败，请重试';setError(message);setProgress(null);}
  finally{worker?.terminate();job.current=null;setPassword('');setBusy(false);}
 }
 const percentage=progress&&progress.total>0?Math.min(100,Math.round(progress.loaded/progress.total*100)):0;
 return <section className="panel backup-panel" aria-label="完整备份与恢复">
  <h3>把生活好好保存</h3>
  <p>下载完整 ZIP 备份，或把以前的备份合并回这个空间。</p>
  <div className="backup-private"><strong>这是管理员完整备份</strong><p>包含照片原图、缩略图、回收站，以及尚未开启的时光信原文。备份不含密码哈希或登录会话，但包含完整私人数据，请只保存在你信任的位置。</p></div>
  <label className="backup-label">重新验证共享密码<input type="password" autoComplete="current-password" value={password} disabled={busy} onChange={event=>setPassword(event.target.value)} placeholder="输入空间的共享密码"/></label>
  <button type="button" className="button primary" disabled={busy||!password.trim()} onClick={()=>run('export')}>下载完整备份</button>
  <p className="backup-hint">Chrome / Edge 可直接写入文件，最大 2 GiB；其他浏览器下载上限 256 MiB。每张原图最大 15 MiB，当前服务单次备份最多 5,000 条记录。备份未加密。</p>
  <div className="backup-restore"><label className="backup-label">选择以前的 ZIP 备份<input type="file" accept=".zip,application/zip" disabled={busy} onChange={event=>setFile(event.target.files?.[0]||null)}/></label>
   <p className="backup-hint">恢复只合并缺少的记录，已有内容保持原样。仅在空间尚未配置时恢复设置。中断后可重新选择同一份备份，已恢复的记录会自动跳过。</p>
   <button type="button" className="button outline" disabled={busy||!file||!password.trim()} onClick={()=>run('restore')}>合并恢复备份</button>
  </div>
  {busy&&<div className="backup-progress" role="status" aria-live="polite"><span>{progress?.phase||'正在处理'}{progress&&progress.total>0?` · ${percentage}%`:''}</span><progress max={100} value={percentage}/><button type="button" className="button outline" onClick={cancel}>取消操作</button></div>}
  {error&&<p className="backup-error" role="alert">{error}</p>}
  <style>{`.backup-panel{max-width:680px;display:grid;gap:14px}.backup-panel h3,.backup-panel p{margin:0}.backup-panel h3{font-size:20px}.backup-panel p{line-height:1.7}.backup-private{padding:16px;background:#fff3f1;border:1px solid #e8c6c3;border-radius:14px;color:#603633}.backup-private p{margin-top:6px}.backup-label{display:grid;gap:8px;font-weight:600}.backup-label input{width:100%;min-height:46px;box-sizing:border-box}.backup-panel button{min-height:46px;width:fit-content;padding:10px 18px}.backup-hint{color:#655c60;font-size:14px}.backup-restore{display:grid;gap:12px;padding-top:18px;border-top:1px solid #e8dddd}.backup-progress{display:grid;gap:10px;padding:14px;background:#f5f1f1;border-radius:12px}.backup-progress progress{width:100%;accent-color:#a74e65}.backup-error{color:#9a2525;background:#fff0ed;padding:12px;border-radius:10px}.backup-panel input:focus-visible,.backup-panel button:focus-visible{outline:3px solid #9b4660;outline-offset:3px}.backup-panel button:disabled{opacity:.55;cursor:not-allowed}`}</style>
 </section>;
}
