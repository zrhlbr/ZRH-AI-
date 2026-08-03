/**
 * UX V4.0 公网验证截图：PC / Pad / Phone，目标 https://ai.zrhtech.com
 * 流程：注册纯 USER 账号 → UI 登录 → 首页 / 抽屉 / 会话 / 收藏 / 对话 截图。
 * 输出：docs/ux-v4-screenshots/public-*.png
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '../../docs/ux-v4-screenshots');
mkdirSync(OUT, { recursive: true });

const API = 'https://ai.zrhtech.com/api/v1';
const WEB = 'https://ai.zrhtech.com';

const VIEWPORTS = [
  { name: 'pc', width: 1440, height: 900, drawer: false },
  { name: 'pad', width: 834, height: 1112, drawer: true },
  { name: 'phone', width: 390, height: 844, drawer: true },
];

async function api(pathname, opts = {}) {
  const res = await fetch(`${API}${pathname}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

/** 等待主内容真正渲染（懒加载 chunk + 动效完成） */
async function waitMainRendered(page) {
  await page.waitForFunction(
    () => (document.querySelector('main')?.innerText?.trim().length ?? 0) > 5,
    { timeout: 20000 },
  );
  await page.waitForTimeout(900); // framer-motion 入场动效
}

async function main() {
  const suffix = Date.now().toString(36);
  const username = `ux4pub_${suffix}`;
  const password = `Ux4Pub!${suffix}`;
  const reg = await api('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password, displayName: 'UX4 公网验证', acceptTerms: true, acceptPrivacy: true }),
  });
  if (reg.status !== 200 && reg.status !== 201) throw new Error(`register failed: ${reg.status}`);
  console.log('registered prod verify user (USER role)');

  const browser = await chromium.launch();

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1,
      ignoreHTTPSErrors: false,
    });
    const page = await context.newPage();

    // 登录页（公网）
    await page.goto(`${WEB}/login`, { waitUntil: 'networkidle' });
    await page.waitForSelector('form', { timeout: 20000 });
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUT, `public-${vp.name}-01-login.png`) });

    // UI 登录
    await page.fill('input[name="account"]', username);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/home', { timeout: 30000 });
    await waitMainRendered(page);
    await page.screenshot({ path: path.join(OUT, `public-${vp.name}-02-home.png`) });

    // 检查横向滚动
    const overflowX = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    console.log(`${vp.name} horizontal-overflow:`, overflowX);

    // 抽屉菜单（手机/平板端）
    if (vp.drawer) {
      await page.locator('header button').first().click();
      await page.waitForTimeout(900);
      await page.screenshot({ path: path.join(OUT, `public-${vp.name}-03-drawer.png`) });
      await page.mouse.click(vp.width - 12, Math.floor(vp.height / 2));
      await page.waitForTimeout(500);
    }

    // 我的会话
    await page.goto(`${WEB}/conversations`, { waitUntil: 'networkidle' });
    await waitMainRendered(page);
    await page.screenshot({ path: path.join(OUT, `public-${vp.name}-04-conversations.png`) });

    // 收藏
    await page.goto(`${WEB}/favorites`, { waitUntil: 'networkidle' });
    await waitMainRendered(page);
    await page.screenshot({ path: path.join(OUT, `public-${vp.name}-05-favorites.png`) });

    // AI 对话
    await page.goto(`${WEB}/chat`, { waitUntil: 'networkidle' });
    await waitMainRendered(page);
    await page.screenshot({ path: path.join(OUT, `public-${vp.name}-06-chat.png`) });

    await context.close();
    console.log(`${vp.name} public screenshots done`);
  }

  await browser.close();
  console.log('saved to', OUT);
}

main().catch((e) => {
  console.error('public screenshot failed:', e?.message || e);
  process.exit(1);
});
