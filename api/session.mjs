import {authorized, json, passwordOK, sessionCookie} from '../lib/auth.mjs';

export default async function handler(req, res) {
  if (req.method === 'GET') return json(res, 200, {authenticated: authorized(req)});
  if (req.method !== 'POST') return json(res, 405, {error: 'Method not allowed'});

  const origin = req.headers.origin;
  const host = req.headers.host || '';
  const localOrigin = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host) && origin === `http://${host}`;
  if (!origin || (origin !== `https://${host}` && !localOrigin)) return json(res, 403, {error: 'Origin denied'});

  try {
    let body = req.body;
    if (!body) {
      let raw = '';
      for await (const chunk of req) {
        raw += chunk;
        if (raw.length > 2048) return json(res, 413, {error: 'Request too large'});
      }
      body = JSON.parse(raw);
    }
    if (typeof body === 'string') body = JSON.parse(body);
    if (!passwordOK(body.password)) {
      await new Promise(resolve => setTimeout(resolve, 800));
      return json(res, 401, {error: 'รหัสผ่านไม่ถูกต้อง'});
    }
    res.setHeader('Set-Cookie', sessionCookie());
    return json(res, 200, {ok: true});
  } catch {
    return json(res, 400, {error: 'Invalid request'});
  }
}
