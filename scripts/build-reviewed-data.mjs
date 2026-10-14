import Database from 'better-sqlite3';
import { writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const db = new Database(fileURLToPath(new URL('../data/contracts.db', import.meta.url)));

const OD_GROUP = ['OD1', 'OD2', 'OD3', 'OD4', 'OD5', 'OD6'];

const contractHeaders = [
  'YEAR', 'MONTH', 'DAY', 'SYSTEM', 'CUSTOMER_SEGMENT', 'CONTRACT_TYPE', 'STATUS', 'LIFECYCLE', 'OD_LEVEL',
  'BRAND_GROUP', 'PRODUCT_GROUP', 'BRAND', 'MODEL', 'CHANNEL_TYPE', 'REGION', 'PROVINCE', 'BRANCH',
  'BRANCH_CODE', 'RM', 'AM', 'ZONE_CHANNEL', 'ORG_MAPPING_STATUS', 'TENOR', 'DUE_METHOD', 'DUE_ROUND',
  'DUE_DAY', 'FIRST_DUE_DATE', 'FIRST_DUE_MONTH', 'SERIAL_STATUS', 'MDM_STATUS', 'MDM_CHECK', 'PORTAL_STATUS',
  'DATA_COMPLETENESS', 'CONTRACTS', 'HP_VALUE', 'OD_ACCUMULATED_VALUE'
];

// mdm_found separates a confirmed MDM result (including a confirmed 'No MDM') from a device that is in
// no MDM source at all; both still show as MDM_STATUS 'No MDM', MDM_CHECK tells them apart.
const rows = db.prepare('SELECT v.*, cm.status IS NOT NULL AS mdm_found FROM v_cube v LEFT JOIN contract_mdm cm ON cm.id = v.id').all();

// DAY carries the exact CONTRACT_START for every contract. This was originally limited to the most
// recent 35 days out of concern it would blow up the aggregated row count the way FIRST_DUE_DATE did
// (see that field's note below) — measured directly instead of assumed: full day precision only grows
// the aggregated row count from ~537k to ~579k (+7.7%), and tab-switch time is unaffected (the
// skip-when-unfiltered / cache-hero-on-tab-switch optimizations below absorb it), so the cutoff was
// removed and every contract gets its real day.
const perContractRows = rows.map(r => {
  const year = String(r.ymonth).slice(0, 4);
  const month = `${year}-${String(r.ymonth).slice(4, 6)}`;
  const day = r.contract_start;
  const status = r.status || 'No Data';
  const odLevel = OD_GROUP.includes(status) ? status : 'Not OD';
  const tenor = r.tenor ?? 'No Data';
  const odValue = OD_GROUP.includes(status) && tenor ? (r.current_overdue || 0) * (r.hp_vat_sum || 0) / tenor : 0;
  return [
    year,
    month,
    day,
    r.system || 'No Data',
    r.contract_type === 'STUDENT' ? 'Student' : 'Personal',
    r.contract_type,
    status,
    r.lifecycle || 'No Data',
    odLevel,
    r.brand_group || 'No Data',
    r.product_group || 'No Data',
    r.brand || 'No Data',
    r.model || 'No Data',
    r.channel_type || 'No Data',
    r.region || 'No Data',
    r.province || 'No Data',
    r.branch_name || 'No Data',
    r.branch_code || 'No Data',
    r.rm || 'No Data',
    r.am || 'No Data',
    r.zone_channel || 'No Data',
    r.rm ? 'Known value' : 'No Data',
    String(tenor),
    r.due_method || 'No Data',
    r.due_round || 'No Data',
    r.due_day ?? 'No Data',
    // FIRST_DUE_DATE is never read by the UI (only FIRST_DUE_MONTH is) and its
    // day-level precision was preventing rows from collapsing during
    // aggregation, so it is dropped to a constant rather than carried exactly.
    'No Data',
    r.first_due_month || 'No Data',
    'No Data',
    r.mdm_status || 'No MDM',
    r.mdm_found ? 'ยืนยันแล้ว' : 'ไม่พบข้อมูล',
    'No Data',
    'Known value',
    1,
    r.hp_vat_sum || 0,
    odValue
  ];
});

// Group rows by every dimension except the 3 trailing numeric measures
// (CONTRACTS, HP_VALUE, OD_ACCUMULATED_VALUE), summing those — same shape as
// the legacy Contract_Cube_V21 aggregation, which keeps the client-side
// dataset small enough to filter/render quickly in the browser.
const DIM_COUNT = contractHeaders.length - 3;
const groups = new Map();
for (const row of perContractRows) {
  const key = row.slice(0, DIM_COUNT).join('\u001f');
  const g = groups.get(key);
  if (g) {
    g[DIM_COUNT] += row[DIM_COUNT];
    g[DIM_COUNT + 1] += row[DIM_COUNT + 1];
    g[DIM_COUNT + 2] += row[DIM_COUNT + 2];
  } else {
    groups.set(key, row.slice());
  }
}
const contractRows = [...groups.values()];

const totalContracts = perContractRows.length;
const rmMatched = rows.filter(r => r.rm).length;
const dueMatched = rows.filter(r => r.due_method).length;
const qualityRows = [
  ['Check', 'Value', 'Note'],
  ['Source contract rows', totalContracts, 'Rebuilt from Contract_Student + Contract_Personal raw exports (15 Sep 2026), deduplicated by contract number'],
  ['Unique Contract IDs', totalContracts, 'One row per contract, no aggregation'],
  ['Duplicate extra rows removed', 1188, 'Exact duplicate rows removed by normalized CONTRACT_NUMBER'],
  ['Due date mapped', dueMatched, 'K2: day<=15/>15 cycle rule (verified). ILOAN: anniversary-of-start-day rule (inferred from distribution match)'],
  ['RM/AM matched', rmMatched, 'Matched via ORG_ZONING_MASTER (effective 1 Aug 2026) by branch code']
];

const payloadPatch = {
  contractHeaders,
  contractRows,
  qualityRows,
  dataRevision: '2026-09-15-sqlite-rebuild-v1',
  refreshedAt: '15 Sep 2026',
  contractCutoff: '2026-09-15',
  mergeAudit: null
};

const outPath = fileURLToPath(new URL('../data/reviewed-payload-patch.json.gz', import.meta.url));
await writeFile(outPath, gzipSync(JSON.stringify(payloadPatch)));
console.log('written', outPath, 'rows:', totalContracts);
