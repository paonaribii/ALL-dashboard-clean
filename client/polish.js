// Motion layer for the hero numbers: after each render, a count that changed counts up/down from its
// previous value (~0.5 s) and briefly glows. Purely visual; skipped when the viewer prefers reduced motion.
// Outside a real browser (the test harness runs this script in a VM) there is no matchMedia: no motion.
const ufundReduceMotion=typeof matchMedia==='function'?matchMedia('(prefers-reduced-motion: reduce)'):{matches:true};
const ufundLastCounts=new Map();
function ufundAnimateCounts(){
 if(ufundReduceMotion.matches)return;
 document.querySelectorAll('#heroCards .card').forEach(card=>{
  const label=card.querySelector('.kicker')?.textContent,el=card.querySelector('.count');if(!label||!el)return;
  const key=activeTab+'|'+label,target=Number(el.textContent.replace(/[^0-9.-]/g,''));if(!Number.isFinite(target))return;
  const from=ufundLastCounts.get(key);ufundLastCounts.set(key,target);
  if(from===undefined||from===target||ufundReduceMotion.matches)return;
  el.classList.remove('ufund-changed');void el.offsetWidth;el.classList.add('ufund-changed');
  const start=performance.now(),dur=520;
  const step=now=>{const p=Math.min(1,(now-start)/dur),e=1-Math.pow(1-p,3);el.textContent=fmt(Math.round(from+(target-from)*e));if(p<1&&el.isConnected)requestAnimationFrame(step)};
  requestAnimationFrame(step);
 });
}
// The page title follows the open menu tab (Overview, MDM Risk, …) instead of a fixed "Executive Dashboard".
function ufundSyncTitle(){
 if(typeof document==='undefined'||typeof document.querySelector!=='function')return;
 // Brand & Product has its own Brand Group / Product Group cards, so the top hero row would only repeat them.
 document.getElementById('heroCards')?.toggleAttribute('hidden',activeTab==='brand');
 const label=document.querySelector(`[data-tab="${activeTab}"]`)?.textContent.trim(),h1=document.querySelector('h1');
 if(label&&h1&&h1.textContent!==label){h1.textContent=label;document.title=`${label} · UFUND`}
}
const renderBeforePolish=render;
render=function(...args){const out=renderBeforePolish(...args);ufundSyncTitle();ufundAnimateCounts();return out};
