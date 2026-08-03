import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '../../docs/mobile-ui-screenshots');
fs.mkdirSync(outDir, { recursive: true });
const BASE = process.env.UX_URL || 'http://127.0.0.1:5173';

const viewports = [
  { name: 'iphone', width: 390, height: 844 },
  { name: 'android', width: 412, height: 915 },
  { name: 'pad', width: 820, height: 1180 },
  { name: 'pc', width: 1440, height: 900 },
];

const browser = await chromium.launch({ headless: true });
const shots = [];
for (const vp of viewports) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(600);
  const file = path.join(outDir, `login-${vp.name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  shots.push(path.basename(file));
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(600);
  const land = path.join(outDir, `landing-${vp.name}.png`);
  await page.screenshot({ path: land, fullPage: false });
  shots.push(path.basename(land));
  await ctx.close();
}
fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify({ at: new Date().toISOString(), shots }, null, 2));
console.log(JSON.stringify({ outDir, shots }, null, 2));
await browser.close();
