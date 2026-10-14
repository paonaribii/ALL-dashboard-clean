import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {gunzipSync, gzipSync} from 'node:zlib';

// source/WebApp.html is the original Apps Script dashboard page, kept in the repo as the build template.
const sourceHtml = new URL('../source/WebApp.html', import.meta.url);
const publicDir = new URL('../public/', import.meta.url);
const dataDir = new URL('../data/', import.meta.url);

await mkdir(publicDir, {recursive: true});
await mkdir(dataDir, {recursive: true});

let html = await readFile(sourceHtml, 'utf8');
html = html.replace('นำก้อนเดิมกลับมาแสดงแยก MDM, Contract Review และ Asset Deliver · คลิก Stage เพื่อกรอง','ข้อมูลรอเปิดสัญญาจาก Google Sheets · คลิกขั้นตอนเพื่อดูรายละเอียด · ชีตไม่มีแบรนด์/รุ่น ผลติดตั้ง MDM และยอดหนี้ จึงแสดงไม่ระบุ ไม่ตีความเป็น No MDM หรือยอดหนี้ 0 · ไม่มีประวัติปิด/ยกเลิกให้สรุป');
html = html.replace('Debt = ฿0','แยกจากยอดสัญญาหลัก');
html = html.replace(/function renderNoContract\(\)\{[^\n]*\}/,await readFile(new URL('../client/pending-section.js',import.meta.url),'utf8'));
html = html.replace('function load(boot){full=', 'function load(boot){window.ufundPendingAudit=boot.noContractAudit||{};window.ufundMergeAudit=boot.mergeAudit||null;window.ufundBillingIssues=boot.billingIssues||null;full=');
html = html.replace('อัปเดตล่าสุด: <strong id="updatedAt">','ข้อมูลสัญญาถึง: <strong id="updatedAt">');
// Debt Value is always "ไม่ระบุ" for the pending/no-contract table — the source sheet has no debt figures at all — so the column is pure noise; drop it.
html = html.replace('<th class="num sortable" data-key="sharePct">Share %</th><th class="num sortable" data-key="debt">Debt Value</th></tr></thead><tbody id="noContractTable">', '<th class="num sortable" data-key="sharePct">Share %</th></tr></thead><tbody id="noContractTable">');
// Sold as pending data-entry, not a permanent gap — these rows are new contracts whose Tenor hasn't landed in the source extract yet.
html = html.replace("function displayTenor(value){return value==='#N/A'||value==='Unknown'?'ไม่ระบุ Tenor (#N/A)':value+' เดือน'}", "function displayTenor(value){return value==='#N/A'||value==='Unknown'?'สัญญาใหม่ยังไม่มีมูลค่าสัญญา':value+' เดือน'}");
// Drop the "ช่วงข้อมูล" label so the date-preset buttons sit where it used to be, top-left of the bar.
html = html.replace('<span class="quick-range-label">ช่วงข้อมูล</span>', '');
// RM Summary: surface pending-bill counts (from a separate "ค้าง Bill Auto Fix" workbook) next to each RM's
// contract metrics, and note the grand total beside the existing RM-mapping coverage line.
{
  const rmHeaderOld = '<th class="num sortable" data-key="successRate">Success Rate</th></tr></thead><tbody id="rmSummaryTable">';
  const rmHeaderNew = '<th class="num sortable" data-key="successRate">Success Rate</th><th class="num">บิลค้าง</th></tr></thead><tbody id="rmSummaryTable">';
  if (!html.includes(rmHeaderOld)) throw new Error('rmSummaryStatusTable header anchor not found');
  html = html.replace(rmHeaderOld, rmHeaderNew);
  html = html.replace('colspan="${isAm?13:12}"', 'colspan="${isAm?13:13}"');
  html = html.replace(
    'function orgSummaryRowHtml(x,field){',
    "function billingCell(rmName){const b=window.ufundBillingIssues,v=b?.rmTotals?.[rmName];return `<td class=\"num\"><span class=\"metric-main${v?' bad-number':''}\">${v?fmt(v):'—'}</span></td>`}\nfunction orgSummaryRowHtml(x,field){"
  );
  html = html.replace(
    '<td class="num"><span class="metric-main good-number">${percentLabel(x.successRate)}</span></td></tr>`}',
    '<td class="num"><span class="metric-main good-number">${percentLabel(x.successRate)}</span></td>${field===\'RM\'?billingCell(x.name):\'\'}</tr>`}'
  );
  html = html.replace(
    "$(coverageId).innerHTML=`<strong>${field} Coverage ${pctText(knownCount,t.contracts)}</strong> · พบ ${fmt(knownCount)} จาก ${fmt(t.contracts)} สัญญา · Zoning effective 1 Aug 2026 · ${fmt(shown.length)} รายการ` ;",
    "$(coverageId).innerHTML=`<strong>${field} Coverage ${pctText(knownCount,t.contracts)}</strong> · พบ ${fmt(knownCount)} จาก ${fmt(t.contracts)} สัญญา · Zoning effective 1 Aug 2026 · ${fmt(shown.length)} รายการ` +(!isAm&&window.ufundBillingIssues?` · บิลค้างสะสม ${fmt(window.ufundBillingIssues.grandTotal)} รายการ (${window.ufundBillingIssues.periodStart}–${window.ufundBillingIssues.periodEnd}, ${Object.keys(window.ufundBillingIssues.rmTotals).length} RM ที่มีข้อมูล) — จากไฟล์ ค้าง Bill Auto Fix แยกต่างหาก`:'');"
  );
}
html = html.replace('<footer class="foot panel">','<footer class="foot panel"><div id="mergeSourceNote" style="margin-bottom:8px"></div>');
html = html.replace('<section class="cards" id="heroCards">','<div class="quality warn" id="mergeCaveats" role="status" hidden></div><section class="cards" id="heroCards">');
html = html.replace('function render(){const rows=filtered(),t=totals(rows);','function render(){const rows=filtered(),t=totals(rows);renderMergeCaveats(rows);');
html = html.replace("function load(boot){full=", "function load(boot){window.ufundMergeAudit=boot.mergeAudit||null;full=");
html = html.replace("$('updatedAt').textContent=boot.refreshedAt||'—';", "$('updatedAt').textContent=boot.refreshedAt||'—';$('mergeSourceNote').textContent=boot.mergeAudit?'ฐานเดิม '+fmt(boot.mergeAudit.counts.base_contracts)+' + สัญญาใหม่ '+fmt(boot.mergeAudit.counts.new_contracts)+' = '+fmt(boot.mergeAudit.counts.final_contracts)+' สัญญา · ไม่ลบสัญญาเดิม · MDM ใช้ไฟล์รอบ 15 ก.ย. 2026 เมื่อจับคู่ได้ มิฉะนั้นคงเดิม · เลขเครื่องสถานะขัดกัน '+fmt(boot.mergeAudit.counts.mdm_conflicting_device_keys)+' เครื่องรอตรวจสอบ':'';");
html = html.replace('Full Pivot Audit</a>', 'Full Pivot Audit (ฐานเดิม)</a>').replace('Dashboard Database</a>', 'Google Sheets (ฐานเดิม)</a>');
const brandFilterScript = await readFile(new URL('../client/brand-filter.js', import.meta.url), 'utf8');
html = html.replace("const HIDDEN_FILTERS=[", "const HIDDEN_FILTERS=[['YEAR','Year'],['MONTH','Month'],['SYSTEM','System'],['CUSTOMER_SEGMENT','Customer Segment'],['CHANNEL_TYPE','Channel'],['ZONE_CHANNEL','Channel / Tier'],['PROVINCE','Province'],['DUE_ROUND','Due Round'],['DUE_METHOD','Due Method'],['PRODUCT_GROUP','Product Category'],['MODEL','Model'],['BRAND','Brand'],");
// MDM_CHECK (from build-reviewed-data) separates a confirmed No MDM from a device missing from every MDM
// file; it is a hidden filter so the MDM Overview legend can drill into either half. tidyHero(rows) also
// writes the split onto the No MDM hero card.
if(!html.includes("['MDM_STATUS','MDM Status']]"))throw new Error('MDM_STATUS hidden filter not found');
html = html.replace("['MDM_STATUS','MDM Status']]", "['MDM_STATUS','MDM Status'],['MDM_CHECK','MDM Check'],['BRAND_GROUP','Brand Group']]");
// All Overview contract charts use the active population, including their own dimension.
html = html.replace("const tenorScope=filteredIgnoringFields('TENOR'),statusScope=filteredIgnoringFields('STATUS')", "const tenorScope=rows,statusScope=rows");
html = html.replace("function renderTrend(){const scope=filteredIgnoringFields(['YEAR','MONTH'])", "function renderTrend(){const scope=filtered()");
html = html.replace('<section class="filter-panel is-collapsed"', (await readFile(new URL('../client/shared-filter.html',import.meta.url),'utf8'))+'<section class="filter-panel is-collapsed"');
html = html.replace('function render(){const rows=filtered()', 'function render(){renderGlobalBrandFilter();const rows=filtered()');
html = html.replaceAll('r=>monthInRange(r.MONTH)&&', 'r=>matchesGlobalBrand(r)&&monthInRange(r.MONTH)&&');
html = html.replace('function resetFilters(){', "function resetFilters(){clearSharedFilters();closeDimensionModal();");
// filteredNoContract() (the pending/no-contract tab's own dataset, which has no day-level DAY field)
// still compares via monthInRange. In DAY mode rangeStart/rangeEnd hold exact 'YYYY-MM-DD' values, and
// naive string comparison against a 'YYYY-MM' row value gets the wrong answer (a 7-char prefix always
// sorts before its own 10-char extension), so always compare at month grain regardless of which format
// the range bounds happen to be in.
{
  const monthInRangeOld = "function monthInRange(value){const month=String(value||'').slice(0,7);return(!rangeStart||month>=rangeStart)&&(!rangeEnd||month<=rangeEnd)}";
  if (!html.includes(monthInRangeOld)) throw new Error('monthInRange anchor not found');
  html = html.replace(monthInRangeOld, "function monthInRange(value){const month=String(value||'').slice(0,7),s=rangeStart?String(rangeStart).slice(0,7):'',e=rangeEnd?String(rangeEnd).slice(0,7):'';return(!s||month>=s)&&(!e||month<=e)}");
}
// "Today" / "7 วันย้อนหลัง" now resolve at real day precision (see the DAY field patch below),
// instead of collapsing to the same range as "เดือนนี้" — so the buttons are kept, not dropped.
// The START/END pickers let people pick an exact day, then silently snapped the shown value to that
// day's month start/end — so the box visibly jumped to a different date than the one just clicked.
// Every contract now carries its exact day (see build-reviewed-data.mjs), so swap the native date
// picker for explicit Day/Month/Year dropdowns instead — no browser-picker quirks, and the stale
// "monthly grain only" note underneath is no longer true, so it is dropped too.
{
  const dateInputsOld = '<label><span>เริ่มต้น (START)</span><input id="rangeStart" type="date"></label><label><span>สิ้นสุด (END)</span><input id="rangeEnd" type="date"></label>';
  if (!html.includes(dateInputsOld)) throw new Error('date range inputs anchor not found');
  const dropdownGroup = (prefix, label) => `<label class="day-range-group"><span>${label}</span><span class="day-range-selects"><select id="${prefix}Day"></select><select id="${prefix}Month"></select><select id="${prefix}Year"></select></span></label>`;
  html = html.replace(dateInputsOld, dropdownGroup('rangeStart', 'เริ่มต้น (START)') + dropdownGroup('rangeEnd', 'สิ้นสุด (END)'));
  const rangeRuleOld = '<div class="range-rule">ฐานข้อมูลสรุปเต็มเดือน 1–30/31</div>';
  if (!html.includes(rangeRuleOld)) throw new Error('range-rule note anchor not found');
  html = html.replace(rangeRuleOld, '');
  html = html.replace('</head>', '<style id="day-range-dropdowns">.day-range-selects{display:flex;gap:6px}.day-range-selects select{padding:8px 6px;border:1px solid #dbe7f5;border-radius:8px;background:white;color:#344b61;font:inherit}</style></head>');
  const syncOld = "function syncDateControls(){$('rangeStart').value=firstDay(rangeStart);$('rangeEnd').value=lastDay(rangeEnd);document.querySelectorAll('[data-range-preset]').forEach(btn=>btn.classList.toggle('active',btn.dataset.rangePreset===rangePreset))}";
  if (!html.includes(syncOld)) throw new Error('syncDateControls anchor not found');
  html = html.replace(syncOld, "function syncDateControls(){syncDayRangeSelects();document.querySelectorAll('[data-range-preset]').forEach(btn=>btn.classList.toggle('active',btn.dataset.rangePreset===rangePreset))}");
  const dayRangeScript = await readFile(new URL('../client/day-range-dropdowns.js', import.meta.url), 'utf8');
  html = html.replace("$('resetBtn').onclick=resetFilters;", () => dayRangeScript + "\n$('resetBtn').onclick=resetFilters;");
  const buildFiltersOld = 'buildFilters();syncDateControls();';
  if (!html.includes(buildFiltersOld)) throw new Error('buildFilters call anchor not found');
  html = html.replace(buildFiltersOld, 'buildFilters();populateDayRangeSelects();syncDateControls();');
  // Dead event binding left over from the single <input type="date"> elements this patch just replaced —
  // those ids no longer exist, so this threw on every load and aborted the rest of that init script
  // (populateDayRangeSelects included), leaving the new dropdowns permanently empty.
  const deadBindingOld = "$('rangeStart').onchange=e=>setDateRange(e.target.value,rangeEnd);$('rangeEnd').onchange=e=>setDateRange(rangeStart,e.target.value);";
  if (!html.includes(deadBindingOld)) throw new Error('dead rangeStart/rangeEnd onchange binding anchor not found');
  html = html.replace(deadBindingOld, '');
}
html = html.replace('function setQuickRange(preset){', "function setQuickRange(preset){delete sharedFilters.fields.MONTH;");
// "Today" / "7 วันย้อนหลัง" / "เดือนนี้" must resolve against the latest month actually present in the
// loaded data, not the browser's real clock — the snapshot lags behind today's date, so anchoring on the
// real date always landed outside the data and showed zero results.
html = html.replace(
  "const now=new Date(),year=now.getFullYear(),month=`${year}-${String(now.getMonth()+1).padStart(2,'0')}`;",
  "const latestMonth=[...new Set(full.map(r=>String(r.MONTH)).filter(m=>/^\\d{4}-\\d{2}$/.test(m)))].sort().at(-1);const now=latestMonth?new Date(latestMonth+'-01T00:00:00'):new Date(),year=now.getFullYear(),month=latestMonth||`${year}-${String(now.getMonth()+1).padStart(2,'0')}`;"
);
// Today / 7-days-back resolve at real day precision, anchored to the latest DAY value actually
// present in the data (the DAY field only carries the most recent ~35 days — see build-reviewed-data.mjs
// — everything older is 'No Data' and simply can't match a day-precision filter, which is correct: those
// two presets are never meant to reach that far back).
{
  const quickRangeOld = "if(preset==='ALL')setDateRange('','',preset);else if(preset==='YEAR')setDateRange(`${year}-01`,month,preset);else setDateRange(month,month,preset)}";
  if (!html.includes(quickRangeOld)) throw new Error('setQuickRange body anchor not found');
  const quickRangeNew = "if(preset==='ALL')setDateRange('','',preset);else if(preset==='YEAR')setDateRange(`${year}-01`,month,preset);else if(preset==='TODAY'||preset==='LAST7'){const latestDay=[...new Set(full.map(r=>String(r.DAY)).filter(d=>/^\\d{4}-\\d{2}-\\d{2}$/.test(d)))].sort().at(-1);if(!latestDay){setDateRange(month,month,preset);return}const end=new Date(latestDay+'T00:00:00'),start=new Date(end);if(preset==='LAST7')start.setDate(start.getDate()-6);const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;delete sharedFilters.fields.MONTH;rangeMode='DAY';rangeStart=iso(start);rangeEnd=iso(end);rangePreset=preset;syncDateControls();scheduleRender()}else setDateRange(month,month,preset)}";
  html = html.replace(quickRangeOld, quickRangeNew);
}
html = html.replace("function setDateRange(start,end,preset='CUSTOM'){", "function setDateRange(start,end,preset='CUSTOM'){delete sharedFilters.fields.MONTH;rangeMode='MONTH';");
html = html.replace('const anyFilter=Boolean(rangeStart||rangeEnd)', 'const anyFilter=Boolean(sharedFilters.brands.size||sharedFilters.shops.size||Object.values(sharedFilters.fields).some(Boolean)||rangeStart||rangeEnd)');
html = html.replaceAll('row.PRODUCT_GROUP=row.PRODUCT_GROUP||clientProductGroup(row);return row', 'row.BRAND=reviewedProductBrand(row.BRAND);row.PRODUCT_GROUP=row.PRODUCT_GROUP||clientProductGroup(row);row.PRODUCT_GROUP=sharedRow(row).CATEGORY;return row');
html = html.replace("const order=['iPhone','Laptop','Smartphone','Tablet','Other Apple','Other / Unmapped']", "const order=['iPhone','iPad','Mac','Notebook','Smartphone','Tablet','อื่น ๆ / รอตรวจสอบ']");
html = html.replace("tones={'iPhone':", "tones={'iPad':'#10b981','Mac':'#64748b','Notebook':'#22b8cf','อื่น ๆ / รอตรวจสอบ':'#f59e0b','iPhone':");
html = html.replace("icons={'iPhone':", "icons={'iPad':'PAD','Mac':'MAC','Notebook':'NB','อื่น ๆ / รอตรวจสอบ':'OTH','iPhone':");
html = html.replace("const selectedBrands=[...(state.BRAND||[])]", "const selectedBrands=state.BRAND?.size?[...state.BRAND]:sharedFilters.brands.size?[...new Set(brandScope.map(r=>String(r.BRAND)).filter(b=>sharedFilters.brands.has(canonicalBrand(b))))]:[]");
html = html.replace('<script>\nconst STATUS_ORDER', '<script>\n'+brandFilterScript+'\nconst STATUS_ORDER');
html = html
  .replace('<title>Dashboard</title>', '<title>UFUND Executive Intelligence</title><meta name="description" content="UFUND Contract, Debtor and MDM Executive Dashboard">')
  .replace('V.21.0 · RM/AM Zoning', 'Vercel Edition · Secure Access')
  .replace('<h1>Executive Dashboard</h1>', '<h1>Executive Intelligence</h1>')
  .replace('<div class="actions"><button class="btn" id="resetBtn">Reset</button>', '<div class="actions"><button class="btn command-trigger" id="commandBtn" type="button">⌘ ค้นหาด่วน</button><button class="btn" id="themeBtn" type="button" aria-label="สลับโหมดสี">◐</button><button class="btn" id="resetBtn">Reset</button>');

