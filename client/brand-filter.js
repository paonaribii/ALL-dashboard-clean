const sharedFilters={brands:new Set(),shops:new Set(),fields:{}};
const sharedFields=[['CATEGORY','PRODUCT CATEGORY'],['MONTH','DATE'],['REGION','ภาค'],['PROVINCE','จังหวัด'],['MALL','ห้าง'],['BRANCH','สถานที่'],['BU','BU'],['ZONE_CHANNEL','CHANNEL / TIER'],['RM','RSM (RM)'],['AM','ASM (AM)']];
const sharedFieldsUi=sharedFields.filter(([key])=>key!=='MONTH');
const productCategories=['iPhone','iPad','Mac','Notebook','Smartphone','Tablet','อื่น ๆ / รอตรวจสอบ'];
let sharedCache=new WeakMap(),sharedSource=null,sharedSignature='',sharedOptions={},msGlobalHandlersReady=false;
function msLabel(key){const set=sharedFilters[key];if(!set.size)return'ทั้งหมด';if(set.size===1)return[...set][0];return`เลือก ${set.size} รายการ`}
function filterMsOptions(dd){const input=dd.querySelector('[data-ms-search]');if(!input)return;const q=input.value.trim().toLocaleLowerCase('th');dd.querySelectorAll('.global-brand-button').forEach(b=>{b.style.display=!q||b.textContent.toLocaleLowerCase('th').includes(q)?'':'none'})}
function closeAllMsDropdowns(){document.querySelectorAll('.ms-panel').forEach(p=>p.hidden=true);document.querySelectorAll('.ms-trigger').forEach(t=>t.setAttribute('aria-expanded','false'))}
function bindMsDropdowns(){
 document.querySelectorAll('.ms-dropdown').forEach(dd=>{
  const trigger=dd.querySelector('[data-ms-trigger]'),panel=dd.querySelector('[data-ms-panel]'),search=dd.querySelector('[data-ms-search]');
  if(!trigger||!panel)return;
  trigger.onclick=e=>{e.stopPropagation();const willOpen=panel.hidden;closeAllMsDropdowns();panel.hidden=!willOpen;trigger.setAttribute('aria-expanded',String(willOpen));if(willOpen&&search){search.value='';filterMsOptions(dd);search.focus()}};
  if(search)search.oninput=()=>filterMsOptions(dd);
 });
}
function setupMsGlobalHandlers(){
 if(msGlobalHandlersReady)return;msGlobalHandlersReady=true;
 document.addEventListener('click',e=>{if(!e.target.closest('.ms-dropdown'))closeAllMsDropdowns()});
 document.addEventListener('keydown',e=>{if(e.key==='Escape')closeAllMsDropdowns()});
}
function canonicalBrand(value){const s=String(value||'').trim();if(/^apple\b/i.test(s))return 'Apple';const names={samsung:'Samsung',oppo:'OPPO',vivo:'vivo',xiaomi:'Xiaomi',realme:'realme',honor:'Honor',huawei:'Huawei',asus:'Asus',nothing:'Nothing',infinix:'Infinix',zte:'ZTE','other brand':'Other Brand',iqoo:'iQOO',lenovo:'Lenovo',tecno:'Tecno',hp:'HP',msi:'MSI'};return names[s.toLowerCase()]||s||'ไม่ระบุ'}
function reviewedProductBrand(value){const name=canonicalBrand(value);return ['Honor','ZTE','Other Brand'].includes(name)?name:value}
function sharedRow(row){
 if(sharedCache.has(row))return sharedCache.get(row);
 const brand=canonicalBrand(row.BRAND),model=String(row.MODEL||'').toLowerCase(),group=String(row.PRODUCT_GROUP||'');let category='อื่น ๆ / รอตรวจสอบ';
 if(brand==='Apple'){if(/iphone/.test(model)||group==='iPhone')category='iPhone';else if(/ipad/.test(model)||group==='Tablet')category='iPad';else if(/macbook|imac|mac mini|mac studio|mac pro|^mac\b/.test(model)||group==='Laptop')category='Mac'}
 else if(group==='Laptop'||/notebook|laptop|vivobook|thinkpad|ideapad|zenbook/.test(model))category='Notebook';
 else if(group==='Tablet'||/\btab\b|\bpad\b|tablet/.test(model))category='Tablet';else if(group==='Smartphone')category='Smartphone';
 // User-approved fallback for the three review groups; retain explicit tablet/laptop categories.
 if(category==='อื่น ๆ / รอตรวจสอบ'&&['Honor','ZTE','Other Brand'].includes(brand))category='Smartphone';
 const clean=v=>!v||['No Data','Unknown','#N/A'].includes(String(v))?'ไม่ระบุ':String(v);
 const data={BRAND:brand,CATEGORY:category,SHOP:clean(row.CHANNEL_TYPE)};sharedFields.forEach(([key])=>{if(key!=='CATEGORY')data[key]=clean(row[key])});sharedCache.set(row,data);return data;
}
function matchesGlobalBrand(row){const d=sharedRow(row);return(!sharedFilters.brands.size||sharedFilters.brands.has(d.BRAND))&&(!sharedFilters.shops.size||sharedFilters.shops.has(d.SHOP))&&sharedFields.every(([key])=>!sharedFilters.fields[key]||sharedFilters.fields[key]===d[key])}
function clearSharedFilters(){sharedFilters.brands.clear();sharedFilters.shops.clear();sharedFilters.fields={};sharedSignature=''}
function sharedChanged(){for(const key of ['BRAND','MODEL','PRODUCT_GROUP','REGION','PROVINCE','RM','AM','BRANCH'])state[key]?.clear();productGroup='ALL';productDrill='ALL';noCtStage='ALL';closeDimensionModal();sharedSignature='';render()}
function fieldOptionClick(key,value){
 sharedFilters.fields[key]=value;
 if(key==='REGION'){delete sharedFilters.fields.PROVINCE;delete sharedFilters.fields.BRANCH}
 if(key==='PROVINCE')delete sharedFilters.fields.BRANCH;
 if(key==='RM'){delete sharedFilters.fields.AM;delete sharedFilters.fields.BRANCH}
 if(key==='MONTH'){rangeStart='';rangeEnd='';rangePreset='CUSTOM';syncDateControls()}
 closeAllMsDropdowns();sharedChanged();
}
function renderGlobalBrandFilter(){
 const signature=JSON.stringify({brands:[...sharedFilters.brands],shops:[...sharedFilters.shops],fields:sharedFilters.fields,rangeStart,rangeEnd});if(sharedSource===full&&sharedSignature===signature)return;sharedSource=full;sharedSignature=signature;
 const names=new Set(),shops=new Set(),sets=Object.fromEntries(sharedFields.map(([k])=>[k,new Set()]));
 [...full,...noFull].forEach(row=>{const d=sharedRow(row);names.add(d.BRAND);shops.add(d.SHOP);sharedFields.forEach(([k])=>{const deps={PROVINCE:['REGION'],BRANCH:['REGION','PROVINCE','RM','AM'],AM:['RM']}[k]||[];if(deps.every(dep=>!sharedFilters.fields[dep]||sharedFilters.fields[dep]===d[dep]))sets[k].add(d[k])})});
 sharedOptions={brands:[...names].sort(),shops:[...shops].sort()};
 const fieldBlocks=sharedFieldsUi.map(([key,label])=>{
  const options=key==='CATEGORY'?[...productCategories]:[...sets[key]].sort((a,b)=>key==='MONTH'?b.localeCompare(a):a.localeCompare(b,'th',{numeric:true}));
  const selected=sharedFilters.fields[key]||'';if(selected&&!options.includes(selected))options.push(selected);
  const allLabel=key==='CATEGORY'?'ALL (รวมทุกหมวด)':'ทั้งหมด';
  const selectedLabel=selected?(key==='MONTH'?displayMonth(selected):selected):allLabel;
  const showSearch=options.length>8;
  const optionButtons=[`<button type="button" class="global-brand-button" data-shared-field-option="${key}" data-value="" aria-pressed="${!selected}">${esc(allLabel)}</button>`]
   .concat(options.map(v=>`<button type="button" class="global-brand-button" data-shared-field-option="${key}" data-value="${esc(v)}" aria-pressed="${v===selected}">${esc(key==='MONTH'?displayMonth(v):v)}</button>`)).join('');
  return `<div class="ms-field"><span class="ms-field-label">${esc(label)}</span><div class="ms-dropdown" data-ms-field="${key}"><button type="button" class="ms-trigger" data-ms-trigger="${key}" aria-haspopup="true" aria-expanded="false"><span data-ms-field-label="${key}">${esc(selectedLabel)}</span><span class="ms-caret" aria-hidden="true">▾</span></button><div class="ms-panel" data-ms-panel="${key}" hidden>${showSearch?`<input type="search" class="ms-search" data-ms-search="${key}" placeholder="พิมพ์เพื่อค้นหา…" aria-label="ค้นหา ${esc(label)}">`:''}<div class="ms-options" role="listbox" aria-label="${esc(label)}">${optionButtons}</div></div></div></div>`;
 });
 const multiFieldBlock=(key,label,id,placeholder)=>`<div class="ms-field"><span class="ms-field-label">${esc(label)}</span><div class="ms-dropdown" data-ms="${key}"><button type="button" class="ms-trigger" data-ms-trigger="${key}" aria-haspopup="true" aria-expanded="false"><span data-ms-label="${key}">${esc(msLabel(key))}</span><span class="ms-caret" aria-hidden="true">▾</span></button><div class="ms-panel" data-ms-panel="${key}" hidden><input type="search" class="ms-search" data-ms-search="${key}" placeholder="${esc(placeholder)}" aria-label="ค้นหา ${esc(label)}"><div class="ms-panel-actions"><button type="button" class="tiny" data-shared-all="${key}">เลือกทั้งหมด</button><button type="button" class="tiny" data-shared-clear="${key}">ล้างที่เลือก</button></div><div id="${id}" class="global-brand-buttons ms-options" role="listbox" aria-multiselectable="true" aria-label="${esc(label)}"></div></div></div></div>`;
 $('sharedFilterFields').innerHTML=[
  fieldBlocks[0],
  multiFieldBlock('brands','แบรนด์สินค้า','globalBrandButtons','พิมพ์เพื่อค้นหาแบรนด์…'),
  multiFieldBlock('shops','ร้าน / ช่องทาง','globalShopButtons','พิมพ์เพื่อค้นหาร้าน / ช่องทาง…'),
  ...fieldBlocks.slice(1)
 ].join('');
 $('sharedFilterFields').querySelectorAll('[data-shared-field-option]').forEach(b=>b.onclick=()=>fieldOptionClick(b.dataset.sharedFieldOption,b.dataset.value));
 for(const[key,id]of[['brands','globalBrandButtons'],['shops','globalShopButtons']]){$(id).innerHTML=sharedOptions[key].map(name=>`<button type="button" class="global-brand-button" data-value="${esc(name)}" aria-pressed="${sharedFilters[key].has(name)}">${sharedFilters[key].has(name)?'✓ ':''}${esc(name)}</button>`).join('');$(id).querySelectorAll('button').forEach(b=>b.onclick=()=>{const set=sharedFilters[key];set.has(b.dataset.value)?set.delete(b.dataset.value):set.add(b.dataset.value);sharedChanged()});const labelEl=document.querySelector(`[data-ms-label="${key}"]`);if(labelEl)labelEl.textContent=msLabel(key);const dd=document.querySelector(`.ms-dropdown[data-ms="${key}"]`);if(dd)filterMsOptions(dd)}
 bindMsDropdowns();setupMsGlobalHandlers();
 document.querySelectorAll('[data-shared-all]').forEach(b=>b.onclick=()=>{const key=b.dataset.sharedAll;sharedFilters[key]=new Set(sharedOptions[key]);sharedChanged()});document.querySelectorAll('[data-shared-clear]').forEach(b=>b.onclick=()=>{sharedFilters[b.dataset.sharedClear].clear();sharedChanged()});
 const chips=[];for(const key of ['brands','shops'])for(const value of sharedFilters[key])chips.push({key,value});for(const[key,value]of Object.entries(sharedFilters.fields))if(value)chips.push({key,value});
 $('globalBrandContext').textContent='ใช้ตัวกรองเดียวกันทุกหน้า · '+(sharedFilters.brands.size?[...sharedFilters.brands].join(' + '):'ทุกแบรนด์');
 $('sharedFilterChips').innerHTML=chips.map((c,i)=>`<button class="shared-chip" data-chip="${i}" aria-label="ยกเลิก ${esc(c.value)}">${esc(c.value)} ×</button>`).join('')+'<button class="tiny" id="sharedReset">ล้างทั้งหมด</button>';
 $('sharedFilterChips').querySelectorAll('[data-chip]').forEach(b=>b.onclick=()=>{const c=chips[Number(b.dataset.chip)];if(sharedFilters[c.key] instanceof Set)sharedFilters[c.key].delete(c.value);else delete sharedFilters.fields[c.key];sharedChanged()});$('sharedReset').onclick=resetFilters;
}
