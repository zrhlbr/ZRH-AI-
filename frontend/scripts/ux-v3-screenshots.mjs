/**
 * UX V3.0 screenshots — public + optional auth via UX_USER / UX_PASS.
 */
import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '../../docs/ux-v3-screenshots');
fs.mkdirSync(outDir, { recursive: true });
const BASE = process.env.UX_URL || 'http://127.0.0.1:5173';
const USER = process.env.UX_USER || '';
const PASS = process.env.UX_PASS || '';

const viewports = [
  { name: 'pc', width: 1440, height: 900 },
  { name: 'pad', width: 820, height: 1180 },
  { name: 'android', width: 412, height: 915 },
  { name: 'iphone', width: 390, height: 844 },
];

const browser = await chromium.launch({ headless: true });
const shots = [];

async function shot(page, name) {
  const file = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  shots.push(path.relative(path.resolve(__dirname, '../..'), file));
}

for (const vp of viewports) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await context.newPage();
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(700);
  await shot(page, `landing-${vp.name}`);
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(500);
  await shot(page, `login-${vp.name}`);
  await context.close();
}

// i18n login phone
{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  for (const lng of ['zh-CN', 'en-US', 'my-MM']) {
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 60000 });
    const btn = page.locator(`[data-testid="lang-${lng}"]`);
    if (await btn.count()) await btn.click();
    await page.waitForTimeout(400);
    await shot(page, `i18n-login-${lng}`);
  }
  await context.close();
}

if (USER && PASS) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.fill('input[name="account"], input[type="text"]', USER).catch(async () => {
    const inputs = page.locator('input');
    await inputs.nth(0).fill(USER);
  });
  await page.locator('input[type="password"]').fill(PASS);
  await page.getByRole('button', { name: /登录|Log in|ဝင်/i }).click();
  await page.waitForTimeout(2500);
  if (page.url().includes('/home') || page.url().includes('/chat')) {
    await shot(page, 'home-iphone');
    // open drawer
    await page.getByLabel(/菜单|Menu|မီနူး/i).click().catch(() => {});
    await page.waitForTimeout(500);
    await shot(page, 'drawer-iphone');
    await page.keyboard.press('Escape').catch(() => {});
    await page.goto(`${BASE}/chat`, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(800);
    await shot(page, 'chat-iphone');
    await page.goto(`${BASE}/me`, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(500);
    await shot(page, 'me-iphone');
    await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(500);
    await shot(page, 'settings-iphone');
  }
  // PC home
  await context.close();
  const pc = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p2 = await pc.newPage();
  await p2.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 60000 });
  await p2.locator('input').nth(0).fill(USER);
  await p2.locator('input[type="password"]').fill(PASS);
  await p2.getByRole('button', { name: /登录|Log in|ဝင်/i }).click();
  await p2.waitForTimeout(2500);
  if (p2.url().includes('/home') || p2.url().includes('/chat')) {
    await shot(p2, 'home-pc');
    await p2.goto(`${BASE}/chat`, { waitUntil: 'networkidle', timeout: 60000 });
    await p2.waitForTimeout(800);
    await shot(p2, 'chat-pc');
  }
  await pc.close();
}

fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify({ at: new Date().toISOString(), base: BASE, auth: Boolean(USER && PASS), shots }, null, 2));
console.log(JSON.stringify({ count: shots.length, auth: Boolean(USER && PASS), outDir }, null, 2));
await browser.close();
