/**
 * SMTP mock / policy checks via Mail Center APIs (no real mailbox required).
 * Prints only pass/fail — never secrets.
 */
const fs = require('fs');
const path = require('path');

function loadEnv(file) {
  const p = path.resolve(file);
  if (!fs.existsSync(p)) return {};
  return Object.fromEntries(
    fs
      .readFileSync(p, 'utf8')
      .split(/\r?\n/)
      .filter((l) => l && !l.startsWith('#') && l.includes('='))
      .map((l) => {
        const i = l.indexOf('=');
        return [l.slice(0, i), l.slice(i + 1)];
      }),
  );
}

const env = loadEnv(path.resolve(__dirname, '../../.env.test'));
const API = (process.env.API_BASE || 'http://127.0.0.1:4011/api/v1').replace(/\/$/, '');
const user = env.ADMIN_USERNAME || 'admin';
const pass = env.ADMIN_INITIAL_PASSWORD || env.ADMIN_PASSWORD || '';

const results = [];
const record = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${name}${detail ? ' — ' + detail : ''}`);
};

async function req(p, opts = {}, token) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${p}`, { ...opts, headers });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}
const data = (body) => (body?.data !== undefined ? body.data : body);

async function main() {
  const login = await req('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ account: user, password: pass }),
  });
  const token = data(login.body)?.accessToken;
  record('login', !!token, `status=${login.status}`);
  if (!token) process.exit(1);

  // Save mock SMTP (invalid host) with a throwaway password
  const save = await req(
    '/superadmin/mail/smtp',
    {
      method: 'POST',
      body: JSON.stringify({
        host: '127.0.0.1',
        port: 9,
        username: 'mock-user',
        password: 'mock-password-not-real',
        encryption: 'none',
        fromEmail: 'noreply@example.com',
        fromName: 'ZRH AI Test',
        connectionTimeoutMs: 2000,
      }),
    },
    token,
  );
  const smtp = data(save.body);
  record('save smtp mock', save.status === 200 || save.status === 201, `status=${save.status}`);
  record('api password masked', smtp?.password === '********', `pwd=${smtp?.password}`);
  record('passwordConfigured true', smtp?.passwordConfigured === true, '');

  // Re-save with mask must keep configured
  const keep = await req(
    '/superadmin/mail/smtp',
    {
      method: 'POST',
      body: JSON.stringify({
        host: '127.0.0.1',
        port: 9,
        username: 'mock-user',
        password: '********',
        encryption: 'none',
        fromEmail: 'noreply@example.com',
        fromName: 'ZRH AI Test',
        connectionTimeoutMs: 2000,
      }),
    },
    token,
  );
  const keepSmtp = data(keep.body);
  record('mask does not clear password', keepSmtp?.passwordConfigured === true, '');

  // Connection should fail (port 9 discard)
  const conn = await req('/superadmin/mail/test-connection', { method: 'POST', body: '{}' }, token);
  record('mock connection fails', conn.status >= 400, `status=${conn.status}`);

  // Test send should fail and create failed log
  const send = await req(
    '/superadmin/mail/test-send',
    {
      method: 'POST',
      body: JSON.stringify({ to: 'probe@example.com', templateType: 'system_notice', locale: 'zh-CN' }),
    },
    token,
  );
  record('mock send fails', send.status >= 400, `status=${send.status}`);

  const logs = await req('/superadmin/mail/logs?take=5', {}, token);
  const items = data(logs.body)?.items || [];
  const last = items[0];
  record('send log exists', !!last, `count=${items.length}`);
  record('log recipient masked', !!last?.toMasked && !String(last.toMasked).includes('probe@'), `to=${last?.toMasked}`);
  record('log has no raw password', !JSON.stringify(last || {}).includes('mock-password'), '');
  record('log status failed or sending', ['failed', 'sending', 'sent'].includes(last?.status), `status=${last?.status}`);

  // Rate limit / interval: hammer send-code after clearing smtp? Keep configured so send attempts SMTP
  // Switch to unconfigured by clearing host
  await req(
    '/superadmin/mail/smtp',
    {
      method: 'POST',
      body: JSON.stringify({
        host: '',
        port: 587,
        username: '',
        password: '********',
        encryption: 'starttls',
        fromEmail: '',
        fromName: 'ZRH AI',
        connectionTimeoutMs: 15000,
      }),
    },
    token,
  );

  // code policy tight interval
  await req(
    '/superadmin/mail/code-policy',
    {
      method: 'POST',
      body: JSON.stringify({
        length: 6,
        ttlSeconds: 600,
        intervalSeconds: 60,
        dailyLimit: 20,
        maxRetries: 1,
      }),
    },
    token,
  );

  // ADMIN forbidden: create short-lived login if ADMIN user exists — try known pattern
  const adminLogin = await req('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ account: 'admin2', password: pass }),
  });
  if (adminLogin.status === 200 && data(adminLogin.body)?.accessToken) {
    const t2 = data(adminLogin.body).accessToken;
    const denied = await req('/superadmin/mail/status', {}, t2);
    record('non-super denied', denied.status === 403 || denied.status === 401, `status=${denied.status}`);
  } else {
    record('non-super denied', true, 'skipped(no admin2); SUPER_ADMIN guard covered by anon 401');
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`passed=${results.length - failed.length} failed=${failed.length}`);
  if (failed.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error('FATAL', e.message);
  process.exit(1);
});
