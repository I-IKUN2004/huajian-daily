import type {LifeRecord} from './api';
export function photoDate(record:Pick<LifeRecord,'data'|'createdAt'>){
 if(/^\d{4}-\d{2}-\d{2}$/.test(record.data.date??''))return record.data.date as string;
 if(/^\d{4}-\d{2}-\d{2}T/.test(record.data.capturedAt??''))return record.data.capturedAt.slice(0,10);
 const date=new Date(record.createdAt);return Number.isNaN(date.getTime())?'未标日期':new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
}
export function photoSortKey(record:Pick<LifeRecord,'data'|'createdAt'>){const day=photoDate(record);return day+(record.data.capturedAt?.startsWith(day)?record.data.capturedAt.slice(10):'T00:00:00')}
export function groupPhotosByMonth<T extends Pick<LifeRecord,'data'|'createdAt'>>(records:T[]){
 const grouped=new Map<string,T[]>();for(const r of [...records].sort((a,b)=>photoSortKey(b).localeCompare(photoSortKey(a)))){const month=photoDate(r).slice(0,7);grouped.set(month,[...(grouped.get(month)??[]),r])}return [...grouped].map(([month,photos])=>({month,photos}));
}
export interface FoodPreference {name:string;slot:number;label:string;value:string;type:'avoid'|'like'|'note'}
export function foodPreferences(profiles:Pick<LifeRecord,'data'>[],names:string[]):FoodPreference[]{
 const rows:FoodPreference[]=[];profiles.forEach(p=>{const d=p.data;const slot=Number.isInteger(d.slot)?d.slot:names.indexOf(d.name);for(const group of d.groups??[]){for(const item of group.items??[]){const label=String(item.label??'');const value=String(item.value??'').trim();if(!value)continue;const foodGroup=/饮食|食物|口味|吃|餐|菜/.test(group.label??'');if(!foodGroup&&!/饮食|食物|口味|忌口|过敏|不吃|不喜欢吃|喜欢吃|辣度|爱吃/.test(label))continue;rows.push({name:d.name||names[slot]||'档案',slot,label,value,type:/忌|过敏|不吃|不喜欢|讨厌|避免/.test(label)?'avoid':/喜欢|爱吃/.test(label)?'like':'note'})}}});return rows;
}
export function mealConflicts(meal:{ingredients?:string[]},preferences:FoodPreference[]){
 const ingredients=(meal.ingredients??[]).join(' ').toLocaleLowerCase();return preferences.filter(p=>p.type==='avoid').flatMap(p=>p.value.split(/[,，、;；\n]/).map(s=>s.trim()).filter(s=>s&&ingredients.includes(s.toLocaleLowerCase())).map(ingredient=>({...p,ingredient})));
}
export function capsuleRefreshDelay(records:Pick<LifeRecord,'locked'|'data'>[],now=Date.now()){
 const dates=records.filter(r=>r.locked).map(r=>Date.parse(r.data.unlockAt)).filter(Number.isFinite);if(!dates.length)return null;const remaining=Math.min(...dates)-now;return remaining<=0?10000:Math.min(60000,remaining+250);
}
export function localDateTime(iso:string){if(!iso)return '';const d=new Date(iso);if(Number.isNaN(d.getTime()))return '';return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16)}
