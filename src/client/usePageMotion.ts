import{useEffect}from'react';
export function usePageMotion(tab:string,hasData:boolean,loading:boolean){
 useEffect(()=>{
  if(loading)return;const reduced=matchMedia('(prefers-reduced-motion: reduce)'),fine=matchMedia('(hover: hover) and (pointer: fine)');let frame=0,observer:IntersectionObserver|null=null,dispose=()=>{};
  function setup(){dispose();const nodes=Array.from(document.querySelectorAll<HTMLElement>('.workspace main .stat-card,.workspace main .record-card,.workspace main .panel,.workspace main .wish-card,.workspace main .anniversary-card,.workspace main .photo-tile,.workspace main .together-card')).slice(0,120);const hero=document.querySelector<HTMLElement>('.hero,.login-art');
   if(reduced.matches||document.documentElement.dataset.motion==='off')return;
   if(typeof IntersectionObserver!=='undefined'){observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){entry.target.classList.add('is-visible');observer?.unobserve(entry.target)}},{threshold:.06});nodes.forEach((node,i)=>{node.style.setProperty('--reveal-delay',Math.min(i%5,4)*65+'ms');node.classList.add('reveal-pending');observer!.observe(node)});}
   const reset=()=>{cancelAnimationFrame(frame);frame=0;for(const key of ['--petal-x','--petal-y','--tilt-y','--light-x','--light-y'])hero?.style.removeProperty(key)};
   const move=(e:PointerEvent)=>{if(!hero||!fine.matches||e.pointerType==='touch')return;cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{const b=hero.getBoundingClientRect(),x=Math.max(-.5,Math.min(.5,(e.clientX-b.left)/b.width-.5)),y=Math.max(-.5,Math.min(.5,(e.clientY-b.top)/b.height-.5));hero.style.setProperty('--petal-x',x*30+'px');hero.style.setProperty('--petal-y',y*20+'px');hero.style.setProperty('--tilt-y',x*14+'deg');hero.style.setProperty('--light-x',(x+.5)*100+'%');hero.style.setProperty('--light-y',(y+.5)*100+'%');frame=0;});};
   hero?.addEventListener('pointermove',move);hero?.addEventListener('pointerleave',reset);
   dispose=()=>{reset();observer?.disconnect();observer=null;nodes.forEach(n=>{n.classList.remove('reveal-pending','is-visible');n.style.removeProperty('--reveal-delay')});hero?.removeEventListener('pointermove',move);hero?.removeEventListener('pointerleave',reset)};
  }
  setup();reduced.addEventListener('change',setup);window.addEventListener('peony-motion-change',setup);
  const ripple=(event:PointerEvent)=>{if(reduced.matches||document.documentElement.dataset.motion!=='full')return;const button=(event.target as Element).closest<HTMLElement>('.button,.nav-item,.chat-starters button');if(!button||button.hasAttribute('disabled'))return;const bounds=button.getBoundingClientRect();const dot=document.createElement('span');dot.className='touch-ripple';dot.style.left=event.clientX-bounds.left+'px';dot.style.top=event.clientY-bounds.top+'px';button.appendChild(dot);dot.addEventListener('animationend',()=>dot.remove(),{once:true});setTimeout(()=>dot.remove(),800)};
  document.addEventListener('pointerdown',ripple,{passive:true});return()=>{dispose();reduced.removeEventListener('change',setup);window.removeEventListener('peony-motion-change',setup);document.removeEventListener('pointerdown',ripple)};
 },[tab,hasData,loading]);
}
