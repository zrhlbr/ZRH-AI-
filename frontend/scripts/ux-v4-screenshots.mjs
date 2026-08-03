/**
 * UX V4.0 截图脚本：PC / Pad / Phone 三端用户界面截图。
 * 前提：vite dev server 已启动（:3010，代理到测试 API :4011）。
 * 输出：docs/ux-v4-screenshots/*.png
 * 不打印任何令牌或密码。
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '../../docs/ux-v4-screenshots');
mkdirSync(OUT, { recursive: true });

const API = 'http://127.0.0.1:4011/api/v1';
const WEB = 'http://localhost:3015';

const VIEWPORTS = [
  { name: 'pc', width: 1440, height: 900 },
  { name: 'pad', width: 834, height: 1112 },
  { name: 'phone', width: 390, height: 844 },
];

async function api(pathname, opts = {}, token) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${pathname}`, { ...opts, headers });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body: body?.data !== undefined ? body.data : body };
}

async function main() {
  // 注册并登录一个纯 USER 账号（默认角色 USER）
  const suffix = Date.now().toString(36);
  const username = `ux4shot_${suffix}`;
  const password = `Ux4Shot!${suffix}`;
  const reg = await api('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password, displayName: 'UX4 截图', acceptTerms: true, acceptPrivacy: true }),
  });
  if (reg.status !== 200 && reg.status !== 201) throw new Error(`register failed: ${reg.status}`);
  const login = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ account: username, password }),
  });
  const accessToken = login.body?.accessToken;
  const refreshToken = login.body?.refreshToken;
  if (!accessToken || !refreshToken) throw new Error('login failed');
  const prof = await api('/auth/profile', {}, accessToken);
  const profile = prof.body?.id ? prof.body : login.body?.profile;
  console.log('screenshot account role:', profile?.role);

  const seed = JSON.stringify({
    state: { refreshToken, profile },
    version: 0,
  });

  const browser = await chromium.launch();

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1,
    });
    await context.addInitScript((value) => {
      window.localStorage.setItem('zrh-ai-auth', value);
    }, seed);
    const page = await context.newPage();

    // 1. 登录页（未登录态、Cosmos 背景）
    const anon = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const anonPage = await anon.newPage();
    await anonPage.goto(`${WEB}/login`, { waitUntil: 'networkidle' });
    await anonPage.screenshot({ path: path.join(OUT, `${vp.name}-01-login.png`) });
    await anon.close();

    // 2. 首页（纯净背景：LOGO/欢迎/输入框/快捷问题/历史入口）
    await page.goto(`${WEB}/home`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUT, `${vp.name}-02-home.png`) });

    // 3. 抽屉菜单（用户菜单 7 项）
    if (vp.name === 'phone' || vp.name === 'pad') {
      await page.locator('header button').first().click();
      await page.waitForTimeout(700);
      await page.screenshot({ path: path.join(OUT, `${vp.name}-03-drawer.png`) });
      await page.mouse.click(vp.width - 12, Math.floor(vp.height / 2));
      await page.waitForTimeout(400);
    }

    // 4. 我的会话
    await page.goto(`${WEB}/conversations`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUT, `${vp.name}-04-conversations.png`) });

    // 5. 收藏
    await page.goto(`${WEB}/favorites`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUT, `${vp.name}-05-favorites.png`) });

    // 6. AI 对话页
    await page.goto(`${WEB}/chat`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUT, `${vp.name}-06-chat.png`) });

    await context.close();
    console.log(`${vp.name} screenshots done`);
  }

  await browser.close();
  console.log('all screenshots saved to', OUT);
}

main().catch((e) => {
  console.error('screenshot failed:', e?.message || e);
  process.exit(1);
});
