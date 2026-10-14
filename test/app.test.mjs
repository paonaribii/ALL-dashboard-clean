import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';

test('ported dashboard has no Apps Script runtime dependency', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  assert.equal(html.includes('google.script.run'), false);
  for (const id of ['heroCards','dashboardTabs','filterPanel','rmSummaryStatusTable','amSummaryStatusTable','mdmDimensionStatusTable']) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
});

test('SQLite-rebuilt dataset (15 Sep 2026) carries 601,056 contracts with sane cutoff and RM coverage', async () => {
  const compressed = await readFile(new URL('../data/dashboard.json.gz', import.meta.url));
  const payload = JSON.parse(gunzipSync(compressed));
  const contractsIndex = payload.contractHeaders.indexOf('CONTRACTS');
  assert.equal(payload.contractRows.reduce((sum, row) => sum + Number(row[contractsIndex] || 0), 0), 601056);
  assert.equal(payload.contractCutoff, '2026-09-15');
  assert.equal(payload.dataRevision, '2026-09-15-sqlite-rebuild-v1');
  const month=payload.contractHeaders.indexOf('MONTH');
  assert.ok(payload.contractRows.every(r=>r[month]<='2026-09'));
  const rmIndex = payload.contractHeaders.indexOf('RM');
  const rmMapped = payload.contractRows.filter(r=>r[rmIndex]!=='No Data').length;
  assert.ok(rmMapped / payload.contractRows.length > 0.9, `expected >90% RM coverage, got ${(rmMapped/payload.contractRows.length*100).toFixed(1)}%`);
  assert.ok(payload.noContractRows.length > 0);
  assert.ok(payload.noContractHeaders.includes('STAGE'));
});
