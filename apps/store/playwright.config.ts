import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  globalSetup: '@proteus/testing/global-setup',
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3011',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'npm run --workspace=backend dev:test',
      url: 'http://localhost:3010/health',
      reuseExistingServer: true,
    },
    {
      command: 'npm run dev:test',
      url: 'http://localhost:3011',
      reuseExistingServer: true,
    },
  ],
})
