// One-command deploy to Cloudflare Pages: creates the project + KV namespace on first run, uploads the
// dashboard data to KV, sets the login secrets once, then deploys public/ + functions/.
import {spawnSync} from 'node:child_process';
import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import {createInterface} from 'node:readline/promises';
import {fileURLToPath} from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PROJECT = process.env.CLOUDFLARE_PROJECT || 'executive-dashboard';
const TOML = `${ROOT}wrangler.toml`;
const STATE = `${ROOT}.cloudflare-deploy.json`;
const DATA = 'data/dashboard.json.gz';

function wrangler(args, {input, allowFail = false, quiet = false} = {}) {
  const result = spawnSync('wrangler', args, {cwd: ROOT, shell: true, encoding: 'utf8', input, maxBuffer: 64 * 1024 * 1024});
  const out = `${result.stdout || ''}${result.stderr || ''}`;
  if (!quiet) process.stdout.write(out);
  if (result.status !== 0 && !allowFail) {
    console.error(`\n✖ คำสั่ง "wrangler ${args.join(' ')}" ล้มเหลว`);
    process.exit(1);
  }
  return {ok: result.status === 0, out};
}

const state = existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')) : {};
const save = () => writeFileSync(STATE, JSON.stringify(state, null, 2));

console.log('1/5 ตรวจสอบการ login Cloudflare');
const who = wrangler(['whoami'], {allowFail: true, quiet: true});
if (!who.ok || /not authenticated|You are not/i.test(who.out)) {
  console.error('ยังไม่ได้ login — รัน "wrangler login" ก่อน แล้วรันคำสั่งนี้ใหม่');
  process.exit(1);
}

console.log('2/5 เตรียมที่เก็บข้อมูล (KV)');
let toml = readFileSync(TOML, 'utf8');
let kvId = toml.match(/^id = "([0-9a-f]{32})"/m)?.[1];
if (!kvId) {
  const created = wrangler(['kv', 'namespace', 'create', 'UFUND_DATA'], {allowFail: true});
  kvId = created.out.match(/id\s*[=:]\s*"([0-9a-f]{32})"/)?.[1];
  if (!kvId) {
    const listed = wrangler(['kv', 'namespace', 'list'], {quiet: true}).out;
    const json = listed.slice(listed.indexOf('['));
    kvId = JSON.parse(json).find(ns => /UFUND_DATA/.test(ns.title))?.id;
  }
  if (!kvId) {
    console.error('หา KV namespace ไม่เจอ');
    process.exit(1);
  }
  toml = toml.replace(/^id = ".*"$/m, `id = "${kvId}"`);
  writeFileSync(TOML, toml);
}

console.log('3/5 สร้างโปรเจกต์ (ถ้ายังไม่มี)');
if (!state.projectCreated) {
  const made = wrangler(['pages', 'project', 'create', PROJECT, '--production-branch', 'main'], {allowFail: true});
  if (!made.ok && !/already exists|already been taken|8000002/i.test(made.out)) process.exit(1);
  state.projectCreated = true;
  save();
}

console.log('4/5 อัปโหลดข้อมูล Dashboard');
wrangler(['kv', 'key', 'put', 'dashboard.json.gz', `--namespace-id=${kvId}`, `--path=${DATA}`, '--remote']);

if (!state.secretsSet || process.argv.includes('--set-password')) {
  const rl = createInterface({input: process.stdin, output: process.stdout});
  let password = process.env.DASHBOARD_PASSWORD || '';
  while (password.length < 8) password = (await rl.question('ตั้งรหัสผ่านเข้า Dashboard (อย่างน้อย 8 ตัว): ')).trim();
  rl.close();
  wrangler(['pages', 'secret', 'put', 'DASHBOARD_PASSWORD', '--project-name', PROJECT], {input: password});
  wrangler(['pages', 'secret', 'put', 'SESSION_SECRET', '--project-name', PROJECT], {input: randomBytes(32).toString('hex')});
  state.secretsSet = true;
  save();
}

console.log('5/5 Deploy');
wrangler(['pages', 'deploy', 'public', '--project-name', PROJECT, '--branch', 'main', '--commit-dirty=true']);
console.log(`\n✓ เสร็จแล้ว ลิงก์หลัก: https://${PROJECT}.pages.dev (ถ้าชื่อซ้ำ Cloudflare จะแสดงลิงก์จริงด้านบน)`);
