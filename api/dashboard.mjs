import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {gunzipSync} from 'node:zlib';
import {authorized, json} from '../lib/auth.mjs';

async function livePayload() {
  if (!process.env.APPS_SCRIPT_DATA_URL || !process.env.APPS_SCRIPT_DATA_PASSWORD) return null;
  const response = await fetch(process.env.APPS_SCRIPT_DATA_URL, {
    method: 'POST',
    redirect: 'follow',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({action: 'getDashboardPayload', password: process.env.APPS_SCRIPT_DATA_PASSWORD}),
    signal: AbortSignal.timeout(25000)
  });
  if (!response.ok) return null;
  const result = await response.json();
  if (!result?.ok || result.packet?.encoding !== 'gzip+base64' || !result.packet.data) return null;
  return Buffer.from(result.packet.data, 'base64');
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, {error: 'Method not allowed'});
  if (!authorized(req)) return json(res, 401, {error: 'SESSION_EXPIRED'});
  try {
    const snapshot = await readFile(join(process.cwd(), 'data', 'dashboard.json.gz'));
    const reviewed = JSON.parse(gunzipSync(snapshot));
    let payload = null;
    // A reviewed full-history merge must never revert to the older Sheets snapshot.
    // Future refreshes publish a newly reconciled revision through this same dataset.
    if (req.headers['x-ufund-live'] === '1' && !reviewed.dataRevision) {
      try { payload = await livePayload(); } catch {}
    }
    if (!payload) payload = snapshot;
    res.setHeader('X-Ufund-Data-Revision', reviewed.dataRevision || 'legacy');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Encoding', 'gzip');
    res.statusCode = 200;
    res.end(payload);
  } catch (error) {
    return json(res, 500, {error: 'เปิดข้อมูล Dashboard ไม่สำเร็จ'});
  }
}
