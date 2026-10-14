// Presentation-only enhancements. Existing click handlers and metric functions are untouched.
let interactionTooltip,interactionTooltipOwner,openInlineDetail=null,inlineDetailSequence=0;
function hideInteractionTooltip(){if(interactionTooltip)interactionTooltip.hidden=true;if(interactionTooltipOwner)interactionTooltipOwner.removeAttribute('aria-describedby');interactionTooltipOwner=null}
function showInteractionTooltip(owner,html,event){
 if(!interactionTooltip){interactionTooltip=document.createElement('div');interactionTooltip.id='chartHoverDetail';interactionTooltip.className='chart-hover-detail';interactionTooltip.setAttribute('role','tooltip');document.body.append(interactionTooltip)}
 if(interactionTooltipOwner&&interactionTooltipOwner!==owner)interactionTooltipOwner.removeAttribute('aria-describedby');interactionTooltipOwner=owner;owner.setAttribute('aria-describedby','chartHoverDetail');interactionTooltip.innerHTML=html;interactionTooltip.hidden=false;
 const rect=owner.getBoundingClientRect(),x=event?.clientX??rect.right,y=event?.clientY??rect.top;
 interactionTooltip.style.left=Math.max(8,Math.min(x+14,innerWidth-interactionTooltip.offsetWidth-10))+'px';interactionTooltip.style.top=Math.max(8,Math.min(y+14,innerHeight-interactionTooltip.offsetHeight-10))+'px';
}
function bindInteractionTooltip(el,content){if(el.dataset.hoverBound)return;el.dataset.hoverBound='true';const show=e=>showInteractionTooltip(el,content(),e);el.addEventListener('pointerenter',show);el.addEventListener('pointermove',show);el.addEventListener('pointerleave',hideInteractionTooltip);el.addEventListener('focus',()=>showInteractionTooltip(el,content()));el.addEventListener('blur',hideInteractionTooltip)}
function enhanceMdmDonut(host,rows,total,legendSelector){
 if(!host)return;host.querySelector('.interactive-donut-svg')?.remove();
 const data=Object.fromEntries(aggregate(rows,'MDM_STATUS').map(x=>[x.key,x])),colors=['#1684ff','#163d67','#a1aebf'],ns='http://www.w3.org/2000/svg';
 const svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 320 320');svg.classList.add('interactive-donut-svg');svg.setAttribute('aria-label','สัดส่วนสถานะ MDM');
 const point=(r,a)=>[160+r*Math.sin(a),160-r*Math.cos(a)].join(' ');let angle=0;
 MDM_ORDER.forEach((key,i)=>{const item=data[key]||{contracts:0,hp:0},share=pct(item.contracts,total),span=share/100*Math.PI*2;if(!span)return;
  const end=angle+span,mid=angle+span/2,path=document.createElementNS(ns,'path');let d;
  if(span>=Math.PI*2-0.00001)d=`M160 22 A138 138 0 1 1 160 298 A138 138 0 1 1 160 22 M160 68 A92 92 0 1 0 160 252 A92 92 0 1 0 160 68 Z`;
  else d=`M${point(138,angle)} A138 138 0 ${span>Math.PI?1:0} 1 ${point(138,end)} L${point(92,end)} A92 92 0 ${span>Math.PI?1:0} 0 ${point(92,angle)} Z`;
  path.setAttribute('d',d);path.setAttribute('fill',colors[i]);path.setAttribute('fill-rule','evenodd');path.setAttribute('tabindex','0');path.setAttribute('role','button');path.setAttribute('aria-label',`${key} ${fmt(item.contracts)} สัญญา ${pctText(item.contracts,total)}`);path.dataset.mdmArc=key;path.style.setProperty('--arc-x',Math.sin(mid)*4+'px');path.style.setProperty('--arc-y',-Math.cos(mid)*4+'px');
  const tooltip=()=>`<strong>${esc(key)}</strong><b>${fmt(item.contracts)} สัญญา · ${pctText(item.contracts,total)}</b><span>ของสัญญาตามตัวกรอง</span><span>Value: ${moneyK(item.hp)}</span>`;
  bindInteractionTooltip(path,tooltip);path.onclick=()=>{hideInteractionTooltip();setFilterValues('MDM_STATUS',[key])};path.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();path.onclick()}};svg.append(path);angle=end;
 });
 host.classList.add('has-interactive-donut');host.style.background='transparent';host.prepend(svg);
 if(!total)svg.innerHTML='<circle cx="160" cy="160" r="115" fill="none" stroke="#e5edf6" stroke-width="46"/>';
 if(legendSelector)document.querySelectorAll(legendSelector).forEach(el=>{const key=el.dataset.overviewMdm,item=data[key]||{contracts:0,hp:0};bindInteractionTooltip(el,()=>`<strong>${esc(key)}</strong><b>${fmt(item.contracts)} สัญญา · ${pctText(item.contracts,total)}</b><span>Value: ${moneyK(item.hp)}</span>`)});
}
function closeInlineDetail(restoreFocus=false){if(!openInlineDetail)return;const {container,button,anchor}=openInlineDetail;container.remove();button.setAttribute('aria-expanded','false');button.textContent='⌄';anchor.classList.remove('inline-expanded');if(restoreFocus&&button.isConnected)button.focus();openInlineDetail=null}
function inlineExpandButton(anchor,getContext){
 if(anchor.querySelector(':scope > .inline-expand-button,:scope > td > .inline-expand-button')||anchor.parentElement?.classList.contains('brand-expand-row'))return;
 const button=document.createElement('button');button.type='button';button.className='inline-expand-button';button.textContent='⌄';button.setAttribute('aria-expanded','false');button.setAttribute('aria-label','เปิดหรือพับรายละเอียด '+(anchor.dataset.brand||anchor.dataset.orgName||anchor.dataset.branchName||anchor.dataset.dimensionRow||anchor.dataset.mdmDimensionRow||''));
 let placement=anchor;
 if(anchor.tagName==='TR')anchor.firstElementChild.prepend(button);
 else{const wrapper=document.createElement('div');wrapper.className='brand-expand-row';anchor.before(wrapper);wrapper.append(anchor,button);placement=wrapper}
 button.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape')closeInlineDetail(true)});
 button.onclick=e=>{e.stopPropagation();if(openInlineDetail?.button===button){closeInlineDetail();return}closeInlineDetail();const context=getContext(),pane=document.createElement('div');pane.className='inline-detail-pane';pane.id='inlineDetail'+(++inlineDetailSequence);let container=pane;
  if(anchor.tagName==='TR'){container=document.createElement('tr');container.className='inline-detail-row';const cell=document.createElement('td');cell.colSpan=anchor.cells.length;cell.append(pane);container.append(cell)}
  placement.after(container);button.setAttribute('aria-controls',pane.id);button.setAttribute('aria-expanded','true');button.textContent='⌃';anchor.classList.add('inline-expanded');openInlineDetail={container,button,anchor};renderInlineDetail(pane,context,[]);
 };
}
function renderInlineDetail(pane,context,history,chosenTab){
 const {rows,field,value}=context,t=totals(rows),child=DIMENSIONS[field]?.child||'STATUS';
 const tabs=[...new Set(field==='BRAND'?['MDM_STATUS','MODEL','STATUS']:[child,'MDM_STATUS','STATUS'])],tab=tabs.includes(chosenTab)?chosenTab:tabs[0];
 pane.innerHTML=`<header><div>${history.length?'<button type="button" class="inline-back">← กลับ</button>':''}<strong>${esc(value)} / รายละเอียด</strong><span class="inline-scope">${fmt(t.contracts)} สัญญา · 100% · Value: ${moneyK(t.hp)}</span></div><button type="button" class="inline-close">พับรายละเอียด ↑</button></header><div class="inline-detail-tabs" role="tablist" aria-label="รายละเอียด ${esc(value)}">${tabs.map(key=>`<button type="button" role="tab" aria-selected="${key===tab}" data-inline-tab="${key}">${esc(DIMENSIONS[key]?.label||key)}</button>`).join('')}</div><div class="inline-detail-content" role="tabpanel"></div>`;
 pane.querySelector('.inline-close').onclick=()=>closeInlineDetail(true);pane.querySelector('.inline-back')?.addEventListener('click',()=>{const prior=history.at(-1);renderInlineDetail(pane,prior.context,history.slice(0,-1),prior.tab)});
 pane.querySelectorAll('[data-inline-tab]').forEach(button=>button.onclick=()=>{renderInlineDetail(pane,context,history,button.dataset.inlineTab);pane.querySelector(`[data-inline-tab="${button.dataset.inlineTab}"]`)?.focus()});
 pane.querySelector('.inline-detail-tabs').onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const buttons=[...pane.querySelectorAll('[data-inline-tab]')],index=buttons.indexOf(document.activeElement),next=e.key==='Home'?0:e.key==='End'?buttons.length-1:(index+(e.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;buttons[next].click()};
 const content=pane.querySelector('.inline-detail-content');
 if(tab==='MDM_STATUS'){
  const map=Object.fromEntries(aggregate(rows,'MDM_STATUS').map(x=>[x.key,x]));content.innerHTML=`<div class="inline-mdm-cards">${MDM_ORDER.map((key,i)=>{const x=map[key]||{contracts:0,hp:0};return`<div class="inline-mdm-card tone-${i}"><span>${esc(key)}</span><strong>${fmt(x.contracts)} <small>สัญญา</small></strong><b>${pctText(x.contracts,t.contracts)}</b><small>Value: ${moneyK(x.hp)}</small></div>`}).join('')}</div><div class="inline-mdm-stack" aria-hidden="true">${MDM_ORDER.map((key,i)=>`<span class="tone-${i}" style="width:${pct(map[key]?.contracts||0,t.contracts)}%"></span>`).join('')}</div><small class="inline-denominator">สัดส่วนภายใน ${esc(value)}</small>`;return;
 }
 const data=dimensionData(rows,tab,t.contracts).sort((a,b)=>b.contracts-a.contracts),pageSize=25;let page=0;
 const draw=()=>{const shown=data.slice(page*pageSize,(page+1)*pageSize);content.innerHTML=`<div class="inline-table-wrap"><table class="inline-child-table"><thead><tr><th>${esc(DIMENSIONS[tab]?.label||tab)}</th><th>สัญญา</th><th>สัดส่วน</th><th>Value (K)</th><th>MDM Success</th><th>OD1–OD6</th></tr></thead><tbody>${shown.map((x,i)=>`<tr><td>${!['STATUS','MDM_STATUS'].includes(tab)?`<button type="button" class="inline-child-link" data-child-index="${i}">${esc(x.name)} <span aria-hidden="true">›</span></button>`:esc(displayStatus(x.name))}</td><td>${fmt(x.contracts)}</td><td>${percentLabel(x.sharePct)}</td><td>${moneyK(x.hp)}</td><td>${fmt(x.success)} <small>(${percentLabel(x.successRate)})</small></td><td>${fmt(x.od)} <small>(${percentLabel(x.odRate)})</small></td></tr>`).join('')||'<tr><td colspan="6">ไม่พบข้อมูลตามตัวกรอง</td></tr>'}</tbody></table></div><div class="inline-pager"><span>สัดส่วนภายใน ${esc(value)}</span><button type="button" data-inline-prev ${page===0?'disabled':''}>←</button><span>${page+1} / ${Math.max(1,Math.ceil(data.length/pageSize))}</span><button type="button" data-inline-next ${(page+1)*pageSize>=data.length?'disabled':''}>→</button></div>`;
  content.querySelectorAll('[data-child-index]').forEach(button=>button.onclick=()=>{const x=shown[Number(button.dataset.childIndex)];renderInlineDetail(pane,{rows:rows.filter(r=>String(r[tab]||'No Data')===x.name),field:tab,value:x.name},[...history,{context,tab}])});content.querySelector('[data-inline-prev]').onclick=()=>{page--;draw()};content.querySelector('[data-inline-next]').onclick=()=>{page++;draw()};
 };draw();
}
function enhanceBrandInline(){const scope=filteredIgnoringFields(['BRAND','MODEL']);document.querySelectorAll('#brandBars [data-brand]').forEach(el=>inlineExpandButton(el,()=>({rows:scope.filter(r=>String(r.BRAND)===el.dataset.brand),field:'BRAND',value:el.dataset.brand})))}
function enhanceOrgInline(rows,field){document.querySelectorAll(`[data-org-field="${field}"]`).forEach(el=>inlineExpandButton(el,()=>({rows:rows.filter(r=>String(r[field]||'No Data')===el.dataset.orgName&&(field!=='AM'||String(r.RM||'No Data')===el.dataset.orgParent)),field,value:el.dataset.orgName})))}
function enhanceDimensionInline(rows,field,selector,dataKey){document.querySelectorAll(selector).forEach(el=>inlineExpandButton(el,()=>({rows:rows.filter(r=>String(r[field]||'No Data')===el.dataset[dataKey]),field,value:el.dataset[dataKey]})))}
function trendNumberLabel(point,key){return `<span class="trend-number-label ${key}"><small>${percentLabel(pct(point[key],point.total))}</small><strong>${fmt(point[key])}</strong></span>`}
function trendOutsideLabels(point,max){return ['active','closed'].filter(key=>point[key]/max*270<44).map(key=>trendNumberLabel(point,key)).join('')}
function enhanceChartHovers(){document.querySelectorAll('.time-col[data-trend-total]').forEach(el=>{
 const total=Number(el.dataset.trendTotal),active=Number(el.dataset.trendActive),closed=Number(el.dataset.trendClosed);
 bindInteractionTooltip(el,()=>`<strong>${esc(el.querySelector('.time-label')?.textContent||'')}</strong><b>${fmt(total)} สัญญา</b><span>Active · ${fmt(active)} · ${pctText(active,total)}</span><span>Closed / Exited · ${fmt(closed)} · ${pctText(closed,total)}</span>`);
 el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();el.click()}};
 })}
