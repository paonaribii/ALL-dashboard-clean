// Reads Google Sheets through the Sheets API with a service account, so the source sheets can stay
// restricted ("Restricted" sharing) instead of "anyone with the link". Share each sheet with the service
// account's client_email as Viewer. No extra dependency: the OAuth JWT is signed with node:crypto.
import {readFile} from 'node:fs/promises';
import {createSign} from 'node:crypto';

const SCOPE = 'https://www.googleapis.com/auth/spreadsheets.readonly';
let tokenPromise;

async function requestToken() {
  const file = process.env.GOOGLE_SERVICE_ACCOUNT_FILE;
  if (!file) throw new Error('GOOGLE_SERVICE_ACCOUNT_FILE is not set in .env');
  const key = JSON.parse(await readFile(file, 'utf8'));
  const aud = key.token_uri || 'https://oauth2.googleapis.com/token';
  const now = Math.floor(Date.now() / 1000);
  const part = obj => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const unsigned = `${part({alg: 'RS256', typ: 'JWT'})}.${part({iss: key.client_email, scope: SCOPE, aud, iat: now, exp: now + 3600})}`;
  const signature = createSign('RSA-SHA256').update(unsigned).sign(key.private_key, 'base64url');
  const res = await fetch(aud, {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body: new URLSearchParams({grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${signature}`})
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) throw new Error(`service account login failed (HTTP ${res.status} ${body.error || ''})`.trim());
  return body.access_token;
}

async function api(path) {
  tokenPromise ||= requestToken();
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${path}`, {headers: {Authorization: `Bearer ${await tokenPromise}`}});
  if (!res.ok) throw new Error(`Sheets API HTTP ${res.status}${res.status === 403 || res.status === 404 ? ' (is the sheet shared with the service account?)' : ''}`);
  return res.json();
}

// [{name, gid}] for every tab, in sheet order.
export async function listTabs(sheetId) {
  const meta = await api(`${encodeURIComponent(sheetId)}?fields=sheets.properties(title,sheetId)`);
  return (meta.sheets || []).map(s => ({name: s.properties.title, gid: String(s.properties.sheetId)}));
}

// All cells of one tab as displayed in the sheet (same text a CSV export gives), one array per row.
export async function readTab(sheetId, tabName) {
  const range = encodeURIComponent(`'${tabName.replace(/'/g, "''")}'`);
  const data = await api(`${encodeURIComponent(sheetId)}/values/${range}?valueRenderOption=FORMATTED_VALUE`);
  return data.values || [];
}
