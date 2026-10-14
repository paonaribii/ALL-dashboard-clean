// Refreshes data/pending-reviewed.json ("รายการที่ยังไม่มีสัญญา") from the live Google Sheet
// "อนุมัติแล้วแล้วยังไม่เกิดสัญญา สาขาติดตามเปิดสัญญาให้จบ". Each stage has its own tab; tabs are found by
// name (so reordering or renumbering them is fine) and the Zone tab supplies branch names.
// Customer names / phone numbers in the sheet are never written out.
// Read through the Sheets API with the service account (scripts/google-sheets.mjs), so the sheet can stay restricted.
// If the download fails (offline, sheet not shared with the service account) the existing file is kept so the build still works.
import {writeFile} from 'node:fs/promises';
import {listTabs, readTab} from './google-sheets.mjs';

// Sheet id comes from .env (SHEET_PENDING_ID); it is not kept in the repo.
const SHEET_ID = process.env.SHEET_PENDING_ID;
const out = new URL('../data/pending-reviewed.json', import.meta.url);
// Tab name keyword -> [stage, reason]. Order matters: "แนบท้าย" must be checked before "รีวิวสัญญา".
const STAGE_TABS = [
  ['ลงทะเบียน', 'PENDING_REGISTRATION', 'รอลงทะเบียนสินค้า'],
  ['MDM', 'MDM', 'รอดำเนินการ MDM'],
  ['แนบท้าย', 'Contract Review', 'ลูกค้ารีวิวสัญญาแนบท้าย'],
  ['รีวิวสัญญา', 'Contract Review', 'ลูกค้ารีวิวสัญญา'],
  ['Asset', 'Asset Deliver', 'Asset Deliver']
];
const BRANDS = [['IPHONE', 'Apple'], ['IPAD', 'Apple'], ['MACBOOK', 'Apple'], ['APPLE', 'Apple'], ['OPPO', 'OPPO'],
  ['VIVO', 'Vivo'], ['XIAOMI', 'Xiaomi'], ['REDMI', 'Xiaomi'], ['HONOR', 'Honor'], ['TECNO', 'TECNO'], ['REALME', 'Realme'],
  ['SAMSUNG', 'Samsung'], ['GALAXY', 'Samsung'], ['HUAWEI', 'Huawei'], ['ASUS', 'ASUS'], ['HP', 'HP'], ['LENOVO', 'LENOVO'],
  ['INFINIX', 'Infinix'], ['ZTE', 'ZTE'], ['NOTHING', 'NOTHING'], ['IQOO', 'iQOO']];
const UNKNOWN = 'ไม่ระบุ';

const brandOf = model => BRANDS.find(([kw]) => String(model || '').toUpperCase().includes(kw))?.[1] || UNKNOWN;
const brandGroupOf = brand => brand === 'Apple' ? 'Apple' : ['ASUS', 'HP', 'LENOVO'].includes(brand) ? 'Notebook' : brand === UNKNOWN ? UNKNOWN : 'Smartphone';

try {
  if (!SHEET_ID) throw new Error('SHEET_PENDING_ID is not set in .env');
  const tabs = await listTabs(SHEET_ID);
  if (!tabs.length) throw new Error('could not list the sheet tabs');

  const zoneTab = tabs.find(t => t.name.trim().toLowerCase() === 'zone');
  const branchName = new Map();
  if (zoneTab) for (const r of (await readTab(SHEET_ID, zoneTab.name)).slice(1)) if (r[0]?.trim()) branchName.set(r[0].trim(), r[1]?.trim());

  const groups = new Map(), seen = new Set(), stageInfo = new Map(), skipped = [];
  for (const tab of tabs) {
    const spec = STAGE_TABS.find(([kw]) => tab.name.includes(kw));
    if (!spec || /ยกเลิก|สรุป|data/i.test(tab.name)) continue;
    const [, stage, reason] = spec;
    const info = stageInfo.get(stage) || {stage, gid: tab.gid, count: 0, months: []};
    stageInfo.set(stage, info);
    for (const r of await readTab(SHEET_ID, tab.name)) {
      const app = String(r[2] || '').trim();
      if (!app || app === 'เลขที่ใบคำขอ') continue;
      const m = String(r[5] || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (!m) { skipped.push(`${tab.name}: ${app} (no date)`); continue; }
      if (seen.has(app)) { skipped.push(`${tab.name}: ${app} (duplicate)`); continue; }
      seen.add(app);
      const year = +m[3] > 2400 ? +m[3] - 543 : +m[3], month = `${year}-${m[2].padStart(2, '0')}`, created = `${month}-${m[1].padStart(2, '0')}`;
      const code = String(r[4] || '').trim(), name = branchName.get(code);
      const branch = name ? (/^ID\d/i.test(name) ? name : `ID${code} : ${name}`) : code ? `ID${code}` : UNKNOWN;
      const model = String(r[6] || '').trim() || UNKNOWN, brand = brandOf(model);
      const row = [String(year), month, stage, reason, brandGroupOf(brand), brand, model, 'ไม่ระบุผล MDM', 0, null, branch,
        String(r[11] || '').trim() || UNKNOWN, String(r[12] || '').trim() || UNKNOWN, 'บุคคลทั่วไป', created];
      const key = JSON.stringify(row);
      if (!groups.has(key)) groups.set(key, row);
      groups.get(key)[8]++;
      info.count++; info.months.push(month);
    }
  }
  if (!seen.size) throw new Error('no applications found in any stage tab');

  const months = [...stageInfo.values()].flatMap(s => s.months).sort();
  const now = new Date(), pad = n => String(n).padStart(2, '0');
  const audit = {
    readDate: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`,
    uniqueApplications: seen.size,
    dateMin: months[0], dateMax: months.at(-1),
    stages: [...stageInfo.values()].map(({months: m, ...s}) => ({...s, dateMin: m.sort()[0] || null, dateMax: m.at(-1) || null})),
    method: 'Fetched live from the Google Sheet stage tabs (scripts/fetch-pending.mjs), counted by unique application number; the "ยกเลิก" tab is excluded.'
  };
  const headers = ['YEAR', 'MONTH', 'STAGE', 'REASON', 'BRAND_GROUP', 'BRAND', 'MODEL', 'MDM_STATUS', 'RECORDS', 'DEBT_VALUE', 'BRANCH', 'RM', 'AM', 'CUSTOMER_TYPE', 'CREATED'];
  await writeFile(out, JSON.stringify({headers, rows: [...groups.values()], audit}));
  console.log(`pending: ${seen.size} applications (${audit.stages.map(s => `${s.stage} ${s.count}`).join(', ')})`);
  if (skipped.length) console.log(`pending: skipped ${skipped.length} rows: ${skipped.slice(0, 5).join('; ')}${skipped.length > 5 ? ' …' : ''}`);
} catch (error) {
  console.warn(`pending: could not refresh from the sheet (${error.message}); keeping the existing data/pending-reviewed.json`);
}
