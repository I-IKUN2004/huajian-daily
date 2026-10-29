import React,{useEffect,useState}from'react';import{Sparkles}from'lucide-react';
export default function Ambience(){
 const[level,setLevel]=useState(()=>{try{return ['full','soft','off'].includes(localStorage.getItem('peony-motion')||'')?localStorage.getItem('peony-motion')!:'full'}catch{return'full'}});
 useEffect(()=>{document.documentElement.dataset.motion=level;try{localStorage.setItem('peony-motion',level)}catch{}window.dispatchEvent(new Event('peony-motion-change'))},[level]);
 return <><div className="peony-ambience" aria-hidden="true"><div className="ambient-glow glow-a"/><div className="ambient-glow glow-b"/>{Array.from({length:10},(_,i)=><i key={i} style={{'--petal-i':i} as React.CSSProperties}/>)}</div><button className="motion-switch" title="切换页面动效强度" onClick={()=>setLevel(l=>l==='full'?'soft':l==='soft'?'off':'full')}><Sparkles size={13}/><span>动效：{level==='full'?'灵动':level==='soft'?'柔和':'关闭'}</span></button></>;
}
