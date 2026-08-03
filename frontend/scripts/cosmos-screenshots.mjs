/**
 * Capture Cosmos V3.0 screenshots at PC / Pad / Phone viewports + rough FPS sample.
 */
import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '../../docs/cosmos-v3-screenshots');
fs.mkdirSync(outDir, { recursive: true });

const BASE = process.env.COSMOS_URL || 'http://127.0.0.1:5173';

const viewports = [
  { name: 'pc', width: 1440, height: 900 },
  { name: 'pad', width: 820, height: 1180 },
  { name: 'phone', width: 390, height: 844 },
];

async function measureFps(page) {
  return page.evaluate(async () => {
    let frames = 0;
    const start = performance.now();
    await new Promise((resolve) => {
      const tick = (t) => {
        frames += 1;
        if (t - start < 1000) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });
    return frames;
  });
}

const browser = await chromium.launch({ headless: true });
const report = { at: new Date().toISOString(), base: BASE, shots: [], fps: {} };

for (const vp of viewports) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1200);
  const file = path.join(outDir, `landing-${vp.name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  report.shots.push({ viewport: vp.name, file: path.relative(path.resolve(__dirname, '../..'), file) });
  if (vp.name === 'pc' || vp.name === 'phone') {
    report.fps[vp.name] = await measureFps(page);
  }
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(800);
  await page.screenshot({
    path: path.join(outDir, `login-${vp.name}.png`),
    fullPage: false,
  });
  report.shots.push({
    viewport: vp.name,
    file: `docs/cosmos-v3-screenshots/login-${vp.name}.png`,
  });
  await context.close();
}

fs.writeFileSync(path.join(outDir, 'metrics.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
