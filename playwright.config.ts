import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173'
const skipWebServer = process.env.PLAYWRIGHT_SKIP_WEB_SERVER === '1'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['html', { outputFolder: 'artifacts/test/playwright-html' }], ['list']] : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: skipWebServer
    ? undefined
    : {
        command: process.env.PLAYWRIGHT_WEB_SERVER_COMMAND ?? 'npm run dev -- --host 127.0.0.1 --port 4173',
        port: Number(new URL(baseURL).port || 4173),
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
