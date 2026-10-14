// Refreshes data/billing-issues.json from the live "ค้าง Bill Auto Fix" sheet (first tab, gid=0): one row
// per wrong bill still waiting to be fixed; fixed bills drop off the sheet. Only per RM/AM counts are kept —
// customer names and phone numbers in the sheet are never written out.
// If the download fails (offline, sheet unshared) the existing file is kept so the build still works.
import {writeFile} from 'node:fs/promises';

// Sheet id comes from .env (SHEET_BILLING_ID); it is not kept in the repo.
const SHEET_ID = process.env.SHEET_BILLING_ID;
const GID = '0';
const out = new URL('../data/billing-issues.json', import.meta.url);

function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

try {
  if (!SHEET_ID) throw new Error('SHEET_BILLING_ID is not set in .env');
  const res = await fetch(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}`);
  if (!res.ok || !String(res.headers.get('content-type')).includes('text/csv')) throw new Error(`HTTP ${res.status}`);
  const rows = parseCsv(await res.text());
  const headerAt = rows.findIndex(r => r.includes('RM') && r.includes('AM') && r.includes('Contract Number'));
  if (headerAt < 0) throw new Error('header row (RM / AM / Contract Number) not found');
  const h = rows[headerAt], col = name => h.indexOf(name);
  const [phy, rmCol, amCol] = [col('Phy'), col('RM'), col('AM')];
  const counts = new Map(), rmTotals = {};
  let total = 0;
  for (const r of rows.slice(headerAt + 1)) {
    if (!String(r[phy] || '').trim()) continue;
    const rm = String(r[rmCol] || '').trim() || 'ไม่ระบุ', am = String(r[amCol] || '').trim() || 'ไม่ระบุ';
    const key = rm + '\u001f' + am;
    counts.set(key, (counts.get(key) || 0) + 1);
    rmTotals[rm] = (rmTotals[rm] || 0) + 1;
    total++;
  }
  const now = new Date(), pad = n => String(n).padStart(2, '0');
  const asOf = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const detail = [...counts].map(([k, n]) => { const [rm, am] = k.split('\u001f'); return {rm, am, total: n}; })
    .sort((a, b) => b.total - a.total);
  await writeFile(out, JSON.stringify({
    source: `ค้าง Bill Auto Fix (Google Sheet, gid=${GID}) - บิลที่ยังค้างแก้ไข`,
    asOf, grandTotal: total, rmTotals, detail
  }, null, 1));
  console.log(`billing: ${total} outstanding bills, ${detail.length} AMs (as of ${asOf})`);
} catch (error) {
  console.warn(`billing: could not refresh from the sheet (${error.message}); keeping the existing data/billing-issues.json`);
}
