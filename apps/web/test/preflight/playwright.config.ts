import { defineConfig, devices } from '@playwright/test';

const EVIDENCE_DIR = '../../../.ui-redesign/evidence/preflight';

export default defineConfig({
  testDir: './specs',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [
    ['list'],
    ['json', { outputFile: './test-results/dpc-summary.json' }],
    ['html', { outputFolder: './playwright-report', open: 'never' }],
  ],
  outputDir: './test-results',

  use: {
    baseURL: process.env.PREFLIGHT_BASE_URL ?? 'http://100.81.83.98:8000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 5_000,
    navigationTimeout: 10_000,
  },

  projects: [
    {
      name: 'chromium-iphone-16-pro',
      use: {
        ...devices['iPhone 16 Pro'],
        channel: undefined,
      },
    },
    {
      name: 'webkit-iphone-16-pro',
      use: {
        ...devices['iPhone 16 Pro Safari'],
      },
    },
  ],

  metadata: {
    configDir: 'apps/web/test/preflight',
    evidenceDir: EVIDENCE_DIR,
    runAt: new Date().toISOString(),
    decisionId: 'PIA-MUR-D-016',
  },
});
