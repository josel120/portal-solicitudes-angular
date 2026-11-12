import { defineConfig, devices } from '@playwright/test';

const ci = !!process.env['CI'];

/**
 * E2E against the real stack: API (calm mode, no random failures) + shell + both remotes.
 * Locally, already-running servers are reused.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: ci ? 1 : 0,
  reporter: ci ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4200',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node server.js',
      cwd: 'api',
      env: { LATENCY: 'off', FAILURE_RATE: '0' },
      url: 'http://localhost:3000/auth/me',
      reuseExistingServer: !ci,
    },
    { command: 'npm run start:requests', url: 'http://localhost:4201/remoteEntry.json', reuseExistingServer: !ci, timeout: 180_000 },
    { command: 'npm run start:approvals', url: 'http://localhost:4202/remoteEntry.json', reuseExistingServer: !ci, timeout: 180_000 },
    { command: 'npm run start:shell', url: 'http://localhost:4200/remoteEntry.json', reuseExistingServer: !ci, timeout: 180_000 },
  ],
});
