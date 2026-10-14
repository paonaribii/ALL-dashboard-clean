import {authorized, json} from '../../cloudflare/auth.js';

// The gzipped payload lives in KV (not in public/), so it is only reachable after login. It is
// streamed through as-is — never decompressed here — to stay well inside the Workers CPU budget.
export async function onRequestGet({request, env}) {
  if (!(await authorized(request, env))) return json(401, {error: 'SESSION_EXPIRED'});
  const body = await env.UFUND_DATA.get('dashboard.json.gz', {type: 'stream'});
  if (!body) return json(500, {error: 'เปิดข้อมูล Dashboard ไม่สำเร็จ'});
  return new Response(body, {
    status: 200,
    encodeBody: 'manual',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Encoding': 'gzip',
      'Cache-Control': 'private, no-store'
    }
  });
}

export const onRequest = () => json(405, {error: 'Method not allowed'});
