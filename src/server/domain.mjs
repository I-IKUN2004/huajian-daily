import sharp from 'sharp';
export const KINDS=['daily','place','anniversary','wish','letter','cycle','reflection','agreement','profile','photo','meal'];
export const DEFAULT_SETTINGS={version:0,title:'花间日常',names:['你','TA'],startDate:null,tags:['亲亲','牵手','抱抱','散步']};
export const safeId=id=>typeof id==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(id);
export function validData(kind,data){
 if(!KINDS.includes(kind)||!data||typeof data!=='object'||Array.isArray(data)||JSON.stringify(data).length>48000)return false;
 if(data.unlockAt!==undefined&&data.unlockAt!==null&&!validTimestamp(data.unlockAt))return false;
 if(kind==='meal'&&data.ingredients!==undefined&&(!Array.isArray(data.ingredients)||data.ingredients.length>60||data.ingredients.some(x=>typeof x!=='string'||x.length>60)))return false;
 if(kind==='meal'&&data.preferredBy!==undefined&&(!Array.isArray(data.preferredBy)||data.preferredBy.some(x=>x!==0&&x!==1)))return false;
 for(const key of ['content','rawText','sourceText','event','feelingsMine','feelingsOther','nextAgreement','name','subtitle','author','mood','location','displayDate','spice','completedOn','filename','original','thumbnail','restoredFrom','capturedAt'])if(data[key]!==undefined&&data[key]!==null&&typeof data[key]!=='string')return false;
 for(const key of ['done','resolved','favorite','annual','restorePending','motion','captureChecked'])if(data[key]!==undefined&&typeof data[key]!=='boolean')return false;
 if(data.slot!==undefined&&data.slot!==0&&data.slot!==1)return false;
 if(data.groups!==undefined&&(!Array.isArray(data.groups)||data.groups.some(g=>!g||typeof g.label!=='string'||!Array.isArray(g.items)||g.items.some(i=>!i||typeof i.label!=='string'||typeof i.value!=='string'))))return false;
 if(data.title!==undefined&&(typeof data.title!=='string'||data.title.length>200))return false;
 if(data.photos!==undefined&&(!Array.isArray(data.photos)||data.photos.length>100||data.photos.some(x=>!safeId(x))))return false;
 if(data.tags!==undefined&&(!Array.isArray(data.tags)||data.tags.length>30||data.tags.some(x=>typeof x!=='string'||x.length>40)))return false;
 if(data.year!==undefined&&data.year!==null&&(!Number.isInteger(data.year)||data.year<1900||data.year>2200))return false;
 if(data.month!==undefined&&(!Number.isInteger(data.month)||data.month<1||data.month>12))return false;
 if(data.day!==undefined&&(!Number.isInteger(data.day)||data.day<1||data.day>31))return false;
 if(data.month!==undefined&&data.day!==undefined&&!validCalendar(data.year??2000,data.month,data.day))return false;
 for(const key of ['date','occurredOn','targetDate'])if(data[key]&&!validISO(data[key]))return false;
 return true;
}
export function mediaType(bytes){
 if(bytes.length>=8&&Buffer.from(bytes.slice(0,8)).equals(Buffer.from([137,80,78,71,13,10,26,10])))return'image/png';
 if(bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return'image/jpeg';
 if(bytes.length>=12&&Buffer.from(bytes.slice(0,4)).toString()==='RIFF'&&Buffer.from(bytes.slice(8,12)).toString()==='WEBP')return'image/webp';
 return null;
}
export const MAX_PHOTO=15*1024*1024;
export const CHUNK_SIZE=1024*1024;


export function validCalendar(year,month,day){const d=new Date(Date.UTC(year,month-1,day));return d.getUTCFullYear()===year&&d.getUTCMonth()+1===month&&d.getUTCDate()===day}
export function validISO(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;return validCalendar(...value.split('-').map(Number))}
export function validSettings(data){return !!data&&typeof data.title==='string'&&data.title.length<=60&&Array.isArray(data.names)&&data.names.length===2&&data.names.every(x=>typeof x==='string'&&x.length<=30)&&(!data.tags||(Array.isArray(data.tags)&&data.tags.length<=50&&data.tags.every(x=>typeof x==='string'&&x.length<=40)))&&(!data.startDate||validISO(data.startDate))}
export async function validImage(bytes,type){if(mediaType(bytes)!==type)return false;try{await sharp(bytes,{limitInputPixels:40000000,failOn:'error'}).resize(1,1).toBuffer();return true}catch{return false}}

export function validTimestamp(value){return typeof value==='string'&&value.length<=40&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)&&validISO(value.slice(0,10))&&Number.isFinite(Date.parse(value))}
