import {clearSessionCookie, json} from '../lib/auth.mjs';

export default function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, {error: 'Method not allowed'});
  res.setHeader('Set-Cookie', clearSessionCookie());
  return json(res, 200, {ok: true});
}
