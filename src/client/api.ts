import { designPreview,demoApi } from './demo.ts';
export interface LifeRecord {id:string;kind:string;version:number;data:Record<string,any>;createdAt:string;updatedAt:string;deletedAt?:string;purgeAt?:string;locked?:boolean}
export interface Settings {version?:number;title:string;names:string[];startDate:string|null;tags:string[]}
export interface Bootstrap {settings:Settings;records:LifeRecord[];trashCount?:number}
export class ApiError extends Error {status:number;constructor(message:string,status:number){super(message);this.status=status}}
export async function api(path:string,method='GET',data?:any,options:{signal?:AbortSignal}={}):Promise<any>{
 if(designPreview())return demoApi(path,method,data);
 const raw=data instanceof Blob||data instanceof Uint8Array;
 const res=await fetch('/api'+path,{method,signal:options.signal,credentials:'same-origin',headers:data===undefined?{}:raw?{'Content-Type':'application/octet-stream'}:{'Content-Type':'application/json'},body:data===undefined?undefined:raw?(data instanceof Uint8Array?new Blob([new Uint8Array(data).buffer]):data):JSON.stringify(data)});
 const body=await res.json().catch(()=>({}));
 if(!res.ok){if(res.status===401&&path!=='/login')window.dispatchEvent(new Event('session-expired'));throw new ApiError(body.error||'暂时无法完成，请稍后重试',res.status)}
 return body;
}
export function today(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}
export function daysSince(value:string){return Math.floor((Date.parse(today()+'T00:00:00+08:00')-Date.parse(value+'T00:00:00+08:00'))/86400000)}
export function upcoming(data:Record<string,any>){
 const y=Number(today().slice(0,4));const suffix=data.date?.slice(4)||(data.month&&data.day?'-'+String(data.month).padStart(2,'0')+'-'+String(data.day).padStart(2,'0'):null);
 if(!data.date&&!data.annual)return null;if(!suffix)return null;let date=data.date;if(data.annual){date=y+suffix;if(daysSince(date)>0)date=(y+1)+suffix;}
 return 0-daysSince(date);
}
export async function thumbnail(file:File):Promise<Blob>{
 const bitmap=await createImageBitmap(file);const scale=Math.min(1,800/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));canvas.getContext('2d')!.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
 const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/jpeg',0.72));if(!blob)throw new Error('无法读取这张照片');return blob;
}