const modernStyles = `
  <style id="vercel-modern-ui">
    .global-brand-filter{margin:12px 0;padding:16px 18px;background:#fff;border:1px solid #dce5ef;border-radius:16px;box-shadow:0 8px 24px rgba(15,23,42,.05)}.global-brand-heading{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center}.global-brand-heading span{font-size:12px;color:#526780}.global-brand-buttons{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.global-brand-button{border:1px solid #dce5ef;border-radius:24px;padding:8px 16px;min-height:40px;font:inherit;font-size:13px;font-weight:700;color:#344b61;background:#f8fafc;cursor:pointer}.global-brand-button:hover{border-color:#2563eb}.global-brand-button[aria-pressed=true]{background:#2563eb;border-color:#2563eb;color:#fff;box-shadow:0 4px 12px #2563eb25}.global-brand-button:focus-visible{outline:3px solid #93c5fd;outline-offset:2px}body.dark .global-brand-filter{background:#0e1b2d;border-color:#2b3c52}body.dark .global-brand-heading span{color:#afc1d8}body.dark .global-brand-button{background:#172a43;color:#dce8f5;border-color:#354c68}body.dark .global-brand-button[aria-pressed=true]{background:#2563eb;border-color:#60a5fa;color:#fff}
    :root{--glow:#22d3ee;--electric:#4f46e5;--surface:rgba(255,255,255,.86)}
    html{scroll-behavior:smooth} body{background:radial-gradient(circle at 8% 0,rgba(34,211,238,.14),transparent 25%),radial-gradient(circle at 92% 8%,rgba(79,70,229,.16),transparent 27%),#eef3f9}
    .wrap{max-width:1800px;padding:20px 24px 52px}.top{min-height:148px;background:linear-gradient(118deg,#07152f 0%,#142d66 53%,#0e7490 112%);border-radius:26px;box-shadow:0 24px 60px rgba(7,21,47,.25)}
    .top:before{content:"LIVE DATA WORKSPACE";position:absolute;right:28px;bottom:18px;font-size:10px;font-weight:900;letter-spacing:.18em;color:#a5f3fc;opacity:.9}.top h1{font-size:34px}.top .actions{max-width:680px}
    .command-trigger{min-width:135px}.quick-range-bar,.filter-panel,.quality,.dashboard-tabs{border:1px solid rgba(148,163,184,.22);box-shadow:0 12px 34px rgba(15,23,42,.07);backdrop-filter:blur(18px)}
    .dashboard-tabs{position:sticky;top:10px;z-index:23;padding:7px;border-radius:16px;background:rgba(255,255,255,.82)}.tab-btn{min-height:45px;border-radius:11px}.tab-btn.active{background:linear-gradient(115deg,#0f172a,#1d4ed8);color:#fff;box-shadow:0 10px 24px rgba(29,78,216,.2)}
    .cards{grid-template-columns:repeat(5,minmax(0,1fr))}.card{position:relative;overflow:hidden;min-height:152px;border:0;border-top:0;background:linear-gradient(150deg,rgba(255,255,255,.96),rgba(239,246,255,.88))}.card:after{content:"";position:absolute;right:-34px;bottom:-48px;width:112px;height:112px;border-radius:50%;background:var(--blue);opacity:.08}.card:hover{transform:translateY(-3px);box-shadow:0 18px 40px rgba(15,23,42,.12)}
    .panel,.dimension-shell{border:1px solid rgba(148,163,184,.2);box-shadow:0 14px 38px rgba(15,23,42,.07)}.table-wrap{border-radius:14px}th{height:46px;background:#e8f0f8}tbody tr{transition:background .15s,transform .15s}tbody tr:hover{background:#eef6ff}
    .command-palette[hidden]{display:none}.command-palette{position:fixed;inset:0;z-index:1500;display:grid;place-items:start center;padding-top:min(16vh,150px);background:rgba(2,6,23,.56);backdrop-filter:blur(10px)}.command-card{width:min(640px,calc(100vw - 28px));overflow:hidden;border:1px solid rgba(255,255,255,.22);border-radius:22px;background:#fff;box-shadow:0 28px 90px rgba(2,6,23,.38)}.command-input{width:100%;height:64px;padding:0 20px;border:0;border-bottom:1px solid #e2e8f0;outline:0;font:700 16px inherit}.command-list{display:grid;gap:7px;padding:12px;max-height:390px;overflow:auto}.command-item{display:flex;justify-content:space-between;align-items:center;width:100%;padding:13px 14px;border:0;border-radius:12px;background:#f8fafc;color:#1e293b;text-align:left;font:800 14px inherit;cursor:pointer}.command-item:hover,.command-item:focus{background:#eaf2ff;color:#1d4ed8}.command-item span:last-child{font-size:11px;color:#94a3b8}
    body.dark{--ink:#dce8f5;--muted:#93a4b8;--line:#26364c;--bg:#07111f;--panel:#0e1b2d;--soft-blue:#12243c;--soft-green:#112a25;--soft-red:#2e1b22;--soft-orange:#2b2417;--soft-purple:#241d39;background:radial-gradient(circle at 10% 0,rgba(6,182,212,.13),transparent 28%),#07111f;color:var(--ink)}body.dark .quick-range-bar,body.dark .filter-panel,body.dark .quality,body.dark .dashboard-tabs,body.dark .panel,body.dark .card,body.dark .status-card,body.dark .dimension-shell{background:rgba(12,26,44,.9);border-color:#24364d}body.dark .filter,body.dark .filter-menu,body.dark .select,body.dark input,body.dark .command-card{background:#0e1b2d;color:#dce8f5;border-color:#2b3c52}body.dark th{background:#14253b;color:#b9c9da}body.dark td{border-color:#203147}body.dark tbody tr:nth-child(even){background:rgba(17,34,56,.55)}body.dark tbody tr:hover{background:#172b45}body.dark .card .pct,body.dark .status-card .pct{color:#e6f3ff}body.dark .donut:after{background:#0e1b2d}body.dark .command-item{background:#12243a;color:#dce8f5}
    @media(max-width:1200px){.cards{grid-template-columns:repeat(3,1fr)}}@media(max-width:760px){.wrap{padding:12px}.top{padding:20px;min-height:190px;align-items:flex-start}.top h1{font-size:27px}.top .actions{justify-content:flex-start}.cards{grid-template-columns:1fr 1fr}.dashboard-tabs{top:6px;overflow-x:auto;flex-wrap:nowrap}.tab-btn{flex:0 0 auto}.command-trigger{min-width:auto}}@media(max-width:470px){.cards{grid-template-columns:1fr}.top .actions .btn{flex:1}.command-trigger{flex-basis:100%!important}}
    @media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;transition:none!important;animation-duration:.001ms!important}}
  </style>`;
