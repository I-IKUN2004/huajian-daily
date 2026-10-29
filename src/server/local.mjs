import { DatabaseSync } from 'node:sqlite';
import { mkdir,readFile,writeFile,unlink } from 'node:fs/promises';
import { join } from 'node:path';
export async function openLocal(directory) {
 await mkdir(join(directory,'files'),{recursive:true});
 const db=new DatabaseSync(join(directory,'life.sqlite'));
 db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS documents(bucket TEXT NOT NULL,key TEXT NOT NULL,value TEXT NOT NULL,version INTEGER NOT NULL,PRIMARY KEY(bucket,key));');
 const decode=row=>row?{...JSON.parse(row.value),version:row.version}:null;
 const repo={
  async get(bucket,key){return decode(db.prepare('SELECT value,version FROM documents WHERE bucket=? AND key=?').get(bucket,key));},
  async list(bucket){return db.prepare('SELECT value,version FROM documents WHERE bucket=?').all(bucket).map(decode);},
  async put(bucket,key,value,expected) {
   const clean={...value};delete clean.version;
   if(expected===0){const result=db.prepare('INSERT OR IGNORE INTO documents VALUES(?,?,?,1)').run(bucket,key,JSON.stringify(clean));if(!result.changes)return null;}
   else if(Number.isInteger(expected)){const result=db.prepare('UPDATE documents SET value=?,version=version+1 WHERE bucket=? AND key=? AND version=?').run(JSON.stringify(clean),bucket,key,expected);if(!result.changes)return null;}
   else db.prepare('INSERT INTO documents VALUES(?,?,?,1) ON CONFLICT(bucket,key) DO UPDATE SET value=excluded.value,version=documents.version+1').run(bucket,key,JSON.stringify(clean));
   return repo.get(bucket,key);
  },
  async delete(bucket,key,expected){const q=Number.isInteger(expected)?db.prepare('DELETE FROM documents WHERE bucket=? AND key=? AND version=?').run(bucket,key,expected):db.prepare('DELETE FROM documents WHERE bucket=? AND key=?').run(bucket,key);return !!q.changes;},
 };
 const keyPath=key=>join(directory,'files',Buffer.from(key).toString('hex'));
 const files={async set(key,data){await writeFile(keyPath(key),new Uint8Array(data));},async get(key){try{return new Uint8Array(await readFile(keyPath(key)));}catch(e){if(e.code==='ENOENT')return null;throw e;}},async delete(key){try{await unlink(keyPath(key));}catch(e){if(e.code!=='ENOENT')throw e;}}};
 return {repo,files,close:async()=>db.close()};
}

