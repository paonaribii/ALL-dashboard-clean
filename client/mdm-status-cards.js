// Approved detail interaction. Reuses the original rendering and aggregation, without filtering.
let mdmStatusPopover=null,mdmStatusAnchor=null,mdmStatusCloseTimer=null,mdmStatusRestoringFocus=false;
function cancelMdmStatusClose(){clearTimeout(mdmStatusCloseTimer);mdmStatusCloseTimer=null}
function scheduleMdmStatusClose(){cancelMdmStatusClose();mdmStatusCloseTimer=setTimeout(()=>closeMdmStatusPopover(),180)}
function closeMdmStatusPopover(restoreFocus=false){
 cancelMdmStatusClose();
 if(mdmStatusPopover)mdmStatusPopover.hidden=true;
 if(mdmStatusAnchor){mdmStatusAnchor.setAttribute('aria-expanded','false');if(restoreFocus&&mdmStatusAnchor.isConnected){mdmStatusRestoringFocus=true;mdmStatusAnchor.focus();mdmStatusRestoringFocus=false}}
 mdmStatusAnchor=null;
}
function showMdmStatusPopover(anchor,item,toggle=false){
 cancelMdmStatusClose();
 if(mdmStatusAnchor===anchor){if(toggle)closeMdmStatusPopover();return}
 closeMdmStatusPopover();
 if(!mdmStatusPopover){mdmStatusPopover=document.createElement('div');mdmStatusPopover.id='mdmStatusPopover';mdmStatusPopover.className='mdm-status-popover';mdmStatusPopover.setAttribute('role','dialog');mdmStatusPopover.onpointerenter=cancelMdmStatusClose;mdmStatusPopover.onpointerleave=e=>{if(e.pointerType!=='touch')scheduleMdmStatusClose()};mdmStatusPopover.onfocusin=cancelMdmStatusClose;mdmStatusPopover.onfocusout=e=>{if(!mdmStatusPopover.contains(e.relatedTarget)&&e.relatedTarget!==mdmStatusAnchor)scheduleMdmStatusClose()};document.body.append(mdmStatusPopover)}
 mdmStatusAnchor=anchor;anchor.setAttribute('aria-expanded','true');
 const name=displayStatus(item.key),entries=[['MDM Success','Success','#27bf79'],['MDM Unsuccess','Unsuccess','#ef4057'],['No MDM','No MDM','#94a3b8']];
 mdmStatusPopover.setAttribute('aria-label','MDM '+name);
 mdmStatusPopover.innerHTML=`<header><div><strong>${esc(name)}</strong><span>${fmt(item.contracts)} สัญญา</span></div><button type="button" aria-label="ปิดรายละเอียด">×</button></header>${entries.map(([key,label,color])=>`<div class="mdm-pop-row"><i class="mdm-pop-dot" style="background:${color}" aria-hidden="true"></i><span>${label}</span><b>${pctText(item.mdm[key]||0,item.contracts)}</b></div>`).join('')}`;
 mdmStatusPopover.hidden=false;mdmStatusPopover.querySelector('button').onclick=()=>closeMdmStatusPopover(true);
 positionMdmStatusPopover();
}
function positionMdmStatusPopover(){
 if(!mdmStatusAnchor||mdmStatusPopover.hidden)return;
 const rect=mdmStatusAnchor.getBoundingClientRect(),box=mdmStatusPopover.getBoundingClientRect();
 if(rect.bottom<0||rect.top>innerHeight){closeMdmStatusPopover();return}
 mdmStatusPopover.style.left=Math.max(12,Math.min(rect.right-box.width,innerWidth-box.width-12))+'px';
 mdmStatusPopover.style.top=Math.max(12,rect.bottom+box.height+12<innerHeight?rect.bottom+12:rect.top-box.height-12)+'px';
}
const renderMdmBeforeStatusPreview=renderMdm;
renderMdm=function(rows,t){
 closeMdmStatusPopover();renderMdmBeforeStatusPreview(rows,t);
 const items=aggregate(rows,'STATUS').sort((a,b)=>b.contracts-a.contracts);
 document.querySelectorAll('#mdmByStatus .mini').forEach((card,i)=>{
  const item=items[i],bar=card.querySelector('.stack');bar.tabIndex=0;bar.setAttribute('role','button');bar.setAttribute('aria-label','ดูสถานะ MDM ของ '+displayStatus(item.key));bar.setAttribute('aria-expanded','false');bar.setAttribute('aria-controls','mdmStatusPopover');
  bar.onpointerenter=e=>{if(e.pointerType!=='touch')showMdmStatusPopover(bar,item)};
  bar.onpointerleave=e=>{if(e.pointerType!=='touch')scheduleMdmStatusClose()};
  bar.onfocus=()=>{if(!mdmStatusRestoringFocus&&matchMedia('(hover: hover)').matches)showMdmStatusPopover(bar,item)};
  bar.onblur=e=>{if(!mdmStatusPopover?.contains(e.relatedTarget))scheduleMdmStatusClose()};
  bar.onclick=e=>{e.stopPropagation();showMdmStatusPopover(bar,item,e.pointerType==='touch')};
  bar.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();showMdmStatusPopover(bar,item)}};
 });
};
const renderBeforeStatusPreview=render;
render=function(...args){closeMdmStatusPopover();return renderBeforeStatusPreview(...args)};
document.addEventListener('click',e=>{if(mdmStatusAnchor&&!mdmStatusAnchor.contains(e.target)&&!mdmStatusPopover.contains(e.target))closeMdmStatusPopover()});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMdmStatusPopover(true)});
window.addEventListener('scroll',positionMdmStatusPopover,true);window.addEventListener('resize',()=>closeMdmStatusPopover());
