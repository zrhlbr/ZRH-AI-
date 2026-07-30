import { defineConfig, devices } from '@playwright/test';

/**
 * ZRH AI 阶段 3 验收测试配置
 * - 真实 Chromium 浏览器
 * - 长超时（Ollama 流式生成可能较慢）
 * - 输出截图与视频到 e2e/output
 */
export default defineConfig({
  testDir: './e2e',
  outputDir: './e2e/output',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [['list'], ['html', { outputFolder: './e2e/report' }]],
  timeout: 300_000,
  expect: { timeout: 30_000 },
  use: {
    baseURL: 'http://localhost:3010',
    trace: 'on-first-retry',
    video: 'off',
    screenshot: 'only-on-failure',
    launchOptions: {
      slowMo: 50,
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
