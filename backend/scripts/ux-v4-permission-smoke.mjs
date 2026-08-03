/**
 * UX V4.0 权限冒烟测试 —— 验证用户端与企业端彻底分离。
 * 前提：测试栈已启动（docker-compose.test.yml，API :4011），
 * 且已应用迁移 20260803120000_ux_v4_user_permission_revoke。
 *
 * Usage: node scripts/ux-v4-permission-smoke.mjs
 * Env:   API_BASE=http://127.0.0.1:4011/api/v1
 *        ADMIN_USERNAME / ADMIN_PASSWORD（或 ADMIN_INITIAL_PASSWORD）
 * 不打印任何密钥或完整令牌。
 */
const API = (process.env.API_BASE || 'http://127.0.0.1:4011/api/v1').replace(/\/$/, '');
const adminUser = process.env.ADMIN_USERNAME || 'admin';
const adminPass = process.env.ADMIN_PASSWORD || process.env.ADMIN_INITIAL_PASSWORD || 'admin';

const results = [];
function record(name, ok, detail = '') {
  results.push({ name, ok });
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
    body = { raw: text.slice(0, 200) };
  }
  return { status: res.status, body };
}

function unwrap(body) {
  return body?.data !== undefined ? body.data : body;
}

/** 企业级接口：USER 必须 403，ADMIN 不得 403 */
const ENTERPRISE_ENDPOINTS = [
  '/system/cpu',
  '/system/memory',
  '/system/gpu',
  '/system/docker',
  '/ollama/health',
  '/knowledge/folders',
  '/rag/health',
  '/agents/health',
  '/tools/health',
  '/mcp/health',
  '/workflows/health',
  '/business/health',
  '/developer/health',
];

/** 消费者接口：USER 必须可用 */
const CONSUMER_ENDPOINTS = ['/chat/list', '/chat/models', '/chat/prompts', '/auth/profile'];

async function main() {
  console.log('API', API);

  const health = await req('/health');
  record('health endpoint', health.status < 500, `status=${health.status}`);

  // 1. 注册一个全新的普通用户（默认 USER 角色）
  const suffix = Date.now().toString(36);
  const username = `ux4smoke_${suffix}`;
  const password = `Ux4Smoke!${suffix}`;
  const reg = await req('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password, displayName: 'UX4 Smoke', acceptTerms: true, acceptPrivacy: true }),
  });
  record('register USER account', reg.status === 200 || reg.status === 201, `status=${reg.status}`);

  // 2. 登录普通用户
  const login = await req('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ account: username, password }),
  });
  const userToken = unwrap(login.body)?.accessToken;
  record('USER login', !!userToken, `status=${login.status}`);
  if (!userToken) {
    summarize();
    process.exit(1);
  }

  // 3. USER 访问企业接口 → 必须全部 403 Forbidden
  for (const path of ENTERPRISE_ENDPOINTS) {
    const r = await req(path, {}, userToken);
    record(`USER ${path} → 403`, r.status === 403, `status=${r.status}`);
  }

  // 4. USER 访问消费者接口 → 必须可用
  for (const path of CONSUMER_ENDPOINTS) {
    const r = await req(path, {}, userToken);
    record(`USER ${path} → 200`, r.status === 200, `status=${r.status}`);
  }

  // 5. ADMIN 登录 → 企业接口不得 403（后台功能全部保留）
  const adminLogin = await req('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ account: adminUser, password: adminPass }),
  });
  const adminToken = unwrap(adminLogin.body)?.accessToken;
  record('ADMIN login', !!adminToken, `status=${adminLogin.status}`);
  if (adminToken) {
    for (const path of ENTERPRISE_ENDPOINTS) {
      const r = await req(path, {}, adminToken);
      record(`ADMIN ${path} ≠ 403`, r.status !== 403 && r.status !== 401, `status=${r.status}`);
    }
    for (const path of CONSUMER_ENDPOINTS) {
      const r = await req(path, {}, adminToken);
      record(`ADMIN ${path} → 200`, r.status === 200, `status=${r.status}`);
    }
  }

  // 6. 匿名访问受保护接口 → 401
  const anon = await req('/chat/list');
  record('anonymous /chat/list → 401', anon.status === 401, `status=${anon.status}`);

  summarize();
  process.exit(results.every((r) => r.ok) ? 0 : 1);
}

function summarize() {
  const pass = results.filter((r) => r.ok).length;
  console.log(`\nUX V4.0 smoke: ${pass}/${results.length} PASS`);
}

main().catch((e) => {
  console.error('smoke crashed:', e?.message || e);
  process.exit(1);
});
