/**
 * UX V2.0 acceptance screenshots — landing/login across viewports + languages.
 */
import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '../../docs/ux-v2-screenshots');
fs.mkdirSync(outDir, { recursive: true });
const BASE = process.env.UX_URL || 'http://127.0.0.1:5173';

const viewports = [
  { name: 'pc', width: 1440, height: 900 },
  { name: 'ipad', width: 820, height: 1180 },
  { name: 'android', width: 412, height: 915 },
  { name: 'iphone', width: 390, height: 844 },
];

const langs = [
  { code: 'zh-CN', label: 'zh' },
  { code: 'en-US', label: 'en' },
  { code: 'my-MM', label: 'my' },
];

const browser = await chromium.launch({ headless: true });
const shots = [];

for (const vp of viewports) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
  });
  const page = await context.newPage();
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(800);
  const landing = path.join(outDir, `landing-${vp.name}.png`);
  await page.screenshot({ path: landing, fullPage: false });
  shots.push(landing);

  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(600);
  const login = path.join(outDir, `login-${vp.name}.png`);
  await page.screenshot({ path: login, fullPage: false });
  shots.push(login);
  await context.close();
}

// i18n on phone login
const i18nCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const i18nPage = await i18nCtx.newPage();
for (const lng of langs) {
  await i18nPage.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 60000 });
  await i18nPage.waitForTimeout(400);
  const btn = i18nPage.locator(`[data-testid="lang-${lng.code}"]`);
  if (await btn.count()) await btn.click();
  await i18nPage.waitForTimeout(500);
  const file = path.join(outDir, `login-i18n-${lng.label}.png`);
  await i18nPage.screenshot({ path: file, fullPage: false });
  shots.push(file);
}
await i18nCtx.close();

fs.writeFileSync(
  path.join(outDir, 'manifest.json'),
  JSON.stringify({ at: new Date().toISOString(), base: BASE, shots: shots.map((s) => path.relative(path.resolve(__dirname, '../..'), s)) }, null, 2),
);
console.log(`captured ${shots.length} shots -> ${outDir}`);
await browser.close();
