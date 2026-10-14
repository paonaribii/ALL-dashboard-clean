import {createHash, createHmac, timingSafeEqual} from 'node:crypto';

const COOKIE_NAME = 'ufund_session';
const SESSION_MS = 8 * 60 * 60 * 1000;
const digest = value => createHash('sha256').update(String(value)).digest();
const sign = value => createHmac('sha256', process.env.SESSION_SECRET).update(value).digest('base64url');

export function configured() {
  return (process.env.DASHBOARD_PASSWORD || '').length >= 8 &&
    (process.env.SESSION_SECRET || '').length >= 32;
}

export function passwordOK(value) {
  return configured() && timingSafeEqual(digest(value), digest(process.env.DASHBOARD_PASSWORD));
}

export function sessionCookie() {
  const expiry = String(Date.now() + SESSION_MS);
  return `${COOKIE_NAME}=${expiry}.${sign(expiry)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=28800`;
}

export function clearSessionCookie() {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}

export function authorized(req) {
  if (!configured()) return false;
  const raw = (req.headers.cookie || '')
    .split(';')
    .map(value => value.trim())
    .find(value => value.startsWith(`${COOKIE_NAME}=`))
    ?.slice(COOKIE_NAME.length + 1);
  if (!raw) return false;
  const [expiry, signature] = raw.split('.');
  if (!/^\d{13}$/.test(expiry) || !signature) return false;
  if (+expiry <= Date.now() || +expiry > Date.now() + SESSION_MS + 10000) return false;
  return timingSafeEqual(digest(signature), digest(sign(expiry)));
}

export function json(res, status, data) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.statusCode = status;
  res.end(JSON.stringify(data));
}
