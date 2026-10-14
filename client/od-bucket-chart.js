// OD bucket chart: three aligned single-series bar panels sharing the OD1-OD6 axis (contracts, overdue
// value, overdue value per contract). Kept as separate panels instead of one dual-axis combo chart, whose
// scale pairing would invent a crossing point between bars and line that means nothing.
const OD_BUCKETS=['OD1','OD2','OD3','OD4','OD5','OD6'];
function odNiceMax(v){if(!(v>0))return 1;const e=Math.pow(10,Math.floor(Math.log10(v))),f=v/e;return(f<=1?1:f<=2?2:f<=2.5?2.5:f<=5?5:10)*e}
function odCompact(v){return v>=1e6?(v/1e6).toFixed(v>=1e7?0:1)+'M':v>=1e3?(v/1e3).toFixed(v>=1e4?0:1)+'k':String(Math.round(v))}
function renderOdBucketChart(host,rows){
 const agg=Object.fromEntries(OD_BUCKETS.map(k=>[k,{c:0,v:0}]));let total=0;
 for(const r of rows){const c=num(r.CONTRACTS);total+=c;const a=agg[r.STATUS];if(a){a.c+=c;a.v+=num(r.OD_ACCUMULATED_VALUE)}}
 const data=OD_BUCKETS.map(k=>({k,c:agg[k].c,v:agg[k].v,avg:agg[k].c?agg[k].v/agg[k].c:0}));
 const odC=data.reduce((s,d)=>s+d.c,0),odV=data.reduce((s,d)=>s+d.v,0);
 const sel=state.STATUS&&state.STATUS.size?state.STATUS:null;
 const panels=[
  {key:'c',title:'จำนวนสัญญา',color:'var(--od-s1)',label:v=>fmt(v),tick:odCompact},
  {key:'v',title:'ยอดค้าง (ล้านบาท)',color:'var(--od-s2)',label:v=>(v/1e6).toFixed(1),tick:v=>(v/1e6).toFixed(v>=1e7||v===0?0:1)},
  {key:'avg',title:'ยอดค้างเฉลี่ยต่อสัญญา (บาท)',color:'var(--od-s3)',label:v=>fmt(Math.round(v)),tick:odCompact}
 ];
 const W=320,H=200,L=40,R=6,T=20,B=24,pw=W-L-R,ph=H-T-B,band=pw/OD_BUCKETS.length,bw=band*0.56;
 const svg=p=>{
  const max=odNiceMax(Math.max(...data.map(d=>d[p.key]))),y=v=>T+ph-(v/max)*ph;
  const grid=[0,max/2,max].map(v=>`<line x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L-6}" y="${y(v)+3.5}" text-anchor="end">${p.tick(v)}</text>`).join('');
  const bars=data.map((d,i)=>{
   const x=L+i*band+(band-bw)/2,top=y(d[p.key]),base=T+ph,h=base-top,r=Math.min(4,h,bw/2);
   const path=h<=0?'':`M${x},${base}V${top+r}Q${x},${top} ${x+r},${top}H${x+bw-r}Q${x+bw},${top} ${x+bw},${top+r}V${base}Z`;
   const dim=sel&&!sel.has(d.k)?' od-dim':'';
   return `<path class="od-bar${dim}" data-od="${d.k}" d="${path}" fill="${p.color}"/>`+
    `<text class="od-val${dim}" x="${x+bw/2}" y="${top-5}" text-anchor="middle">${d[p.key]?p.label(d[p.key]):'0'}</text>`+
    `<text class="od-xlab" x="${x+bw/2}" y="${H-6}" text-anchor="middle">${d.k}</text>`+
    `<rect class="od-hit" data-od="${d.k}" x="${L+i*band}" y="${T}" width="${band}" height="${ph}" tabindex="0" role="button" aria-label="${d.k} ${p.title} ${p.label(d[p.key])}"/>`;
  }).join('');
  return `<figure class="od-panel"><figcaption>${p.title}</figcaption><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${p.title} แยกตาม OD1 ถึง OD6"><g class="od-grid od-axis">${grid}</g>${bars}</svg></figure>`;
 };
 const first=data[0].avg,last=data[data.length-1].avg;
 const trend=first>0&&last>first?` · ยอดค้างเฉลี่ยต่อสัญญาที่ OD6 สูงกว่า OD1 ${(last/first).toFixed(1)} เท่า`:'';
 const table=`<details class="od-table"><summary>ดูเป็นตาราง</summary><table><thead><tr><th>OD</th><th class="num">จำนวนสัญญา</th><th class="num">% ของ OD</th><th class="num">ยอดค้าง (บาท)</th><th class="num">เฉลี่ย/สัญญา (บาท)</th></tr></thead><tbody>${data.map(d=>`<tr><td>${d.k}</td><td class="num">${fmt(d.c)}</td><td class="num">${pctText(d.c,odC)}</td><td class="num">${fmt(Math.round(d.v))}</td><td class="num">${fmt(Math.round(d.avg))}</td></tr>`).join('')}</tbody></table></details>`;
 host.innerHTML=`<div class="od-chart"><header><h3>OD Bucket: จำนวนสัญญากับยอดค้างชำระ</h3><p>OD1–OD6 รวม ${fmt(odC)} สัญญา (${pctText(odC,total)} ของทั้งหมด) · ยอดค้างรวม ฿${(odV/1e6).toFixed(1)} ล้าน${trend} · กดแท่งเพื่อกรอง</p></header><div class="od-chart-grid">${panels.map(svg).join('')}</div>${table}<div class="od-chart-tip" hidden></div></div>`;
 const chart=host.querySelector('.od-chart'),tip=chart.querySelector('.od-chart-tip'),byK=Object.fromEntries(data.map(d=>[d.k,d]));
 const mark=k=>chart.querySelectorAll('.od-bar').forEach(b=>b.classList.toggle('is-hover',b.dataset.od===k));
 const show=(k,cx,cy)=>{
  const d=byK[k];mark(k);
  tip.innerHTML=`<b>${k}</b><div><span class="sw" style="background:var(--od-s1)"></span>จำนวนสัญญา: <b>${fmt(d.c)}</b> (${pctText(d.c,odC)} ของ OD)</div><div><span class="sw" style="background:var(--od-s2)"></span>ยอดค้าง: <b>฿${(d.v/1e6).toFixed(2)} ล้าน</b></div><div><span class="sw" style="background:var(--od-s3)"></span>เฉลี่ย/สัญญา: <b>฿${fmt(Math.round(d.avg))}</b></div>`;
  tip.hidden=false;const box=chart.getBoundingClientRect(),tw=tip.offsetWidth,th=tip.offsetHeight;
  tip.style.left=Math.max(8,Math.min(box.width-tw-8,cx-box.left+14))+'px';tip.style.top=Math.max(8,cy-box.top-th-12)+'px';
 };
 const hide=()=>{tip.hidden=true;mark(null)};
 chart.querySelectorAll('.od-hit').forEach(el=>{
  el.onpointermove=e=>show(el.dataset.od,e.clientX,e.clientY);
  el.onpointerleave=hide;
  el.onfocus=()=>{const r=el.getBoundingClientRect();show(el.dataset.od,r.left+r.width/2,r.top+20)};
  el.onblur=hide;
  el.onclick=()=>setFilterValues('STATUS',[el.dataset.od]);
  el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();el.onclick()}};
 });
}
