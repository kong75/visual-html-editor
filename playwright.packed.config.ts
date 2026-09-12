import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/packed',
  outputDir: './test-results-packed',
  testMatch: '**/*.packed.ts',
  timeout: 30_000,
  expect: { timeout: 7_000 },
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4174',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    viewport: { width: 1440, height: 1000 }
  },
  projects: [{ name: 'packed-chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm --dir .artifacts/consumer-tests/react-vite exec vite preview --host 127.0.0.1 --port 4174',
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: false,
    timeout: 30_000
  }
});
