import { getDatabase } from '@netlify/database';
import { getStore } from '@netlify/blobs';
export function openCloud(namespace) {
 const db=getDatabase();const store=getStore({name:'peony-'+namespace,consistency:'strong'});
 const decode=row=>row?{...row.value,version:Number(row.version)}:null;
 const repo={
  async get(bucket,key){const rows=await db.sql`SELECT value,version FROM life_documents WHERE namespace=${namespace} AND bucket=${bucket} AND key=${key}`;return decode(rows[0]);},
  async list(bucket){const rows=await db.sql`SELECT value,version FROM life_documents WHERE namespace=${namespace} AND bucket=${bucket}`;return rows.map(decode);},
  async put(bucket,key,value,expected){
   const clean={...value};delete clean.version;const json=JSON.stringify(clean);let rows;
   if(expected===0)rows=await db.sql`INSERT INTO life_documents(namespace,bucket,key,value,version) VALUES(${namespace},${bucket},${key},${json}::jsonb,1) ON CONFLICT(namespace,bucket,key) DO NOTHING RETURNING value,version`;
   else if(Number.isInteger(expected))rows=await db.sql`UPDATE life_documents SET value=${json}::jsonb,version=version+1 WHERE namespace=${namespace} AND bucket=${bucket} AND key=${key} AND version=${expected} RETURNING value,version`;
   else rows=await db.sql`INSERT INTO life_documents(namespace,bucket,key,value,version) VALUES(${namespace},${bucket},${key},${json}::jsonb,1) ON CONFLICT(namespace,bucket,key) DO UPDATE SET value=excluded.value,version=life_documents.version+1 RETURNING value,version`;
   return decode(rows[0]);
  },
  async delete(bucket,key,expected){const rows=Number.isInteger(expected)?await db.sql`DELETE FROM life_documents WHERE namespace=${namespace} AND bucket=${bucket} AND key=${key} AND version=${expected} RETURNING key`:await db.sql`DELETE FROM life_documents WHERE namespace=${namespace} AND bucket=${bucket} AND key=${key} RETURNING key`;return !!rows.length;},
 };
 const files={async set(key,data){await store.set(key,data);},async get(key){const v=await store.get(key,{type:'arrayBuffer'});return v?new Uint8Array(v):null;},async stream(key){return store.get(key,{type:'stream'});},async delete(key){await store.delete(key);}};
 return {repo,files};
}

