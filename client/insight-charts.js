// Two half-width insight charts shown under the OD bucket chart: MDM status mix per product group, and
// an AM risk quadrant (MDM success vs OD rate of active contracts).
function insightTip(card){
 const tip=card.querySelector('.ins-tip');
 return{show(html,cx,cy){tip.innerHTML=html;tip.hidden=false;const b=card.getBoundingClientRect(),w=tip.offsetWidth,h=tip.offsetHeight;
  tip.style.left=Math.max(8,Math.min(b.width-w-8,cx-b.left+14))+'px';tip.style.top=Math.max(8,cy-b.top-h-12)+'px'},hide(){tip.hidden=true}};
}
function renderMdmGapChart(card,rows){
 const STAT=[['MDM Success','Success','--ins-good'],['MDM Unsuccess','Unsuccess','--ins-warn'],...(SPLIT_NO_MDM?[['No MDM','No MDM (ยืนยัน)','--ins-bad'],['NOT_FOUND','ไม่พบข้อมูล','--ins-none']]:[['No MDM','No MDM','--ins-bad']])];
 const map=new Map();
 for(const r of rows){const g=String(r.PRODUCT_GROUP||'อื่น ๆ / รอตรวจสอบ'),c=num(r.CONTRACTS);if(!c)continue;
  if(!map.has(g))map.set(g,{g,total:0,'MDM Success':0,'MDM Unsuccess':0,'No MDM':0,NOT_FOUND:0});const x=map.get(g);x.total+=c;
  const s=r.MDM_STATUS==='MDM Success'||r.MDM_STATUS==='MDM Unsuccess'?r.MDM_STATUS:!SPLIT_NO_MDM||r.MDM_CHECK==='ยืนยันแล้ว'?'No MDM':'NOT_FOUND';x[s]+=c}
 const order=typeof productCategories!=='undefined'?productCategories:[...map.keys()];
 const data=[...order.filter(g=>map.has(g)).map(g=>map.get(g)),...[...map.values()].filter(x=>!order.includes(x.g))];
 const W=520,L=118,R=12,T=8,rowH=36,barH=22,B=26,H=T+data.length*rowH+B,pw=W-L-R,x=p=>L+p/100*pw;
 const ticks=[0,25,50,75,100].map(p=>`<line x1="${x(p)}" x2="${x(p)}" y1="${T}" y2="${H-B}"/><text x="${x(p)}" y="${H-8}" text-anchor="middle">${p}%</text>`).join('');
 const bars=data.map((d,i)=>{
  const y=T+i*rowH+(rowH-barH)/2;let acc=0;
  const segs=STAT.map(([key,label,color],si)=>{
   const p=d.total?d[key]/d.total*100:0,x0=x(acc),x1=x(acc+p);acc+=p;if(p<=0)return'';
   const gapL=si===0?0:1,gapR=1,w=Math.max(0,x1-x0-gapL-gapR),left=x0+gapL,first=si===0,last=STAT.slice(si+1).every(([k])=>!d[k]);
   const r=4,path=`M${left+(first?r:0)},${y}H${left+w-(last?r:0)}${last?`Q${left+w},${y} ${left+w},${y+r}V${y+barH-r}Q${left+w},${y+barH} ${left+w-r},${y+barH}`:`V${y+barH}`}H${left+(first?r:0)}${first?`Q${left},${y+barH} ${left},${y+barH-r}V${y+r}Q${left},${y} ${left+r},${y}`:`V${y}`}Z`;
   const txt=p>=12?`<text class="ins-seglab${key==='MDM Unsuccess'||key==='NOT_FOUND'?' dark':''}" x="${left+w/2}" y="${y+barH/2+4}" text-anchor="middle">${Math.round(p)}%</text>`:'';
   return `<path d="${path}" fill="var(${color})"/>${txt}`;
  }).join('');
  return `<text class="ins-rowlab" x="${L-10}" y="${y+barH/2+4}" text-anchor="end">${esc(d.g)}</text>${segs}<rect class="ins-hit" data-i="${i}" x="0" y="${T+i*rowH}" width="${W}" height="${rowH}"/>`;
 }).join('');
 const legend=STAT.map(([,label,color])=>`<span><i style="background:var(${color})"></i>${label}</span>`).join('');
 const table=`<details class="ins-table"><summary>ดูเป็นตาราง</summary><table><thead><tr><th>กลุ่มสินค้า</th><th class="num">สัญญา</th>${STAT.map(([,label])=>`<th class="num">${label}</th>`).join('')}</tr></thead><tbody>${data.map(d=>`<tr><td>${esc(d.g)}</td><td class="num">${fmt(d.total)}</td>${STAT.map(([k])=>`<td class="num">${fmt(d[k])} (${pctText(d[k],d.total)})</td>`).join('')}</tr>`).join('')}</tbody></table></details>`;
 card.innerHTML=`<header><h3>MDM Gap รายกลุ่มสินค้า</h3><p>สัดส่วนสถานะ MDM ของแต่ละกลุ่มสินค้า (เทียบกับจำนวนสัญญาทั้งหมดของกลุ่ม)</p></header><div class="ins-legend">${legend}</div><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="สัดส่วนสถานะ MDM แยกตามกลุ่มสินค้า"><g class="ins-grid">${ticks}</g>${bars}</svg>${table}<div class="ins-tip" hidden></div>`;
 const tip=insightTip(card);
 card.querySelectorAll('.ins-hit').forEach(el=>{const d=data[+el.dataset.i];
  el.onpointermove=e=>tip.show(`<b>${esc(d.g)}</b> · ${fmt(d.total)} สัญญา${STAT.map(([k,label,color])=>`<div><span class="sw" style="background:var(${color})"></span>${label}: <b>${fmt(d[k])}</b> (${pctText(d[k],d.total)})</div>`).join('')}`,e.clientX,e.clientY);
  el.onpointerleave=tip.hide});
}
function renderAmRiskChart(card,rows){
 const MIN_ACTIVE=100,map=new Map();let allActive=0,allOd=0,allSuccess=0,allContracts=0;
 for(const r of rows){const am=String(r.AM||'No Data');const c=num(r.CONTRACTS);if(!c||am==='No Data')continue;
  const key=am+'\u001f'+String(r.RM||'');if(!map.has(key))map.set(key,{am,rm:String(r.RM||''),contracts:0,active:0,od:0,success:0});
  const x=map.get(key);x.contracts+=c;allContracts+=c;if(r.LIFECYCLE==='Active'){x.active+=c;allActive+=c}
  if(OD_GROUP.includes(r.STATUS)){x.od+=c;allOd+=c}if(r.MDM_STATUS==='MDM Success'){x.success+=c;allSuccess+=c}}
 const all=[...map.values()].map(x=>({...x,mdm:x.contracts?x.success/x.contracts*100:0,odr:x.active?x.od/x.active*100:0}));
 const pts=all.filter(x=>x.active>=MIN_ACTIVE);
 const avgX=allContracts?allSuccess/allContracts*100:0,avgY=allActive?allOd/allActive*100:0;
 if(!pts.length){card.innerHTML=`<header><h3>AM Risk Quadrant: MDM เทียบกับ OD</h3><p>ไม่มี AM ที่มีสัญญา Active ตั้งแต่ ${MIN_ACTIVE} สัญญาขึ้นไปตามตัวกรองนี้</p></header>`;return}
 pts.forEach(p=>p.risk=p.mdm<avgX&&p.odr>avgY);
 const W=520,H=330,L=44,R=14,T=14,B=40,pw=W-L-R,ph=H-T-B;
 const xs=pts.map(p=>p.mdm),ys=pts.map(p=>p.odr);
 const x0=Math.max(0,Math.floor(Math.min(...xs,avgX)/10)*10),x1=Math.min(100,Math.ceil(Math.max(...xs,avgX)/10)*10||10);
 const y1=Math.max(2,Math.ceil(Math.max(...ys,avgY)/2)*2);
 const X=v=>L+(v-x0)/(x1-x0||1)*pw,Y=v=>T+ph-v/y1*ph;
 const maxA=Math.max(...pts.map(p=>p.active)),rad=a=>4+14*Math.sqrt(a/maxA);
 const xt=[];for(let v=x0;v<=x1;v+=10)xt.push(v);const yt=[];for(let v=0;v<=y1;v+=y1>8?2:1)yt.push(v);
 const grid=yt.map(v=>`<line x1="${L}" x2="${W-R}" y1="${Y(v)}" y2="${Y(v)}"/><text x="${L-6}" y="${Y(v)+3.5}" text-anchor="end">${v}</text>`).join('')+xt.map(v=>`<text x="${X(v)}" y="${H-B+16}" text-anchor="middle">${v}</text>`).join('');
 const avg=`<line class="ins-avg" x1="${X(avgX)}" x2="${X(avgX)}" y1="${T}" y2="${T+ph}"/><line class="ins-avg" x1="${L}" x2="${W-R}" y1="${Y(avgY)}" y2="${Y(avgY)}"/><text class="ins-avglab" x="${X(avgX)+4}" y="${T+10}">เฉลี่ย ${avgX.toFixed(0)}%</text><text class="ins-avglab" x="${W-R}" y="${Y(avgY)-5}" text-anchor="end">เฉลี่ย ${avgY.toFixed(2)}%</text>`;
 const sorted=[...pts].sort((a,b)=>b.active-a.active);
 const dots=sorted.map((p,i)=>`<circle class="ins-dot${p.risk?' risk':''}" data-i="${pts.indexOf(p)}" cx="${X(p.mdm)}" cy="${Y(p.odr)}" r="${rad(p.active)}"/>`).join('');
 // Name the largest risk AMs, skipping any label that would collide with one already placed (tries above
 // the dot, then below); unlabelled ones stay reachable through the tooltip and the table.
 const placed=[],labels=[];
 for(const p of sorted.filter(p=>p.risk)){
  if(labels.length>=6)break;
  const w=p.am.length*6.4+6,h=12,cx=X(p.mdm),r=rad(p.active);
  for(const cy of [Y(p.odr)-r-4,Y(p.odr)+r+12]){
   const box={x0:cx-w/2,x1:cx+w/2,y0:cy-h+2,y1:cy+2};
   if(box.x0<L||box.x1>W-R||box.y0<T)continue;
   if(placed.some(b=>box.x0<b.x1&&box.x1>b.x0&&box.y0<b.y1&&box.y1>b.y0))continue;
   placed.push(box);labels.push(`<text class="ins-dotlab" x="${cx}" y="${cy}" text-anchor="middle">${esc(p.am)}</text>`);break;
  }
 }
 // Outstanding wrong-bill counts per AM from the live 'ค้าง Bill Auto Fix' sheet (scripts/fetch-billing.mjs);
 // fixed bills leave the sheet, so an AM missing from it has 0. Not affected by the dashboard filters.
 const billing=window.ufundBillingIssues,bills=new Map((billing?.detail||[]).map(d=>[d.rm+'\u001f'+String(d.am).replace(/\s*รวม\s*$/,'').trim(),d.total]));
 const billOf=p=>bills.get(p.rm+'\u001f'+p.am)??(billing?0:null),billText=p=>billOf(p)==null?'–':fmt(billOf(p));
 const billAsOf=billing?.asOf?`ณ ${billing.asOf}`:billing?`สะสม ${billing.periodStart} ถึง ${billing.periodEnd}`:'';
 const riskCount=pts.filter(p=>p.risk).length;
 // Heat cells: each column is scaled across the listed AMs, darker = needs more attention (low MDM, high
 // OD rate, many outstanding bills). Value text stays in the normal ink; the fill only ranks.
 // Riskiest first: relative distance below the average MDM rate plus above the average OD rate.
 const riskScore=p=>(avgX?(avgX-p.mdm)/avgX:0)+(avgY?(p.odr-avgY)/avgY:0);
 const riskRows=pts.filter(p=>p.risk).sort((a,b)=>riskScore(b)-riskScore(a)),span=f=>{const v=riskRows.map(f).filter(x=>x!=null);return[Math.min(...v),Math.max(...v)]};
 const [mdmLo,mdmHi]=span(p=>p.mdm),[odLo,odHi]=span(p=>p.odr),[billLo,billHi]=span(billOf);
 const heat=(v,lo,hi,invert)=>{if(v==null||!(hi>lo))return'';const t=(invert?hi-v:v-lo)/(hi-lo),lvl=Math.min(4,Math.floor(t*5));return` class="num heat"><span class="heat-cell h${lvl}"`};
 const table=`<details class="ins-table"><summary>ดูเป็นตาราง (กลุ่มเสี่ยง ${riskCount} คน)</summary><table><thead><tr><th>AM</th><th>RM</th><th class="num">Active</th><th class="num">MDM Success</th><th class="num">OD Rate ของ Active</th><th class="num" title="บิลที่ยังค้างแก้ไข ${billAsOf} ไม่เปลี่ยนตามตัวกรอง">บิลค้าง</th></tr></thead><tbody>${riskRows.map(p=>`<tr><td>${esc(p.am)}</td><td>${esc(p.rm)}</td><td class="num">${fmt(p.active)}</td><td${heat(p.mdm,mdmLo,mdmHi,true)||' class="num"><span'}>${p.mdm.toFixed(1)}%</span></td><td${heat(p.odr,odLo,odHi)||' class="num"><span'}>${p.odr.toFixed(2)}%</span></td><td${heat(billOf(p),billLo,billHi)||' class="num"><span'}>${billText(p)}</span></td></tr>`).join('')||'<tr><td colspan="6">ไม่มี AM ในกลุ่มเสี่ยง</td></tr>'}</tbody></table><p class="ins-note heat-key">สีเข้ม = ต้องดูแลมาก (MDM ต่ำ · OD Rate สูง · บิลค้างมาก) เทียบกันภายในตารางนี้ <span class="heat-cell h0">น้อย</span><span class="heat-cell h2"></span><span class="heat-cell h4">มาก</span></p><p class="ins-note">เรียงจาก AM ที่เสี่ยงที่สุด (MDM ต่ำกว่าค่าเฉลี่ยและ OD Rate สูงกว่าค่าเฉลี่ยมากที่สุด) ลงมา</p>${billing?`<p class="ins-note">บิลค้าง = บิลที่ยังค้างแก้ไขในชีต ค้าง Bill Auto Fix ${billAsOf} (ไม่เปลี่ยนตามตัวกรอง)</p>`:''}</details>`;
 card.innerHTML=`<header><h3>AM Risk Quadrant: MDM เทียบกับ OD</h3><p>ขนาดวงกลม = จำนวนสัญญา Active · เส้นประ = ค่าเฉลี่ยบริษัท · <b class="ins-riskkey">สีแดง = MDM ต่ำกว่าเฉลี่ยและ OD สูงกว่าเฉลี่ย (${riskCount} คน, ต้องดูแลก่อน)</b> · แสดง AM ที่มี Active ตั้งแต่ ${MIN_ACTIVE} สัญญา (${pts.length} คน)</p></header><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="AM แต่ละคน: MDM Success Rate เทียบกับ OD Rate"><g class="ins-grid">${grid}</g>${avg}${dots}${labels.join('')}<text class="ins-axis" x="${L+pw/2}" y="${H-6}" text-anchor="middle">MDM Success Rate (%)</text><text class="ins-axis" transform="translate(12 ${T+ph/2}) rotate(-90)" text-anchor="middle">OD Rate ของ Active (%)</text></svg>${table}<div class="ins-tip" hidden></div>`;
 const tip=insightTip(card);
 card.querySelectorAll('.ins-dot').forEach(el=>{const p=pts[+el.dataset.i];
  el.onpointermove=e=>{el.classList.add('is-hover');tip.show(`<b>${esc(p.am)}</b>${p.rm?` · RM ${esc(p.rm)}`:''}<div>MDM Success: <b>${p.mdm.toFixed(1)}%</b></div><div>OD Rate ของ Active: <b>${p.odr.toFixed(2)}%</b></div><div>Active: <b>${fmt(p.active)}</b> สัญญา</div><div>บิลค้าง: <b>${billText(p)}</b></div>${p.risk?'<div class="ins-riskkey">กลุ่มเสี่ยง</div>':''}`,e.clientX,e.clientY)};
  el.onpointerleave=()=>{el.classList.remove('is-hover');tip.hide()}});
}
// MDM Gap lives on the Brand & Product tab and the AM Risk Quadrant on the AM Summary tab (moved off the
// Overview). Each is one card: chart on the left, its table always shown on the right at the same height.
function renderInsightCard(tab,id,draw,rows,tableTitle,beforeSelector){
 const section=document.querySelector(`[data-tab-section="${tab}"]`);if(!section)return;
 let card=document.getElementById(id);
 if(!card){card=document.createElement('section');card.id=id;card.className='ins-card ins-split';const anchor=beforeSelector&&section.querySelector(beforeSelector);anchor?anchor.before(card):section.append(card)}
 draw(card,rows);
 const body=document.createElement('div');body.className='ins-body';body.append(...[...card.children].filter(el=>!el.matches('details,.ins-tip')));card.prepend(body);
 // The chart renderers emit a collapsible <details> table; here it is always visible, so swap it for a panel.
 const d=card.querySelector('details.ins-table');
 if(d){const panel=document.createElement('div');panel.className='ins-table ins-table-panel';const h=document.createElement('h4');h.textContent=tableTitle(d.querySelector('summary')?.textContent||'');d.querySelector('summary')?.remove();panel.append(h,...d.childNodes);d.replaceWith(panel)}
}
const renderProductsBeforeInsight=renderProducts;
renderProducts=function(rows,t){renderProductsBeforeInsight(rows,t);renderInsightCard('brand','mdmGapCard',renderMdmGapChart,rows,()=>'สรุปรายกลุ่มสินค้า','.drill-head')};
const renderOrgSummaryBeforeInsight=renderOrgSummary;
renderOrgSummary=function(rows,t,field){renderOrgSummaryBeforeInsight(rows,t,field);if(field==='AM')renderInsightCard('am','amRiskCard',renderAmRiskChart,rows,s=>'AM '+(s.match(/กลุ่มเสี่ยง[^)]*/)?.[0]||'กลุ่มเสี่ยง'),'.org-summary-shell')};
