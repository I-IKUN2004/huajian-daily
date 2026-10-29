import test from 'node:test';import assert from 'node:assert/strict';
import {groupPhotosByMonth,foodPreferences,mealConflicts,capsuleRefreshDelay} from '../src/client/feature-utils.ts';
const row=(id,data,createdAt='2026-10-02T00:00:00Z')=>({id,kind:'photo',data,createdAt});
test('photo months use explicit date then Shanghai creation date and sort newest first',()=>{
 const grouped=groupPhotosByMonth([row('old',{date:'2025-02-01'}),row('new',{},'2026-09-30T17:00:00Z'),row('same',{date:'2026-10-25'})]);
 assert.deepEqual(grouped.map(g=>[g.month,g.photos.map(p=>p.id)]),[['2026-10',['same','new']],['2025-02',['old']]]);
});
test('meal preferences derive from profile food groups while preserving exact ingredient notes',()=>{
 const p={data:{name:'示例',slot:1,groups:[{label:'基本信息',items:[{label:'喜欢的颜色',value:'蓝色'}]},{label:'饮食偏好',items:[{label:'忌口',value:'花生、香菜'},{label:'喜欢',value:'米饭'},{label:'辣度',value:'微辣'}]}]}};
 const result=foodPreferences([p],['A','B']);assert.deepEqual(result.map(r=>r.value),['花生、香菜','米饭','微辣']);assert.equal(result[0].name,'示例');
 assert.deepEqual(mealConflicts({ingredients:['花生酱','米饭']},result).map(x=>x.ingredient),['花生']);
 assert.deepEqual(mealConflicts({ingredients:['豆腐']},result),[]);
});
test('capsule refresh polls the server around expiry without unmasking local data',()=>{
 const now=Date.parse('2026-10-01T00:00:00Z');assert.equal(capsuleRefreshDelay([{locked:true,data:{unlockAt:'2026-10-01T00:00:05Z'}}],now),5250);
 assert.equal(capsuleRefreshDelay([{locked:true,data:{unlockAt:'2026-09-01T00:00:00Z'}}],now),10000);
 assert.equal(capsuleRefreshDelay([{locked:false,data:{unlockAt:'2026-10-01T00:00:05Z'}}],now),null);
});
import {demoApi,demoBackupMedia} from '../src/client/demo.ts';
test('demo capsules redact ordinary reads while explicit admin backup contains originals',async()=>{
 const capsule=await demoApi('/records','POST',{kind:'letter',data:{title:'Synthetic capsule',content:'synthetic original',sourceText:'synthetic source',photos:['demo-photo-1'],unlockAt:'2200-01-01T00:00:00Z'}});
 assert.equal(capsule.locked,true);assert.equal(capsule.data.content,undefined);assert.equal(capsule.data.photos,undefined);
 const bootstrap=await demoApi('/bootstrap','GET');assert.equal(bootstrap.records.find(r=>r.id===capsule.id).data.sourceText,undefined);
 await assert.rejects(()=>demoApi('/records/'+capsule.id,'PUT',{version:capsule.version,data:{title:'bypass'}}));
 const exported=await demoApi('/backup/manifest','POST',{password:'example only'});assert.equal(exported.records.find(r=>r.id===capsule.id).data.content,'synthetic original');
 const sample=exported.records.find(r=>r.id==='demo-photo-1');const image=await demoBackupMedia(sample.id,false);assert.equal(image.type,sample.data.type);assert.equal(image.size,sample.data.size);
});
test('demo trash restores records and photo batches report per-record version conflicts',async()=>{
 const before=await demoApi('/bootstrap','GET');const photo=before.records.find(r=>r.kind==='photo');
 const result=await demoApi('/photos/batch','POST',{items:[{id:photo.id,version:photo.version},{id:'demo-photo-2',version:999}],action:'tags',tags:['合成测试'],tagsMode:'add'});assert.deepEqual(result.updated,[photo.id]);assert.deepEqual(result.conflicts,['demo-photo-2']);
 const saved=(await demoApi('/bootstrap','GET')).records.find(r=>r.id===photo.id);await demoApi('/records/'+saved.id,'DELETE',{version:saved.version});
 assert.equal((await demoApi('/bootstrap','GET')).records.some(r=>r.id===saved.id),false);
 const trash=(await demoApi('/trash','GET')).records.find(r=>r.id===saved.id);assert.ok(trash.purgeAt);await demoApi('/trash/'+trash.id+'/restore','POST',{version:trash.version});assert.equal((await demoApi('/bootstrap','GET')).records.some(r=>r.id===saved.id),true);
});
test('AI text selection excludes private kinds and masks common contacts without inventing anonymity',async()=>{
 const{prepareAIInput,aiRecordText}=await import('../src/shared/ai-input.mjs');
 const base={createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),version:1};
 const records=[{...base,id:'daily',kind:'daily',data:{title:'散步',content:'一起走走'}},...['profile','cycle','letter','reflection'].map(kind=>({...base,id:kind,kind,data:{title:'PRIVATE'}}))];
 const result=aiRecordText(records);assert.ok(result.includes('一起走走'));assert.ok(!result.includes('PRIVATE'));assert.ok(!prepareAIInput('18800001234 test@example.com').includes('18800001234'));
});
test('AI selected legacy daily records retain the same rawText body shown in the journal',async()=>{
 const{aiRecordText}=await import('../src/shared/ai-input.mjs');const result=aiRecordText([{id:'old',kind:'daily',data:{title:'旧日常',rawText:'这段正文曾经显示在日记卡片中。'}}]);assert.ok(result.includes('这段正文曾经显示在日记卡片中。'));
});

test('AI generation exposes why input, consent or configuration prevents generating',async()=>{
 const{aiGenerationGate}=await import('../src/shared/ai-input.mjs');
 const ready={status:{available:true},input:'今天散步',consent:true,busy:false};
 assert.equal(aiGenerationGate(ready).ready,true);
 for(const [override,reason] of [[{status:null},'正在检查'],[{status:null,statusError:'网络错误'},'重新检查'],[{status:{available:false}},'密钥'],[{input:''},'输入'],[{consent:false},'勾选'],[{busy:true},'正在生成']]){const gate=aiGenerationGate({...ready,...override});assert.equal(gate.ready,false);assert.ok(gate.reason.includes(reason),gate.reason)}
});
test('photos sort by camera day and time; manual dates take precedence over EXIF',()=>{const photos=[row('later-upload',{capturedAt:'2020-05-06T07:00:00'},'2026-10-01T00:00:00Z'),row('later-shot',{capturedAt:'2020-05-06T09:00:00'},'2025-01-01T00:00:00Z'),row('manual',{date:'2020-05-07',capturedAt:'2020-05-06T08:00:00'})];assert.deepEqual(groupPhotosByMonth(photos)[0].photos.map(r=>r.id),['manual','later-shot','later-upload'])});