html = html.replace('</head>', `${modernStyles}</head>`);
html = html.replace('</head>', '<style>'+await readFile(new URL('../client/shared-filter.css',import.meta.url),'utf8')+'</style></head>');

const palette = `<div class="command-palette" id="commandPalette" hidden><div class="command-card" role="dialog" aria-modal="true" aria-label="ค้นหาด่วน"><input class="command-input" id="commandInput" type="search" placeholder="พิมพ์ชื่อหน้า เช่น MDM, Brand, RM, AM…"><div class="command-list" id="commandList"></div></div></div>`;
html = html.replace('<script>\n'+brandFilterScript, `${palette}<script>\n${brandFilterScript}`);

const oldRefresh = `function refresh(){showLoading(true,'กำลัง Refresh','กำลังสร้างข้อมูลสรุปใหม่');google.script.run.withSuccessHandler(async packet=>{try{await acceptPayload(packet);showLoading(false);toast(\`Refresh สำเร็จใน \${packet.refreshSeconds||0} วินาที\`)}catch(err){showLoading(false);toast('เปิดข้อมูลใหม่ไม่สำเร็จ: '+err.message,5000)}}).withFailureHandler(err=>{showLoading(false);if(isSessionError(err))showLogin('Session หมดอายุ กรุณาเข้าสู่ระบบใหม่');else toast('Refresh ไม่สำเร็จ: '+(err.message||err),5000)}).refreshDashboardData(dashboardAuthToken)}`;
const newRefresh = `async function fetchDashboard(live=false){const response=await fetch('/api/dashboard',{credentials:'same-origin',cache:'no-store',headers:live?{'X-Ufund-Live':'1'}:{}});if(response.status===401)throw new Error('SESSION_EXPIRED');if(!response.ok)throw new Error('เปิดข้อมูลไม่สำเร็จ');return response.json()}\nasync function refresh(){showLoading(true,'กำลัง Refresh','กำลังดึงฐานข้อมูลล่าสุด');try{await acceptPayload(await fetchDashboard(true));showLoading(false);toast('Refresh ข้อมูลล่าสุดสำเร็จ')}catch(err){showLoading(false);if(isSessionError(err))showLogin('Session หมดอายุ กรุณาเข้าสู่ระบบใหม่');else toast('Refresh ไม่สำเร็จ: '+(err.message||err),5000)}}`;
html = html.replace(oldRefresh, newRefresh);

