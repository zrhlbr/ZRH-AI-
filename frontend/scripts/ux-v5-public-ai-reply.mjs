/** 公网 V5：AI 完整回复验证（带状态诊断） */
import { chromium } from '@playwright/test';

const API = 'https://ai.zrhtech.com/api/v1';
const WEB = 'https://ai.zrhtech.com';
const suffix = Date.now().toString(36);
const username = `ux5diag_${suffix}`;
const password = `Ux5Diag!${suffix}`;

const reg = await fetch(`${API}/auth/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username, password, displayName: 'UX5 诊断', acceptTerms: true, acceptPrivacy: true }),
});
if (!reg.ok) throw new Error(`register failed: ${reg.status}`);

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true })).newPage();
page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 200)));
await page.goto(`${WEB}/login`, { waitUntil: 'networkidle' });
await page.fill('input[name="account"]', username);
await page.fill('input[name="password"]', password);
await page.click('button[type="submit"]');
await page.waitForURL('**/home', { timeout: 30000 });
await page.goto(`${WEB}/chat`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
const input = page.locator('textarea').first();
await input.click();
await input.fill('你好');
await page.keyboard.press('Enter');

for (let i = 0; i < 30; i++) {
  await page.waitForTimeout(5000);
  const state = await page.evaluate(() => {
    const text = document.querySelector('main')?.innerText ?? '';
    const assistants = document.querySelectorAll('[data-role="assistant"]').length;
    const generating = text.includes('正在生成');
    return { generating, assistants, snippet: text.slice(-150) };
  });
  console.log(`t=${(i + 1) * 5}s`, JSON.stringify(state));
  if (!state.generating && state.assistants > 0) break;
  if (!state.generating && i >= 2 && state.assistants === 0) {
    // 生成可能根本没开始或已失败
    if (i >= 5) break;
  }
}
await page.screenshot({ path: 'C:/Users/zhaor/ZRH-AI/docs/ux-v5-screenshots/public-v5-phone-07-ai-reply-done.png' });
await browser.close();
console.log('done');
