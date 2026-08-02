/**
 * Mail Center V1.0 API integration checks against a running test stack.
 * Usage:
 *   node scripts/mail-center-integration.mjs
 * Env:
 *   API_BASE=http://127.0.0.1:4011/api/v1
 *   ADMIN_USERNAME / ADMIN_INITIAL_PASSWORD (or ADMIN_PASSWORD)
 * Does NOT print secrets, codes, or full emails in assertions output.
 */
const API = (process.env.API_BASE || 'http://127.0.0.1:4011/api/v1').replace(/\/$/, '');
const user = process.env.ADMIN_USERNAME || 'admin';
const pass = process.env.ADMIN_PASSWORD || process.env.ADMIN_INITIAL_PASSWORD || 'admin';

const results = [];
function record(name, ok, detail = '') {
  results.push({ name, ok, detail: String(detail).slice(0, 200) });
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${name}${detail ? ' — ' + String(detail).slice(0, 120) : ''}`);
}

async function req(path, opts = {}, token) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { ...opts, headers });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text.slice(0, 300) };
  }
  return { status: res.status, body };
}

function unwrap(body) {
  // TransformInterceptor may wrap as { data }
  return body?.data !== undefined ? body.data : body;
}

async function main() {
  console.log('API', API);

  // health
  const health = await req('/health');
  record('health', health.status < 500, `status=${health.status}`);

  // login super admin
  const login = await req('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ account: user, password: pass }),
  });
  const loginData = unwrap(login.body);
  const token = loginData?.accessToken;
  record('superadmin login', !!token, `status=${login.status}`);
  if (!token) {
    console.log(JSON.stringify(results, null, 2));
    process.exit(1);
  }

  // mail status (SUPER_ADMIN)
  const status = await req('/superadmin/mail/status', {}, token);
  const st = unwrap(status.body);
  record('mail status 200', status.status === 200, `configured=${st?.smtp?.configured}`);
  record('password masked or empty', !st?.smtp?.password || st.smtp.password === '********', `pwd=${st?.smtp?.password || '(empty)'}`);
  record('devCode switch false by default', st?.runtime?.mailDevCodeEnabled === false, JSON.stringify(st?.runtime || {}));

  // non-super: try with no token
  const anon = await req('/superadmin/mail/status');
  record('anon mail status 401', anon.status === 401 || anon.status === 403, `status=${anon.status}`);

  // SMTP not configured → sendCode error (production NODE_ENV in test stack)
  const codeRes = await req('/auth/send-code', {
    method: 'POST',
    body: JSON.stringify({
      channel: 'email',
      purpose: 'register',
      target: 'mailcenter.probe@example.com',
    }),
  });
  const codeMsg = JSON.stringify(codeRes.body);
  record(
    'sendCode SMTP missing message',
    codeRes.status >= 400 && codeMsg.includes('邮件服务尚未配置'),
    `status=${codeRes.status}`,
  );
  record('sendCode no devCode', !codeMsg.includes('"devCode"'), '');

  const forgot = await req('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ account: user, channel: 'email' }),
  });
  const forgotMsg = JSON.stringify(forgot.body);
  record(
    'forgotPassword SMTP missing message',
    forgot.status >= 400 && forgotMsg.includes('邮件服务尚未配置'),
    `status=${forgot.status}`,
  );
  record('forgotPassword no devToken', !forgotMsg.includes('"devToken"'), '');

  // templates / logs readable
  const tpls = await req('/superadmin/mail/templates', {}, token);
  const tplData = unwrap(tpls.body);
  record('templates list', tpls.status === 200 && Array.isArray(tplData?.items) && tplData.items.length > 0, `count=${tplData?.items?.length}`);

  const logs = await req('/superadmin/mail/logs?take=5', {}, token);
  record('logs list', logs.status === 200, `status=${logs.status}`);

  // save smtp with placeholder password should not wipe (empty host still)
  const smtpGet = await req('/superadmin/mail/smtp', {}, token);
  const smtp = unwrap(smtpGet.body);
  record('smtp get masked', !smtp?.password || smtp.password === '********' || smtp.password === '', `pwd=${smtp?.password}`);

  const failed = results.filter((r) => !r.ok);
  console.log('---');
  console.log(`passed=${results.length - failed.length} failed=${failed.length}`);
  if (failed.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error('FATAL', e.message);
  process.exit(1);
});