const authStart = html.indexOf('function loadAuthorizedDashboard(token)');
const authEnd = html.indexOf('async function copyTable', authStart);
if (authStart < 0 || authEnd < 0) throw new Error('Could not locate Apps Script authentication block');
html = html.slice(0, authStart) +
`async function loadAuthorizedDashboard(){showDashboard();showLoading(true);try{await acceptPayload(await fetchDashboard());showLoading(false)}catch(err){showLoading(false);if(isSessionError(err))showLogin('Session หมดอายุ กรุณาเข้าสู่ระบบใหม่');else showLogin('เปิดข้อมูลไม่สำเร็จ กรุณาลองอีกครั้ง')}}
async function attemptLogin(){const password=$('loginPassword').value;if(!password){shakeLogin('กรุณากรอกรหัสผ่าน');return}setLoginBusy(true);$('loginError').textContent='';try{const response=await fetch('/api/session',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({password})});const result=await response.json();setLoginBusy(false);if(!response.ok||!result?.ok){shakeLogin(result?.error||'รหัสผ่านไม่ถูกต้อง');$('loginPassword').select();return}$('loginPassword').value='';await loadAuthorizedDashboard()}catch(err){setLoginBusy(false);shakeLogin('ตรวจสอบรหัสไม่สำเร็จ กรุณาลองใหม่')}}
async function logoutDashboardUi(){try{await fetch('/api/logout',{method:'POST',credentials:'same-origin'})}catch(e){}showLogin()}
` + html.slice(authEnd);

