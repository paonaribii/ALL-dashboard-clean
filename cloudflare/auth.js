// Web Crypto port of lib/auth.mjs for Cloudflare Pages Functions (same cookie format and rules).
const COOKIE_NAME = 'ufund_session';
const SESSION_MS = 8 * 60 * 60 * 1000;
const encoder = new TextEncoder();

async function sha256(value) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(String(value))));
}

function equalBytes(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function sign(secret, value) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), {name: 'HMAC', hash: 'SHA-256'}, false, ['sign']);
  const bytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value)));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function configured(env) {
  return (env.DASHBOARD_PASSWORD || '').length >= 8 && (env.SESSION_SECRET || '').length >= 32;
}

export async function passwordOK(env, value) {
  return configured(env) && equalBytes(await sha256(value), await sha256(env.DASHBOARD_PASSWORD));
}

export async function sessionCookie(env) {
  const expiry = String(Date.now() + SESSION_MS);
  return `${COOKIE_NAME}=${expiry}.${await sign(env.SESSION_SECRET, expiry)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=28800`;
}

export function clearSessionCookie() {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}

export async function authorized(request, env) {
  if (!configured(env)) return false;
  const raw = (request.headers.get('Cookie') || '')
    .split(';')
    .map(value => value.trim())
    .find(value => value.startsWith(`${COOKIE_NAME}=`))
    ?.slice(COOKIE_NAME.length + 1);
  if (!raw) return false;
  const [expiry, signature] = raw.split('.');
  if (!/^\d{13}$/.test(expiry) || !signature) return false;
  if (+expiry <= Date.now() || +expiry > Date.now() + SESSION_MS + 10000) return false;
  return equalBytes(await sha256(signature), await sha256(await sign(env.SESSION_SECRET, expiry)));
}

export function json(status, data, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {'Cache-Control': 'private, no-store', 'Content-Type': 'application/json; charset=utf-8', ...extraHeaders}
  });
}
