export const AI_MODES={capture:'随口记',polish:'文字润色',recap:'回忆总结',meal:'点菜建议'};
export function prepareAIInput(value){return typeof value==='string'?value.replace(/(?:\+?86[- ]?)?1[3-9]\d{9}/g,'[手机号已隐藏]').replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[邮箱已隐藏]').trim():'';}
export function aiRecordText(records){return records.filter(r=>!r.deletedAt&&!r.locked&&['daily','place','wish','meal'].includes(r.kind)).map(r=>[r.data.date||'',r.data.title||'',r.data.content||r.data.rawText||''].filter(Boolean).join('\n')).join('\n\n');}
export function aiGenerationGate({status,statusError,input,consent,busy}){
 if(busy)return{ready:false,reason:'正在生成，请稍候。'};
 if(!status)return{ready:false,reason:statusError?'读取 AI 设置失败，请点「重新检查」。':'正在检查 AI 设置，请稍候。'};
 if(!status.available)return{ready:false,reason:'AI 密钥尚未生效，请在 Netlify 保存密钥并重新部署，再点「重新检查」。'};
 if(!prepareAIInput(input))return{ready:false,reason:'先在上方输入想整理的文字。'};
 if(!consent)return{ready:false,reason:'请勾选上方的外部处理确认框，勾选后即可生成。'};
 return{ready:true,reason:'已准备好，只会发送上面预览的文字。'};
}