const enhancements = `
function renderMergeCaveats(rows){const node=$('mergeCaveats');if(!node)return;const missing=rows.filter(r=>r.DATA_COMPLETENESS&&r.DATA_COMPLETENESS!=='Known value').reduce((n,r)=>n+num(r.CONTRACTS),0);node.hidden=!missing;node.style.display=missing?'block':'none';node.textContent=missing?\`รวมจำนวนสัญญาใหม่แล้ว แต่ \${fmt(missing)} สัญญาในตัวเลือกนี้ยังไม่มีมูลค่าสัญญา / Tenor / สาขาในไฟล์ใหม่ — ยอดเงินบาทรวมเฉพาะรายการที่มีข้อมูล ไม่ใช่มูลค่าครบทุกสัญญา\`:'';}
const COMMANDS=[['ufund','Overview','ภาพรวมสัญญาและสถานะลูกหนี้'],['mdm','MDM Risk','วิเคราะห์ Success / Unsuccess / No MDM'],['brand','Brand & Product','เจาะแบรนด์และรุ่นสินค้า'],['dimension','Channel & Organization','ช่องทาง ภาค จังหวัด และสาขา'],['rm','RM Summary','ภาพรวมผลงานราย RM'],['am','AM Summary','ภาพรวมผลงานราย AM']];
function renderCommands(query=''){const q=query.trim().toLocaleLowerCase('th'),items=COMMANDS.filter(x=>!q||x.slice(1).join(' ').toLocaleLowerCase('th').includes(q));$('commandList').innerHTML=items.map(x=>\`<button class="command-item" type="button" data-command-tab="\${x[0]}"><span>\${x[1]}<small style="display:block;font-weight:600;color:#64748b">\${x[2]}</small></span><span>เปิด ↗</span></button>\`).join('')||'<div class="muted" style="padding:18px">ไม่พบเมนู</div>';document.querySelectorAll('[data-command-tab]').forEach(btn=>btn.onclick=()=>{selectTab(btn.dataset.commandTab);closeCommand();window.scrollTo({top:0,behavior:'smooth'})})}
function openCommand(){renderCommands();$('commandPalette').hidden=false;$('commandInput').value='';setTimeout(()=>$('commandInput').focus(),30)}function closeCommand(){$('commandPalette').hidden=true}
function setTheme(dark){document.body.classList.toggle('dark',dark);localStorage.setItem('ufund_theme',dark?'dark':'light');$('themeBtn').textContent=dark?'☀':'◐'}
$('commandBtn').onclick=openCommand;$('commandInput').oninput=e=>renderCommands(e.target.value);$('commandPalette').onclick=e=>{if(e.target===$('commandPalette'))closeCommand()};$('themeBtn').onclick=()=>setTheme(!document.body.classList.contains('dark'));setTheme(localStorage.getItem('ufund_theme')==='dark');document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openCommand()}if(e.key==='Escape'&&!$('commandPalette').hidden)closeCommand()});
`;
html = html.replace("(function(){reorderUfundSections();let saved='';try{saved=sessionStorage.getItem('ufund_dashboard_token')||''}catch(e){};if(saved)loadAuthorizedDashboard(saved);else showLogin()})();", `${enhancements}\n(async function(){reorderUfundSections();try{const response=await fetch('/api/session',{credentials:'same-origin',cache:'no-store'});const result=await response.json();if(result.authenticated)await loadAuthorizedDashboard();else showLogin()}catch(e){showLogin()}})();`);

