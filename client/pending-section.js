const NO_CONTRACT_STAGE_LABELS={MDM:'รอดำเนินการ MDM','Contract Review':'ลูกค้ารีวิวสัญญา / สัญญาแนบท้าย','Asset Deliver':'Asset Deliver',PENDING_REGISTRATION:'รอลงทะเบียนสินค้า'};
const NO_CONTRACT_STAGES=['MDM','Contract Review','Asset Deliver','PENDING_REGISTRATION'];
// Age = days from the application's created date to the day the sheet was read (SLA is 7 days).
const NO_CT_AGE=[['LE3','น้อยกว่าเท่ากับ 3 วัน'],['D4_7','4 ถึง 7 วัน'],['GT7','มากกว่า 7 วัน']];
let noCtAge='ALL';
function noCtAgeBucket(row,refTime){
 if(!row.CREATED||!refTime)return null;
 const days=Math.round((refTime-Date.parse(row.CREATED))/864e5);
 return Number.isNaN(days)?null:days<=3?'LE3':days<=7?'D4_7':'GT7';
}
function renderNoContract(){
 const audit=window.ufundPendingAudit||{},refTime=audit.readDate?Date.parse(String(audit.readDate).slice(0,10)):null;
 const rows=filteredNoContract(),stats=new Map(NO_CONTRACT_STAGES.map(k=>[k,{all:0,LE3:0,D4_7:0,GT7:0}]));
 for(const r of rows){const s=stats.get(r.STAGE)||stats.set(r.STAGE,{all:0,LE3:0,D4_7:0,GT7:0}).get(r.STAGE),c=num(r.RECORDS),b=noCtAgeBucket(r,refTime);s.all+=c;if(b)s[b]+=c}
 const pick=s=>noCtAge==='ALL'?s.all:s[noCtAge];
 const total=[...stats.values()].reduce((a,s)=>a+s.all,0),shown=[...stats.values()].reduce((a,s)=>a+pick(s),0);
 const ageTotals=Object.fromEntries(NO_CT_AGE.map(([k])=>[k,[...stats.values()].reduce((a,s)=>a+s[k],0)]));
 const readText=audit.readDate?`อ่านชีต ${esc(audit.readDate)}`:'';
 // Only the age filter here; the section title above already names the list (read date stays as a tooltip).
 $('noContractAudit').innerHTML=`<div class="noct-head" title="${readText} · อายุงานนับจากวันที่สร้างรายการถึงวันที่อ่านชีต">`+
  `<div class="noct-age" role="group" aria-label="กรองตามอายุงานค้าง">${[['ALL','ทั้งหมด',total],...NO_CT_AGE.map(([k,l])=>[k,l,ageTotals[k]])].map(([k,l,n])=>`<button type="button" class="noct-age-btn${k==='GT7'?' late':''}" data-age="${k}" aria-pressed="${noCtAge===k}">${esc(l)} <b>${fmt(n)}</b></button>`).join('')}</div></div>`;
 const order=[...stats.keys()].sort((a,b)=>pick(stats.get(b))-pick(stats.get(a))||stats.get(b).all-stats.get(a).all);
 const max=Math.max(1,...order.map(k=>pick(stats.get(k))));
 $('noContractCards').innerHTML=order.map(k=>{
  const s=stats.get(k),v=pick(s);
  // One age filter (the buttons in the header); each bar just states its count and share.
  return `<div class="noct-stage"><div class="noct-stage-top"><span class="noct-name">${esc(NO_CONTRACT_STAGE_LABELS[k]||k)}</span><span class="noct-val">จำนวน ${fmt(v)} บิล คิดเป็น ${shown?pctText(v,shown):'0%'}</span></div>`+
   `<div class="noct-track" role="img" aria-label="${esc(NO_CONTRACT_STAGE_LABELS[k]||k)} ${fmt(v)} บิล"><span style="width:${v/max*100}%"></span></div></div>`;
 }).join('');
 // Click an age bucket to show only that range; click it again (or ทั้งหมด) for everything.
 document.querySelectorAll('#noContractAudit [data-age]').forEach(el=>el.onclick=()=>{const k=el.dataset.age;noCtAge=noCtAge===k||k==='ALL'?'ALL':k;renderNoContract()});
}
