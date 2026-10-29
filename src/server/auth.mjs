import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt=promisify(scryptCallback);
export const digest=value=>createHash('sha256').update(value).digest('hex');
export const newToken=()=>randomBytes(32).toString('base64url');
export async function hashPassword(password) {
 const salt=randomBytes(16).toString('hex');
 const key=await scrypt(password,salt,64,{N:16384,r:8,p:1,maxmem:64*1024*1024});
 return 'scrypt:'+salt+':'+key.toString('hex');
}
export async function verifyPassword(password,hash) {
 if(typeof password!=='string'||password.length>256||typeof hash!=='string')return false;
 const [algorithm,salt,encoded]=hash.split(':');
 if(algorithm!=='scrypt'||!/^[a-f0-9]{32}$/.test(salt??'')||!/^[a-f0-9]{128}$/.test(encoded??''))return false;
 const key=await scrypt(password,salt,64,{N:16384,r:8,p:1,maxmem:64*1024*1024});
 return timingSafeEqual(key,Buffer.from(encoded,'hex'));
}
export function parseCookie(request,name){const text=request.headers.get('cookie')??'';return text.split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='))?.slice(name.length+1)??'';}