// Mockup visual treatment is layered last. Existing interactions and values stay intact.
html=html.replace('renderHero(rows,t);','renderHero(rows,t);tidyHero(rows);').replace('renderStatus(rows,t);','renderStatus(rows,t);tidyStatus(rows);');
html=html.replace('shown=sorted.slice(0,150)','shown=branchPageRows(sorted)');
html=html.replace("$('branchTableNote').textContent=", "branchPager();$('branchTableNote').textContent=");
html=html.replace("${sign}${fmt(info.delta)} · ${sign}${percentLabel(info.rate)} YoY", "${info.delta>0?'↑ ':info.delta<0?'↓ ':''}${sign}${fmt(info.delta)} · ${sign}${percentLabel(info.rate)} YoY");
html=html.replace("${sharedFilters[key].has(name)?'✓ ':''}${esc(name)}", "${esc(name)}");
html=html.replace("${esc(note||'Value')}: ${moneyK(value)}", "${activeTab==='mdm'?'มูลค่า':esc(note||'Value')}: ${moneyK(value)}");
html=html.replace('${fmt(p.total)}</div><div class="time-stack"','${trendOutsideLabels(p,max)}</div><div class="time-stack"');
html=html.replace('p.total/max*205','p.total/max*270');
html=html.replace('height:${pct(p.active,p.total)}%"></span>','height:${pct(p.active,p.total)}%">${p.active/max*270>=44?trendNumberLabel(p,"active"):""}</span>');
html=html.replace('height:${pct(p.closed,p.total)}%"></span>','height:${pct(p.closed,p.total)}%">${p.closed/max*270>=44?trendNumberLabel(p,"closed"):""}</span>');
html=html.replace('data-time-key="${esc(p.key)}"','tabindex="0" role="button" aria-label="${esc(p.label)} · Total ${fmt(p.total)} · Active ${fmt(p.active)} · Closed ${fmt(p.closed)}" data-trend-total="${p.total}" data-trend-active="${p.active}" data-trend-closed="${p.closed}" data-time-key="${esc(p.key)}"');
html=html.replace(/function reorderUfundSections\(\)\{[^\n]*\}/,'function reorderUfundSections(){tidySectionOrder()}');
html=html.replace('<script>','<script>\n'+await readFile(new URL('../client/tidy-layout.js',import.meta.url),'utf8')+'\n'+await readFile(new URL('../client/od-bucket-chart.js',import.meta.url),'utf8')+'\n'+await readFile(new URL('../client/insight-charts.js',import.meta.url),'utf8')+'\n');
html=html.replace('</head>','<style id="od-bucket-chart">'+await readFile(new URL('../client/od-bucket-chart.css',import.meta.url),'utf8')+'</style></head>');
html=html.replace('</head>','<style id="mockup-theme">'+await readFile(new URL('../client/mockup-theme.css',import.meta.url),'utf8')+'</style></head>');
html=html.replace('</head>','<style>'+await readFile(new URL('../client/tidy-layout.css',import.meta.url),'utf8')+'</style></head>');
html=html.replace('</head>','<style id="executive-layout">'+await readFile(new URL('../client/executive-layout.css',import.meta.url),'utf8')+'</style></head>');
html=html.replace('</head>','<style id="interaction-layer">'+await readFile(new URL('../client/interaction-layer.css',import.meta.url),'utf8')+'</style></head>');
html=html.replace('</head>','<style id="rounded-trend">'+await readFile(new URL('../client/rounded-trend.css',import.meta.url),'utf8')+'</style></head>');
const interactionScript=await readFile(new URL('../client/interaction-layer.js',import.meta.url),'utf8');
html=html.replace("$('resetBtn').onclick=resetFilters;",()=>interactionScript+"\n$('resetBtn').onclick=resetFilters;installInteractionLayer();");
// Approved status-card layouts and single MDM detail popover; no data or filter changes.
html=html.replace('</head>','<style id="status-blocks-layout">'+await readFile(new URL('../client/status-blocks.css',import.meta.url),'utf8')+'</style><style id="mdm-status-cards">'+await readFile(new URL('../client/mdm-status-cards.css',import.meta.url),'utf8')+'</style></head>');
const mdmStatusScript=await readFile(new URL('../client/mdm-status-cards.js',import.meta.url),'utf8');
html=html.replace("$('resetBtn').onclick=resetFilters;",()=>mdmStatusScript+"\n$('resetBtn').onclick=resetFilters;");
html=html.replace('</head>','<style id="text-flow">'+await readFile(new URL('../client/text-flow.css',import.meta.url),'utf8')+'</style></head>');
// Keep the original table and sort bindings, but disclose it only on request.
html=html.replace(/<section class="section tab-section" data-tab-section="ufund"><div class="section-head"><div><h2>Status Detail<\/h2>[\s\S]*?<\/section>/,section=>{
 const panel=section.slice(section.indexOf('<div class="panel">'),section.lastIndexOf('</section>'));
 if(!panel.includes('id="detailStatusTable"'))throw new Error('Status Detail table not found');
 return '<section class="section tab-section" data-tab-section="ufund"><details id="statusDetailDisclosure"><summary><span class="status-detail-heading">Status Detail</span><span class="status-detail-action"><span class="when-closed">ดูตารางรายละเอียด</span><span class="when-open">ซ่อนตารางรายละเอียด</span><span class="status-detail-chevron" aria-hidden="true">⌄</span></span></summary>'+panel+'</details></section>';
});
html=html.replace('</head>','<style id="status-detail-disclosure">'+await readFile(new URL('../client/status-detail-disclosure.css',import.meta.url),'utf8')+'</style></head>');
html=html.replace('<h1>Executive Intelligence</h1>','<h1>Executive Dashboard</h1>');
html=html.replace('<section class="global-brand-filter"','<details class="mock-filter-disclosure"><summary>แบรนด์ · ร้าน / ช่องทาง · ตัวกรองร่วมทุกหน้า</summary><section class="global-brand-filter"');
html=html.replace('<section class="filter-panel is-collapsed"','</details><section class="filter-panel is-collapsed"');
// Legacy Region/RM/AM/Branch single-select list is superseded by the unified dropdown grid above.
html=html.replace("const FILTERS=[['REGION','Region'],['RM','RM'],['AM','AM'],['BRANCH','Branch']];", "const FILTERS=[];");
// Pull the quick-range presets and date range out of the collapsible "ตัวกรองเพิ่มเติม" accordion and
// show them as one always-visible compact bar above the brand/shop filter, instead of a hidden accordion.
{
  const quickRangeMatch = html.match(/<section class="quick-range-bar"[\s\S]*?<\/section>/);
  if (!quickRangeMatch) throw new Error('quick-range-bar section not found');
  const quickRangeHtml = quickRangeMatch[0];
  html = html.replace(quickRangeHtml, '');
  const filterPanelMatch = html.match(/<section class="filter-panel is-collapsed" id="filterPanel">[\s\S]*?<\/section>/);
  if (!filterPanelMatch) throw new Error('filter-panel section not found');
  const filterPanelHtml = filterPanelMatch[0];
  html = html.replace(filterPanelHtml, '');
  const topBar = `<section class="top-range-bar">${quickRangeHtml}${filterPanelHtml
    .replace('<section class="filter-panel is-collapsed" id="filterPanel">', '<div class="filter-panel" id="filterPanel">')
    .replace('<div class="filter-panel-body" id="filterPanelBody" hidden>', '<div class="filter-panel-body" id="filterPanelBody">')
    .replace(/<\/section>$/, '</div>')}</section>`;
  if (!html.includes('<section class="global-brand-filter"')) throw new Error('global-brand-filter anchor not found');
  html = html.replace('<details class="mock-filter-disclosure">', `${topBar}<details class="mock-filter-disclosure">`);
}
// Performance: the dataset now carries real per-branch granularity (1,700+ branches) instead of the
// legacy snapshot's mostly-"No Data" RM/AM/branch fields, so `full` is far less compressible and every
// full-array scan costs real time. Two safe, output-identical optimizations: (1) skip the filter scan
// entirely when no filter is active (the common case is viewing "ALL"), returning `full` directly; (2)
// skip the YoY maps / merge caveats on a bare tab switch — they depend only on the filtered rows, tracked
// by referential equality of `rows` (safe: filtered()/full are replaced wholesale, never mutated). The hero
// cards are NOT tab-independent (renderHero builds a different set per tab, and tidyHero regroups whatever
// raw cards it finds), so they are redrawn whenever the rows OR the active tab change — re-running
// tidyHero on already-grouped cards nested empty groups and duplicated chevrons on every tab switch.
{
  const filteredOld = "function filtered(){return full.filter(r=>matchesGlobalBrand(r)&&monthInRange(r.MONTH)&&ALL_FILTERS.every(([f])=>!state[f].size||state[f].has(String(r[f]))))}\nfunction filteredIgnoringFields(fields){const ignored=new Set(Array.isArray(fields)?fields:[fields]);return full.filter(r=>matchesGlobalBrand(r)&&monthInRange(r.MONTH)&&ALL_FILTERS.every(([f])=>ignored.has(f)||!state[f].size||state[f].has(String(r[f]))))}";
  if (!html.includes(filteredOld)) throw new Error('filtered()/filteredIgnoringFields anchor not found');
  const filteredNew = "let lastHeroRows=null,lastHeroTab=null;let rangeMode='MONTH';function inSelectedRange(row){if(rangeMode==='DAY'){const day=row.DAY;if(!day||day==='No Data')return false;return(!rangeStart||day>=rangeStart)&&(!rangeEnd||day<=rangeEnd)}return monthInRange(row.MONTH)}function anyFilterActive(){return Boolean(sharedFilters.brands.size||sharedFilters.shops.size||Object.values(sharedFilters.fields).some(Boolean)||rangeStart||rangeEnd||ALL_FILTERS.some(([f])=>state[f].size))}function filtered(){return anyFilterActive()?full.filter(r=>matchesGlobalBrand(r)&&inSelectedRange(r)&&ALL_FILTERS.every(([f])=>!state[f].size||state[f].has(String(r[f])))):full}function filteredIgnoringFields(fields){if(!anyFilterActive())return full;const ignored=new Set(Array.isArray(fields)?fields:[fields]);return full.filter(r=>matchesGlobalBrand(r)&&inSelectedRange(r)&&ALL_FILTERS.every(([f])=>ignored.has(f)||!state[f].size||state[f].has(String(r[f]))))}";
  html = html.replace(filteredOld, filteredNew);

  const renderOld = "function render(){renderGlobalBrandFilter();const rows=filtered(),t=totals(rows);renderMergeCaveats(rows);currentYoy=buildYoyMaps(filteredIgnoringYear());const dateText=rangeStart||rangeEnd?`เดือน ${rangeStart||'เริ่มต้น'} ถึง ${rangeEnd||'ล่าสุด'}`:'';$('filterSummary').textContent='Filter: '+([dateText,...ALL_FILTERS.flatMap(([f,l])=>state[f].size?[`${l} ${state[f].size}`]:[])].filter(Boolean).join(' · ')||'ALL');renderQuality(t);renderHero(rows,t);tidyHero(rows);if(activeTab==='mdm'){";
  if (!html.includes(renderOld)) throw new Error('render() anchor not found');
  const renderNew = "function render(){renderGlobalBrandFilter();const rows=filtered(),t=totals(rows);const dateText=rangeStart||rangeEnd?`เดือน ${rangeStart||'เริ่มต้น'} ถึง ${rangeEnd||'ล่าสุด'}`:'';$('filterSummary').textContent='Filter: '+([dateText,...ALL_FILTERS.flatMap(([f,l])=>state[f].size?[`${l} ${state[f].size}`]:[])].filter(Boolean).join(' · ')||'ALL');renderQuality(t);if(rows!==lastHeroRows){renderMergeCaveats(rows);currentYoy=buildYoyMaps(filteredIgnoringYear());lastHeroRows=rows;lastHeroTab=null}if(activeTab!==lastHeroTab){renderHero(rows,t);tidyHero(rows);lastHeroTab=activeTab}if(activeTab==='mdm'){";
  html = html.replace(renderOld, renderNew);
}
for(const [oldColor,newColor] of Object.entries({'#7eae91':'#27bf79','#d99690':'#ef4057','#8b98a5':'#94a3b8','#79a8ca':'#278cff','#9d94bb':'#9864f5','#d1aa6c':'#ffb34f'}))html=html.replaceAll(oldColor,newColor);
if (html.includes('google.script.run')) throw new Error('Apps Script calls remain in the Vercel HTML');
// Date filter on one row: the START / END dropdowns first, then the quick-range buttons beside them
// (the buttons used to sit in their own bar above).
{
  const bar = html.match(/<section class="quick-range-bar"[^>]*>(<div class="quick-range-buttons">[\s\S]*?<\/div>)<\/section>/);
  const endGroup = '<select id="rangeEndYear"></select></span></label>';
  if (!bar || !html.includes(endGroup)) throw new Error('date filter markup not found');
  html = html.replace(bar[0], '').replace(endGroup, endGroup + bar[1]);
}
// Brand & Product: two-level cards (client/brand-groups.js) replace the old mixed row and the separate
// Apple card above it.
{
  const cardsStart = html.indexOf("$('brandGroupCards').innerHTML=order.map(");
  const cardsEnd = html.indexOf("$('productTitle').textContent=", cardsStart);
  const appleStart = 'function renderAppleProductCard(rows,t){';
  if (cardsStart < 0 || cardsEnd < 0 || !html.includes(appleStart)) throw new Error('Brand & Product card markup not found');
  html = html.slice(0, cardsStart) + 'renderBrandGroupCards();\n  ' + html.slice(cardsEnd);
  html = html.replace(appleStart, appleStart + "$('appleProductCardHost').innerHTML='';$('appleProductCardHost').hidden=true;return;");
  html = html.replace('<script>', '<script>\n' + await readFile(new URL('../client/brand-groups.js', import.meta.url), 'utf8') + '\n');
  // Brand tab hero cards: the product groups the page actually uses (iPad / Mac / Notebook, not the raw
  // Laptop / Tablet names), and only those present in the current filter, so picking Apple shows
  // iPhone · iPad · Mac instead of zero cards.
  const heroOld = "['iPhone','Laptop','Smartphone','Tablet'].forEach((k,i)=>{const x=products[k]||{contracts:0,hp:0};cards.push(heroCard(k,pct(x.contracts,t.contracts),x.contracts,x.hp,['purple','green','orange',''][i],";
  if (!html.includes(heroOld)) throw new Error('Brand tab hero cards not found');
  html = html.replace(heroOld, "['iPhone','iPad','Mac','Smartphone','Tablet','Notebook'].filter(k=>products[k]?.contracts).forEach((k,i)=>{const x=products[k];cards.push(heroCard(k,pct(x.contracts,t.contracts),x.contracts,x.hp,['purple','green','orange','','purple','green'][i],");
}
// Money: show full baht (฿9,621,770,212) instead of thousands with a "K" suffix, and call the contract
// value "มูลค่าสัญญา" rather than "Value" (OD Value keeps its name; it is the overdue amount).
{
  const oldMoney = "moneyK=n=>{const k=num(n)/1000,d=Math.abs(k)>0&&Math.abs(k)<1?2:0;return'฿'+k.toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d})+'K'}";
  if (!html.includes(oldMoney)) throw new Error('moneyK formatter not found');
  html = html.replace(oldMoney, "moneyK=n=>'฿'+Math.round(num(n)).toLocaleString('en-US')");
  for (const [from, to] of [
    ["activeTab==='mdm'?'มูลค่า':esc(note||'Value')", "activeTab==='mdm'?'มูลค่าสัญญา':esc(note||'มูลค่าสัญญา')"],
    ["'Total Value'", "'มูลค่าสัญญา'"],
    ["'Value: '+moneyK(x.hp)", "'มูลค่าสัญญา: '+moneyK(x.hp)"],
    ['Value: ${moneyK(item.hp)}', 'มูลค่าสัญญา: ${moneyK(item.hp)}'],
    ['Value: ${moneyK(t.hp)}', 'มูลค่าสัญญา: ${moneyK(t.hp)}'],
    ['Value: ${moneyK(x.hp)}', 'มูลค่าสัญญา: ${moneyK(x.hp)}'],
    [",'Value',yoyFromMap", ",'มูลค่าสัญญา',yoyFromMap"],
    [",'Value',null,", ",'มูลค่าสัญญา',null,"],
    ['Value (K)', 'มูลค่าสัญญา (บาท)']
  ]) {
    if (!html.includes(from)) throw new Error('value label not found: ' + from);
    html = html.split(from).join(to);
  }
}
// Readability: the older theme layers set a lot of 10–11px text, too small for Thai script. Raise every
// tiny font-size inside <style> blocks to a 12px floor, then add the readability + motion layer last.
html = html.replace(/<style([^>]*)>([\s\S]*?)<\/style>/g, (m, attrs, css) =>
  `<style${attrs}>${css.replace(/font-size:\s*(10|10\.5|11|11\.5)px/g, (_, n) => `font-size:${Math.max(12, +n + 1)}px`)}</style>`);
