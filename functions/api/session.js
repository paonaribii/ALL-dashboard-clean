import {authorized, json, passwordOK, sessionCookie} from '../../cloudflare/auth.js';

export async function onRequestGet({request, env}) {
  return json(200, {authenticated: await authorized(request, env)});
}

export async function onRequestPost({request, env}) {
  const origin = request.headers.get('Origin');
  if (!origin || origin !== new URL(request.url).origin) return json(403, {error: 'Origin denied'});
  try {
    const raw = await request.text();
    if (raw.length > 2048) return json(413, {error: 'Request too large'});
    const body = JSON.parse(raw);
    if (!(await passwordOK(env, body.password))) {
      await new Promise(resolve => setTimeout(resolve, 800));
      return json(401, {error: 'รหัสผ่านไม่ถูกต้อง'});
    }
    return json(200, {ok: true}, {'Set-Cookie': await sessionCookie(env)});
  } catch {
    return json(400, {error: 'Invalid request'});
  }
}

export const onRequest = () => json(405, {error: 'Method not allowed'});
