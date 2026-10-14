// Brand & Product cards in two levels: Brand Group (Apple / Android / Notebook) first, then the Product
// Groups inside the chosen brand group (all product groups when none is chosen). Each level's shares add
// up to 100% of that level. Replaces the old single row that mixed brand and product cards.
const BRAND_GROUP_ORDER=[['Apple','APL','#64748b'],['Android','AND','#16a34a'],['Notebook','NB','#0891b2']];
const BRAND_GROUP_PRODUCTS={Apple:['iPhone','iPad','Mac'],Android:['Smartphone','Tablet'],Notebook:['Notebook']};
const PRODUCT_LOOK={iPhone:['IPH','#5b8def'],iPad:['PAD','#10b981'],Mac:['MAC','#64748b'],Notebook:['NB','#22b8cf'],Smartphone:['PHN','#8b5cf6'],Tablet:['TAB','#10b981'],'อื่น ๆ / รอตรวจสอบ':['OTH','#f59e0b']};
// YoY on each card, same definition as the hero cards it replaces: contracts in the selected year (or the
// latest year) against the year before, within the card's own rows.
function brandCardYoy(rows){
 const years=[...new Set(rows.map(r=>String(r.YEAR)).filter(y=>/^\d{4}$/.test(y)))].sort();
 const chosen=state.YEAR?.size===1?[...state.YEAR][0]:(years.at(-1)||''),prev=String(+chosen-1);let curr=0,prior=0;
 for(const r of rows){const y=String(r.YEAR);if(y===chosen)curr+=num(r.CONTRACTS);else if(y===prev)prior+=num(r.CONTRACTS)}
 return deltaHtml({delta:curr-prior,rate:prior?(curr-prior)/prior*100:null});
}
// A selected card is the whole of what the page now shows, so it reads 100%; its share of the level
// above moves to the small line ("81% ของทั้งพอร์ต").
function brandGroupCard(name,icon,color,x,total,selected,attr,parentLabel,yoy=''){
 const share=pctText(x.contracts,total);
 return `<div class="product-card ${selected?'selected':''}" style="--accent:${color}" role="button" tabindex="0" aria-pressed="${selected}" ${attr}><div class="product-card-top"><span class="product-name">${esc(name)}</span><span class="product-icon">${icon}</span></div><div class="product-share">${selected?'100%':share}</div><div class="product-meta">${fmt(x.contracts)} สัญญา · ${moneyK(x.hp)}${selected?` · ${share} ของ${/^[A-Za-z]/.test(parentLabel)?' ':''}${esc(parentLabel)}`:''}</div>${yoy}${selected?'<span class="active-filter-hint">✓ กำลังกรองทั้งหน้า</span>':''}</div>`;
}
function renderBrandGroupCards(){
 const host=$('brandGroupCards');
 const chosen=state.BRAND_GROUP?.size===1?[...state.BRAND_GROUP][0]:null;
 const groupScope=filteredIgnoringFields(['BRAND_GROUP','PRODUCT_GROUP','BRAND','MODEL']),groupTotal=totals(groupScope).contracts;
 const byGroup=Object.fromEntries(aggregate(groupScope,'BRAND_GROUP').map(x=>[x.key,x]));
 const productScope=filteredIgnoringFields(['PRODUCT_GROUP','BRAND','MODEL']),productTotal=totals(productScope).contracts;
 const byProduct=Object.fromEntries(aggregate(productScope,'PRODUCT_GROUP').map(x=>[x.key,x]));
 // YoY needs both years, so it ignores a YEAR filter (as the hero cards did).
 const yoyGroups=filteredIgnoringFields(['BRAND_GROUP','PRODUCT_GROUP','BRAND','MODEL','YEAR']),yoyProducts=filteredIgnoringFields(['PRODUCT_GROUP','BRAND','MODEL','YEAR']);
 const productKeys=(chosen?BRAND_GROUP_PRODUCTS[chosen]||[]:['iPhone','iPad','Mac','Smartphone','Tablet','Notebook']).concat(byProduct['อื่น ๆ / รอตรวจสอบ']?.contracts?['อื่น ๆ / รอตรวจสอบ']:[]);
 // Headline card: every contract the page currently shows (all filters applied), with what is selected.
 const now=totals(filtered()),picked=[chosen,state.PRODUCT_GROUP?.size===1?[...state.PRODUCT_GROUP][0]:null].filter(Boolean).join(' · ')||'ทุกแบรนด์ · ทุกกลุ่มสินค้า';
 const totalCard=`<div class="bg-total" aria-live="polite"><div><div class="bg-total-label">จำนวนสัญญาทั้งหมด</div><div class="bg-total-scope">${esc(picked)}</div></div><div class="bg-total-figures"><div class="bg-total-count">${fmt(now.contracts)}<span>สัญญา</span></div><div class="bg-total-meta">มูลค่าสัญญา ${moneyK(now.hp)} ${brandCardYoy(filteredIgnoringFields(['YEAR']))}</div></div></div>`;
 host.innerHTML=totalCard+`<div class="bg-level"><h4 class="bg-level-title">Brand Group</h4><div class="bg-row bg-row-3">${BRAND_GROUP_ORDER.map(([k,icon,color])=>brandGroupCard(k,icon,color,byGroup[k]||{contracts:0,hp:0},groupTotal,chosen===k,`data-brand-group="${k}"`,'ทั้งพอร์ต',brandCardYoy(yoyGroups.filter(r=>r.BRAND_GROUP===k)))).join('')}</div></div>`+
  `<div class="bg-level"><h4 class="bg-level-title">Product Group${chosen?` · ${esc(chosen)}`:' · ทุกแบรนด์'}</h4><div class="bg-row">${productKeys.map(k=>{const [icon,color]=PRODUCT_LOOK[k]||['OTH','#94a3b8'];return brandGroupCard(k,icon,color,byProduct[k]||{contracts:0,hp:0},productTotal,state.PRODUCT_GROUP?.size===1&&state.PRODUCT_GROUP.has(k),`data-group="${esc(k)}"`,chosen||'ทุกแบรนด์',brandCardYoy(yoyProducts.filter(r=>r.PRODUCT_GROUP===k)))}).join('')}</div></div>`;
 const bindKey=(el,fn)=>{el.onclick=fn;el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();fn()}}};
 host.querySelectorAll('[data-brand-group]').forEach(el=>bindKey(el,()=>{const k=el.dataset.brandGroup,same=chosen===k;productGroup='ALL';productDrill='ALL';setMultiFilters([['BRAND_GROUP',same?[]:[k]],['PRODUCT_GROUP',[]],['BRAND',[]],['MODEL',[]]])}));
 host.querySelectorAll('[data-group]').forEach(el=>bindKey(el,()=>{const k=el.dataset.group,same=state.PRODUCT_GROUP?.size===1&&state.PRODUCT_GROUP.has(k);productGroup=same?'ALL':k;productDrill='ALL';setMultiFilters([['PRODUCT_GROUP',same?[]:[k]],['BRAND',[]],['MODEL',[]]])}));
}