html = html.replace('</head>', '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700&display=swap">' +
  '<style id="polish">' + await readFile(new URL('../client/polish.css', import.meta.url), 'utf8') + '</style></head>');
html = html.replace('<script>', '<script>\n' + await readFile(new URL('../client/polish.js', import.meta.url), 'utf8') + '\n');
// public/index.html may be hand-edited for small wording changes. Each build keeps a copy of what it
// generated; if the live page no longer matches that copy, someone edited it, so stop instead of silently
// overwriting the edits (they need to be carried into client/ or this script first). Pass
// --overwrite-manual-edits to replace the page anyway; the edited page is still saved under data/.
const indexFile = new URL('index.html', publicDir), generatedCopy = new URL('.index.generated.html', dataDir);
const readIfExists = async file => { try { return await readFile(file, 'utf8'); } catch (error) { if (error.code === 'ENOENT') return null; throw error; } };
const [livePage, lastGenerated] = await Promise.all([readIfExists(indexFile), readIfExists(generatedCopy)]);
if (livePage !== null && lastGenerated !== null && livePage !== lastGenerated && livePage !== html) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backup = new URL(`index.manual-edits-${stamp}.html`, dataDir);
  await writeFile(backup, livePage);
  if (!process.argv.includes('--overwrite-manual-edits')) {
    console.error(`\npublic/index.html ถูกแก้ด้วยมือหลัง build ครั้งก่อน จึงหยุดไว้ก่อนเพื่อไม่ให้ข้อความที่แก้หายไป\n` +
      `สำเนาหน้าที่แก้ไว้: data/index.manual-edits-${stamp}.html\n` +
      `ให้ย้ายข้อความที่แก้ไปไว้ใน client/ หรือ scripts/port-dashboard.mjs ก่อน แล้วค่อย build ใหม่\n` +
      `(ถ้าต้องการทับจริงๆ: node scripts/port-dashboard.mjs --overwrite-manual-edits)\n`);
    process.exit(1);
  }
}
await writeFile(indexFile, html);
await writeFile(generatedCopy, html);

