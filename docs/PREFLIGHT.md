# PIA Mobile UI Pre-flight

The PIA mobile UI redesign has a **device-validation pre-flight** that
runs before the implementation contract begins. The pre-flight validates
the approved design system against the iPhone 16 Pro target device,
both via automated tests and manual on-device checks.

This document covers the pre-flight harness, the install steps, and
the evidence format.

## Decisions

- **`PIA-MUR-D-016`** — Approves adding `@playwright/test` and
  `@axe-core/playwright` as dev-only dependencies to `apps/web/devDependencies`,
  plus creating the harness under `apps/web/test/preflight/`. APPROVED
  2026-06-14.
- **`PIA-MUR-D-017`** — Approves the actual install step
  (`pnpm install` + `npx playwright install chromium webkit`).
  **OPEN**; requires explicit user approval before the install runs.

## The 14 DPCs

See `planning/runs/PIA-MUR-D-PREFLIGHT-DEVICE-VALIDATION.md` for the
full checklist, the result template, and the expected behavior per
DPC.

Summary:

| Status | Count | DPCs |
|---|---:|---|
| Automated (Playwright + axe-core) | 11 | DPC-1, 3, 4, 5, 6, 7, 8, 9, 10, 12, 13, 14 |
| BLOCKED (deferred) | 1 | DPC-2 (native dialog; needs auth) |
| PARTIALLY_VERIFIED (manual) | 1 | DPC-11 (PWA install; needs real iPhone) |

The automated harness covers 12 of 14. The user does 1 (DPC-11) on
the real iPhone. 1 (DPC-2) is deferred to the implementation-contract
integration test.

## Install

After `PIA-MUR-D-017` is approved:

```bash
# One-time (per host):
pnpm preflight:install
# Downloads Chromium + WebKit binaries (~230 MB total) to
# ~/.cache/ms-playwright/. NOT into the repo.

# Each run:
pnpm preflight:device
# Runs all 12 automated DPCs against the live prototype
# (http://100.81.83.98:8000 via Tailscale).
# Override the URL with PREFLIGHT_BASE_URL=...
```

## Bridges

Three bridges are used (must be running for the harness to work):

- `http://100.81.83.98:8000` (Tailscale HTTP) — Stream concept prototype.
- `http://100.81.83.98:3000` (Tailscale HTTP) — live API.
- `https://sig-mardi-experiences-coastal.trycloudflare.com` (cloudflared HTTPS) —
  for HTTPS-required checks (DPC-11 PWA install).

## Evidence

The harness emits evidence into `.ui-redesign/evidence/preflight/`:

- `dpc-<NN>-<name>.json` — per-DPC result, measured values, axe violations
- `dpc-<NN>-<name>.png` — 393×852pt screenshot per DPC
- `dpc-05-diff-<screen>.png` — pixelmatch diffs vs the Stream concept SVGs
- `axe-report.json` — axe-core full report
- `*.diff.png` — gitignored (large artifacts only)

## Layout

```
apps/web/test/preflight/
├── README.md (detailed harness docs)
├── playwright.config.ts        # iPhone 16 Pro emulation; chromium + webkit
├── run-preflight.ts            # entry point
├── run-preflight-reporter.ts   # custom reporter; emits per-DPC JSON
├── specs/                      # per-DPC spec files (authored by specialists)
└── test-results/               # Playwright artifacts (gitignored)
```

## CI integration

**Out of scope for PIA-MUR-D-016.** A future ADR will decide whether
the harness runs in CI (`.github/workflows/ci.yaml`); per
`REPOSITORY_ADAPTER.md`, "Adding browser/E2E to CI requires Playwright
+ axe-core approval and security review."

## Rollback

```bash
pnpm remove -D @playwright/test @axe-core/playwright  # in apps/web
rm -rf apps/web/test/preflight/
```

Returns the repo to its pre-PIA-MUR-D-016 state cleanly.
