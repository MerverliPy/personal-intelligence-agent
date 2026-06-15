import { defineConfig, devices } from '@playwright/test';

const EVIDENCE_DIR = '../../../../.ui-redesign/evidence/preflight';

// Custom iPhone 16 Pro device profile. Playwright 1.60.0's built-in
// `devices['iPhone 16 Pro']` is undefined (the device list tops out at
// iPhone 15 Pro Max in 1.60), so we define the iPhone 16 Pro profile
// explicitly to get the correct 393x852pt logical viewport, 3x
// deviceScaleFactor, and iOS 17.x user agent. Per Apple's
// developer specs (https://developer.apple.com/ios/iphone-16-pro/).
const IPHONE_16_PRO = {
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 ' +
    '(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  viewport: { width: 393, height: 852 },
  screen: { width: 393, height: 852 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  defaultBrowserType: 'webkit' as const,
};

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
    ['./run-preflight-reporter.ts'],
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
        ...IPHONE_16_PRO,
        defaultBrowserType: 'chromium' as const,
        channel: undefined,
      },
    },
    {
      name: 'webkit-iphone-16-pro',
      use: IPHONE_16_PRO,
    },
  ],

  metadata: {
    configDir: 'apps/web/test/preflight',
    evidenceDir: EVIDENCE_DIR,
    runAt: new Date().toISOString(),
    decisionId: 'PIA-MUR-D-016',
  },
});
