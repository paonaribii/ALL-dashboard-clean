import {clearSessionCookie, json} from '../../cloudflare/auth.js';

export const onRequestPost = () => json(200, {ok: true}, {'Set-Cookie': clearSessionCookie()});

export const onRequest = () => json(405, {error: 'Method not allowed'});
