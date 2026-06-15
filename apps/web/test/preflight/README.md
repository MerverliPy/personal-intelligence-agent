# PIA Mobile UI Pre-flight Harness

This directory contains the automated device-validation pre-flight
harness for the iPhone 16 Pro mobile UI redesign.

## Decisions

- **PIA-MUR-D-016** — approved 2026-06-14; authorizes this harness and the
  `@playwright/test` + `@axe-core/playwright` devDependencies.
- **PIA-MUR-D-017** — open; authorizes the actual install step
  (`pnpm install` + `npx playwright install chromium webkit`).

## What it does

Runs the 14 DPCs (device pre-flight checks) from
`planning/runs/PIA-MUR-D-PREFLIGHT-DEVICE-VALIDATION.md`:

| DPC | Status | Specialist |
|---|---|---|
| DPC-1 (custom sheet focus) | automated | real-ui-product-tester |
| DPC-2 (native dialog focus) | BLOCKED | (deferred; needs auth) |
| DPC-3 (reduce-motion PWA) | automated | real-ui-product-tester |
| DPC-4 (touch targets) | automated | real-ui-product-tester |
| DPC-5 (pixel-perfect) | automated | real-ui-product-tester |
| DPC-6 (safe-area) | automated | iphone-interaction-specialist |
| DPC-7 (viewport-fit=cover) | automated | accessibility-performance-validator |
| DPC-8 (dark mode contrast) | automated | accessibility-performance-validator |
| DPC-9 (AX5) | automated | accessibility-performance-validator |
| DPC-10 (VoiceOver / ARIA) | automated | accessibility-performance-validator |
| DPC-11 (PWA install + standalone) | PARTIALLY_VERIFIED | iphone-interaction-specialist |
| DPC-12 (BT keyboard) | automated | iphone-interaction-specialist |
| DPC-13 (back button) | automated | iphone-interaction-specialist |
| DPC-14 (offline banner T6) | automated | real-ui-product-tester |

## How to run

After PIA-MUR-D-017 is approved and the install step completes:

```bash
# From repo root, with the prototype server running on :8000
# and the live API on :3000 (both via Tailscale or cloudflared):

pnpm preflight:device
```

This will:

1. Launch Chromium and WebKit with iPhone 16 Pro emulation (393×852pt
   logical, 3x density, isMobile, hasTouch).
2. Run the per-DPC spec files in `specs/`.
3. Capture per-DPC screenshots into `test-results/`.
4. Emit per-DPC JSON evidence into
   `../../../.ui-redesign/evidence/preflight/dpc-<NN>-<name>.json`.
5. Emit an axe-core report into
   `../../../.ui-redesign/evidence/preflight/axe-report.json`.
6. Generate an HTML report at
   `./playwright-report/index.html` (gitignored).

## Environment

- `PREFLIGHT_BASE_URL` — defaults to `http://100.81.83.98:8000` (Tailscale
  prototype). Override to `https://sig-mardi-experiences-coastal.trycloudflare.com`
  for HTTPS or `http://100.81.83.98:3000` for the live API.

## Layout

```
apps/web/test/preflight/
├── README.md (this file)
├── playwright.config.ts        # iPhone 16 Pro emulation; chromium + webkit
├── run-preflight.ts            # entry point (extends base config)
├── run-preflight-reporter.ts   # custom reporter; emits per-DPC JSON
├── specs/                      # per-DPC spec files (authored by specialists)
└── test-results/               # Playwright's per-test artifacts (gitignored)
```