// `--data <file.json.gz>` (or UFUND_REVIEWED_DATA) publishes a freshly built payload; without it the
// existing data/dashboard.json.gz is kept and only the page is rebuilt.
const dataArg = process.argv.indexOf('--data');
const reviewedData = dataArg > -1 ? process.argv[dataArg + 1] : process.env.UFUND_REVIEWED_DATA;
let payload;
try {
  payload = JSON.parse(gunzipSync(await readFile(reviewedData || new URL('dashboard.json.gz', dataDir))));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  throw new Error('No dashboard data yet: run `npm run build:data` (needs data/contracts.db) first.');
}
const pending=JSON.parse(await readFile(new URL('pending-reviewed.json',dataDir),'utf8'));
payload.noContractHeaders=pending.headers;
payload.noContractRows=pending.rows;
payload.noContractAudit=pending.audit;
payload.quality = Object.fromEntries(payload.qualityRows.slice(1).map(row => [row[0], {value: row[1], note: row[2]}]));
// RM-level pending-bill counts, extracted from a downloaded copy of "ค้าง Bill Auto Fix" (Summary AM RM tab) —
// this workbook is not a live-synced source, so re-export/rebuild this file by hand when it needs refreshing.
payload.billingIssues = JSON.parse(await readFile(new URL('billing-issues.json', dataDir), 'utf8'));
// No links to the source Google Sheets are sent to the page: those sheets hold customer names / phone
// numbers, so dashboard viewers must not be able to open them directly (the link elements are hidden in
// client/source-links.css).
payload.sourceLinks = {};
await writeFile(new URL('dashboard.json.gz', dataDir), gzipSync(JSON.stringify(payload), {level: 9}));
console.log(JSON.stringify({htmlBytes: Buffer.byteLength(html), rows: payload.contractRows.length, refreshedAt: payload.refreshedAt}));
