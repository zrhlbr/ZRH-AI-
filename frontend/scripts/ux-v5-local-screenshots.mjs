/**
 * Mobile Chat UI V5.0 本地验证截图：PC / Pad / Phone，目标 http://localhost:3011（测试栈）
 * 校验：空会话无品牌区、无底部导航、输入框 fixed 贴底、Header 56px、无横向滚动、消息右左布局。
 * 输出：docs/ux-v5-screenshots/local-*.png
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '../../docs/ux-v5-screenshots');
mkdirSync(OUT, { recursive: true });

const API = 'http://localhost:4011/api/v1';
const WEB = 'http://localhost:3011';

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

async function waitMainRendered(page) {
  await page.waitForFunction(
    () => (document.querySelector('main')?.innerText?.trim().length ?? 0) > 5,
    { timeout: 20000 },
  );
  await page.waitForTimeout(900);
}

async function main() {
  const suffix = Date.now().toString(36);
  const username = `ux5loc_${suffix}`;
  const password = `Ux5Loc!${suffix}`;
  const reg = await api('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password, displayName: 'UX5 本地验证', acceptTerms: true, acceptPrivacy: true }),
  });
  if (reg.status !== 200 && reg.status !== 201) throw new Error(`register failed: ${reg.status}`);
  console.log('registered local verify user (USER role)');

  const browser = await chromium.launch();

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1,
      hasTouch: vp.drawer,
    });
    const page = await context.newPage();

    // 登录页
    await page.goto(`${WEB}/login`, { waitUntil: 'networkidle' });
    await page.waitForSelector('form', { timeout: 20000 });
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(OUT, `local-${vp.name}-01-login.png`) });

    // UI 登录
    await page.fill('input[name="account"]', username);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/home', { timeout: 30000 });
    await waitMainRendered(page);
    await page.screenshot({ path: path.join(OUT, `local-${vp.name}-02-home.png`) });

    // ===== V5.0 静态校验 =====
    const checks = await page.evaluate(() => {
      const header = document.querySelector('.zrh-shell-header');
      const headerInner = document.querySelector('.zrh-shell-header-inner');
      return {
        bottomNavCount: document.querySelectorAll('.zrh-bottom-nav').length,
        headerHeight: headerInner ? Math.round(headerInner.getBoundingClientRect().height) : null,
        headerPosition: header ? getComputedStyle(header).position : null,
        overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      };
    });
    console.log(`${vp.name} checks:`, JSON.stringify(checks));

    // 聊天页（空会话 —— 不得有品牌 Logo/介绍/欢迎语）
    await page.goto(`${WEB}/chat`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const chatEmpty = await page.evaluate(() => {
      const main = document.querySelector('main');
      const dock = document.querySelector('.zrh-chat-input-dock');
      const cs = dock ? getComputedStyle(dock) : null;
      const r = dock?.getBoundingClientRect();
      return {
        hasBrandMark: !!main?.querySelector('img, svg')?.closest('section'),
        mainText: main?.innerText?.slice(0, 120),
        dockPosition: cs?.position,
        dockBottom: cs?.bottom,
        dockRect: r ? { y: Math.round(r.y), h: Math.round(r.height), vh: window.innerHeight } : null,
      };
    });
    console.log(`${vp.name} chat-empty:`, JSON.stringify(chatEmpty));
    await page.screenshot({ path: path.join(OUT, `local-${vp.name}-03-chat-empty.png`) });

    // 发一条消息（验证用户气泡右侧 / 消息区布局 / 输入框保持贴底）
    const input = page.locator('textarea, input[type="text"]').last();
    await input.fill('你好，请用一句话介绍你自己。');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(OUT, `local-${vp.name}-04-chat-sent.png`) });

    // 输入框聚焦（移动端模拟键盘弹出前的聚焦态）
    await input.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(OUT, `local-${vp.name}-05-chat-focus.png`) });

    // 抽屉菜单（手机/平板）
    if (vp.drawer) {
      await page.locator('header button').first().click();
      await page.waitForTimeout(900);
      await page.screenshot({ path: path.join(OUT, `local-${vp.name}-06-drawer.png`) });
      await page.mouse.click(vp.width - 12, Math.floor(vp.height / 2));
      await page.waitForTimeout(400);
    }

    await context.close();
    console.log(`${vp.name} local screenshots done`);
  }

  await browser.close();
  console.log('saved to', OUT);
}

main().catch((e) => {
  console.error('local screenshot failed:', e?.message || e);
  process.exit(1);
});