function enhanceOdHeroCard(){
 const card=[...document.querySelectorAll('#heroCards .card')].find(el=>el.querySelector('.kicker')?.textContent==='OD1–OD6');
 if(!card)return;
 card.querySelector('.od-quick-picks')?.remove();
 // Hover-only preview: swaps this card's own numbers for a single OD status without touching the
 // global filter, so the rest of the dashboard (Active/Normal/etc.) stays visible for comparison.
 const rows=filtered(),t=totals(rows);
 const countEl=card.querySelector('.count'),pctEl=card.querySelector('.pct'),moneyEl=card.querySelector('.money');
 const baseCount=countEl.textContent,basePct=pctEl.textContent,baseMoney=moneyEl.textContent,baseDeltaHtml=card.querySelector('.delta')?.outerHTML||'';
 const restore=()=>{countEl.textContent=baseCount;pctEl.textContent=basePct;moneyEl.textContent=baseMoney;const d=card.querySelector('.delta');if(baseDeltaHtml){if(d)d.outerHTML=baseDeltaHtml;else moneyEl.insertAdjacentHTML('afterend',baseDeltaHtml)}else if(d)d.remove()};
 const preview=key=>{const x=totals(rows.filter(r=>r.STATUS===key));countEl.textContent=fmt(x.contracts);pctEl.textContent=percentLabel(pct(x.contracts,t.contracts));moneyEl.textContent='OD Value: '+moneyK(x.od);const d=card.querySelector('.delta'),html=deltaHtml(yoyFromMap('STATUS',key));if(d)d.outerHTML=html;else moneyEl.insertAdjacentHTML('afterend',html)};
 const row=document.createElement('div');
 row.className='od-quick-picks';
 row.innerHTML=OD_GROUP.map((s,i)=>`<button type="button" data-od-pick="${s}" aria-label="วางเมาส์ดูเฉพาะ ${esc(s)}">${i+1}</button>`).join('');
 row.addEventListener('click',e=>e.stopPropagation());
 row.addEventListener('pointerover',e=>{const btn=e.target.closest('[data-od-pick]');if(btn)preview(btn.dataset.odPick)});
 row.addEventListener('pointerleave',restore);
 row.addEventListener('focusin',e=>{const btn=e.target.closest('[data-od-pick]');if(btn)preview(btn.dataset.odPick)});
 row.addEventListener('focusout',e=>{if(!row.contains(e.relatedTarget))restore()});
 card.appendChild(row);
}
function installTabsDragScroll(){
 const tabs=$('dashboardTabs');if(!tabs||tabs.dataset.dragBound)return;tabs.dataset.dragBound='true';
 let dragging=false,startX=0,startScroll=0,moved=false;
 const updateEdges=()=>{const max=tabs.scrollWidth-tabs.clientWidth;tabs.classList.toggle('can-scroll-start',tabs.scrollLeft>4);tabs.classList.toggle('can-scroll-end',max>4&&tabs.scrollLeft<max-4)};
 tabs.addEventListener('pointerdown',e=>{if(e.pointerType!=='mouse'||tabs.scrollWidth<=tabs.clientWidth)return;dragging=true;moved=false;startX=e.clientX;startScroll=tabs.scrollLeft;tabs.setPointerCapture(e.pointerId);tabs.classList.add('dragging')});
 tabs.addEventListener('pointermove',e=>{if(!dragging)return;const dx=e.clientX-startX;if(Math.abs(dx)>4)moved=true;tabs.scrollLeft=startScroll-dx;updateEdges()});
 const stop=()=>{if(!dragging)return;dragging=false;tabs.classList.remove('dragging')};
 tabs.addEventListener('pointerup',stop);tabs.addEventListener('pointercancel',stop);tabs.addEventListener('pointerleave',stop);
 tabs.addEventListener('click',e=>{if(moved){e.stopPropagation();e.preventDefault();moved=false}},true);
 tabs.addEventListener('scroll',updateEdges,{passive:true});
 window.addEventListener('resize',updateEdges);
 updateEdges();
}
function installInteractionLayer(){
 installTabsDragScroll();
 const wrap=(name,after)=>{const original=window[name];window[name]=function(...args){const result=original.apply(this,args);after(...args);return result}};
 wrap('tidyHero',()=>{if(activeTab==='ufund'){const rows=filtered();enhanceMdmDonut(document.querySelector('.executive-donut'),rows,totals(rows).contracts,'[data-overview-mdm]')}});
 wrap('renderHero',enhanceOdHeroCard);
 wrap('renderMdm',(rows,t)=>enhanceMdmDonut($('mdmDonut'),rows,t.contracts));
 wrap('renderProducts',enhanceBrandInline);wrap('renderOrgSummary',(rows,t,field)=>enhanceOrgInline(rows,field));
 wrap('renderDimension',rows=>enhanceDimensionInline(rows,dimensionField,'[data-dimension-row]','dimensionRow'));
 wrap('renderMdmDimension',rows=>enhanceDimensionInline(rows,mdmDimensionField,'[data-mdm-dimension-row]','mdmDimensionRow'));
 wrap('renderBranch',rows=>enhanceDimensionInline(rows,'BRANCH','[data-branch-name]','branchName'));
 wrap('renderTrend',enhanceChartHovers);
 // Close ephemeral details before any full filter/tab redraw; never retain a stale population.
 const originalRender=render;render=function(...args){hideInteractionTooltip();closeInlineDetail();return originalRender.apply(this,args)};
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){hideInteractionTooltip();closeInlineDetail(true)}});window.addEventListener('scroll',hideInteractionTooltip,true);window.addEventListener('resize',hideInteractionTooltip);
}
