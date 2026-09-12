import { defineConfig, devices } from '@playwright/test';

const useInstalledEdge = process.env.VHE_E2E_BROWSER === 'edge';
const allBrowsers = process.env.VHE_E2E_ALL_BROWSERS === '1';

const projects = allBrowsers
  ? [
      { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
      { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
      { name: 'webkit', use: { ...devices['Desktop Safari'] } }
    ]
  : [
      useInstalledEdge
        ? { name: 'edge', use: { ...devices['Desktop Chrome'], channel: 'msedge' as const } }
        : { name: 'chromium', use: { ...devices['Desktop Chrome'] } }
    ];

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  timeout: 30_000,
  expect: { timeout: 7_000 },
  fullyParallel: false,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['list']],
  snapshotPathTemplate: '{testDir}/snapshots/{testFilePath}/{arg}-{projectName}{ext}',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    viewport: { width: 1440, height: 1000 }
  },
  projects,
  webServer: {
    command: 'pnpm dev',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
    timeout: 30_000
  }
});
