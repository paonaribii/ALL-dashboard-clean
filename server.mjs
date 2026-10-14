import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {extname, join, normalize} from 'node:path';
import session from './api/session.mjs';
import dashboard from './api/dashboard.mjs';
import logout from './api/logout.mjs';

// Login settings come from .env (see .env.example); nothing secret is kept in the code.
if (!process.env.DASHBOARD_PASSWORD || !process.env.SESSION_SECRET) {
  console.error('Set DASHBOARD_PASSWORD and SESSION_SECRET in .env (copy .env.example) before npm start.');
  process.exit(1);
}

const mime = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.svg':'image/svg+xml'};
const routes = {'/api/session': session, '/api/dashboard': dashboard, '/api/logout': logout};

const server = createServer(async (req, res) => {
  req.headers.host ||= '127.0.0.1:4191';
  req.headers.origin ||= `https://${req.headers.host}`;
  if (routes[req.url]) return routes[req.url](req, res);
  const clean = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  const path = normalize(join(process.cwd(), 'public', clean));
  if (!path.startsWith(join(process.cwd(), 'public'))) { res.writeHead(403); return res.end('Forbidden'); }
  try {
    const body = await readFile(path);
    res.setHeader('Content-Type', mime[extname(path)] || 'application/octet-stream');
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(4191, '127.0.0.1', () => console.log('http://127.0.0.1:4191'));
