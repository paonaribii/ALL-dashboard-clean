let branchPage=0,branchSize=10,branchQuery='';
// Show a confirmed No MDM (device found in an MDM file) separately from a device missing from every MDM
// file. Off for now: both are shown together as "No MDM" until the MDM data is updated. MDM_CHECK stays in
// the data, so turning this back on needs no rebuild of the data.
const SPLIT_NO_MDM=false;
function tidyHero(rows){
 const host=$('heroCards');
 if(SPLIT_NO_MDM)for(const card of host.querySelectorAll('.card'))if(card.querySelector('.kicker')?.textContent==='No MDM'){
  const note=document.createElement('div');note.className='mdm-check-note';note.textContent=mdmCheckNote(rows||filtered());
  const delta=card.querySelector('.delta');delta?card.insertBefore(note,delta):card.append(note)}host.classList.toggle('paired', ['ufund','rm','am'].includes(activeTab));host.classList.toggle('executive-layout',activeTab==='ufund');
 if(!host.classList.contains('paired'))return;
 const cards=[...host.children],byLabel=new Map(cards.map(c=>[c.querySelector('.kicker')?.textContent,c]));
 const groups=[['ยอดรวม',['Total']],['สถานะสัญญา',['Active','Closed / Exited']],['สถานะลูกหนี้',['Normal','OD1–OD6']],['ระบบ',['K2','ILOAN']],['ประเภทสินเชื่อ',['Personal','Student']]];
 host.replaceChildren();for(const [title,labels]of groups){const group=document.createElement('div');group.className='hero-pair';const heading=document.createElement('h3');heading.textContent=title;group.append(heading);for(const label of labels)if(byLabel.has(label))group.append(byLabel.get(label));host.append(group)}
 if(activeTab==='ufund')layoutOverview(host,byLabel);
}
// Reparent the existing cards: keep their labels, values and click handlers intact.
function layoutOverview(host,byLabel){
 const groups=[...host.children],main=document.createElement('div');main.className='executive-main';
 const composition=document.createElement('section');composition.className='executive-composition';
 const heading=document.createElement('h3');heading.textContent='องค์ประกอบสัญญา';composition.append(heading,groups[3],groups[4]);
 const closedReasons=document.createElement('section');closedReasons.className='executive-composition executive-closed-reasons';closedReasons.id='executiveClosedReasons';
 const closedHeading=document.createElement('h3');closedHeading.textContent='สถานะปิดบัญชี';closedReasons.append(closedHeading);
 const compositionRow=document.createElement('div');compositionRow.className='executive-composition-row';compositionRow.append(composition,closedReasons);
 main.append(groups[0],groups[1],groups[2],compositionRow);host.append(main);
 for(const [label,card]of byLabel){card.tabIndex=0;card.setAttribute('role','button');card.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();card.click()}};
  const arrow=document.createElement('span');arrow.className='executive-chevron';arrow.setAttribute('aria-hidden','true');arrow.textContent='›';card.append(arrow);
  if(label==='Closed / Exited')card.classList.add('executive-closed');
  if(['K2','ILOAN','Personal','Student'].includes(label)){const track=document.createElement('span');track.className='executive-track';track.setAttribute('aria-hidden','true');const bar=document.createElement('span');bar.style.width=Math.max(0,Math.min(100,parseFloat(card.querySelector('.pct').textContent)||0))+'%';track.append(bar);card.append(track)}
 }
 const rows=filtered(),t=totals(rows),split=mdmCheckSplit(rows);
 // With SPLIT_NO_MDM, No MDM is shown in two parts: confirmed by the MDM files vs. not found in any file.
 const entries=[['Success','#1684ff',split.success,['MDM Success']],['Unsuccess','#163d67',split.unsuccess,['MDM Unsuccess']],...(SPLIT_NO_MDM?[['No MDM (ยืนยัน)','#7d8da1',split.confirmed,['No MDM','ยืนยันแล้ว']],['ไม่พบข้อมูล','#d3dae4',split.notFound,['No MDM','ไม่พบข้อมูล']]]:[['No MDM','#a1aebf',split.confirmed+split.notFound,['No MDM']]])];
 let start=0;
 const segments=entries.map(([,color,count])=>{const end=start+pct(count,t.contracts),part=`${color} ${start}% ${end}%`;start=end;return part});
 const side=document.createElement('section');side.className='executive-mdm panel';side.innerHTML=`<header><h3>MDM Overview</h3><button type="button" class="executive-mdm-link">ดูรายละเอียด ↗</button></header><div class="executive-donut" style="background:${t.contracts?'conic-gradient('+segments.join(',')+')':'#e6edf5'}"><div><strong>MDM</strong><span>${fmt(t.contracts)} สัญญา</span></div></div><div class="executive-mdm-legend">${entries.map(([label,color,count],i)=>`<button type="button" data-overview-i="${i}"><span class="executive-mdm-dot" style="background:${color}"></span><span>${esc(label)}</span><strong>${fmt(count)}</strong><span class="executive-share">${pctText(count,t.contracts)}</span><span aria-hidden="true">›</span></button>`).join('')}</div>`;
 side.querySelector('.executive-mdm-link').onclick=()=>selectTab('mdm');
 side.querySelectorAll('[data-overview-i]').forEach(button=>button.onclick=()=>{const [status,check]=entries[+button.dataset.overviewI][3];setFilterValues('MDM_CHECK',check?[check]:[]);setFilterValues('MDM_STATUS',[status])});host.append(side);
}
function mdmCheckSplit(rows){
 const s={success:0,unsuccess:0,confirmed:0,notFound:0};
 for(const r of rows){const c=num(r.CONTRACTS);if(r.MDM_STATUS==='MDM Success')s.success+=c;else if(r.MDM_STATUS==='MDM Unsuccess')s.unsuccess+=c;else if(r.MDM_CHECK==='ยืนยันแล้ว')s.confirmed+=c;else s.notFound+=c}
 return s;
}
function mdmCheckNote(rows){const s=mdmCheckSplit(rows);return`ยืนยัน ${fmt(s.confirmed)} · ไม่พบข้อมูล ${fmt(s.notFound)}`}
function tidyStatus(rows){
 const host=$('statusCards'),cards=[...host.children],map=new Map(cards.map(c=>[c.dataset.status,c]));
 // The Normal / OD1-OD6 / New status cards are replaced by the OD bucket chart (Normal and the OD
 // total already have their own hero cards above).
 host.classList.add('od-chart-mode');
 renderOdBucketChart(host,rows||filtered());
 // Move the 5 closed-reason cards into the "สถานะปิดบัญชี" panel beside "องค์ประกอบสัญญา"
 // (built by layoutOverview) instead of leaving that panel empty.
 const closedReasons=['Sold Debt','Contract Terminated','Early Closure','Closed Account','Write Off'];
 const closedPanel=$('executiveClosedReasons');
 const reasonLine=document.createElement('div');reasonLine.className=closedPanel?'closed-reasons-line':'status-line';
 for(const key of closedReasons){const c=map.get(key);if(!c)continue;reasonLine.append(c)}
 if(reasonLine.querySelector('.status-card'))(closedPanel||host).append(reasonLine);
}
function branchPageRows(sorted){const matching=sorted.filter(x=>!branchQuery||[x.branch,x.channel,x.rm,x.am,x.province].join(' ').toLowerCase().includes(branchQuery.toLowerCase()));branchPage=Math.min(branchPage,Math.max(0,Math.ceil(matching.length/branchSize)-1));window.branchPageTotal=matching.length;return matching.slice(branchPage*branchSize,(branchPage+1)*branchSize)}
function branchPager(){
 let host=$('branchPager');if(!host){host=document.createElement('div');host.id='branchPager';host.className='branch-pager';$('branchStatusTable').closest('.table-wrap').before(host)}
 host.innerHTML=`<input aria-label="ค้นหาสาขา" id="branchFind" placeholder="ค้นหาสาขา / RM / AM" value="${esc(branchQuery)}"><label>แถวต่อหน้า <select id="branchPageSize">${[10,25,50].map(n=>`<option ${n===branchSize?'selected':''}>${n}</option>`).join('')}</select></label><button class="btn" id="branchPrev" ${branchPage===0?'disabled':''}>←</button><span>${branchPage+1} / ${Math.max(1,Math.ceil(window.branchPageTotal/branchSize))} · ${fmt(window.branchPageTotal)} รายการ</span><button class="btn" id="branchNext" ${(branchPage+1)*branchSize>=window.branchPageTotal?'disabled':''}>→</button>`;
 const rerender=()=>{const rows=filtered();renderBranch(rows,totals(rows))};$('branchFind').onchange=e=>{branchQuery=e.target.value;branchPage=0;rerender()};$('branchPageSize').onchange=e=>{branchSize=Number(e.target.value);branchPage=0;rerender()};$('branchPrev').onclick=()=>{branchPage--;rerender()};$('branchNext').onclick=()=>{branchPage++;rerender()};
}
function tidySectionOrder(){const detail=$('detailStatusTable')?.closest('section'),due=$('dueTop10StatusTable')?.closest('section'),pending=$('noContractStatusTable')?.closest('section'),footer=document.querySelector('footer.foot');if(detail&&due)detail.after(due);if(footer&&pending)footer.before(pending);if(footer&&$('mergeCaveats'))footer.prepend($('mergeCaveats'))}
