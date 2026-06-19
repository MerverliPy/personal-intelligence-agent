# PIA-MUR-D-015 — Feature Critique Panel: Group 3 (PWA Infrastructure)

## Objective

Evaluate the PWA Infrastructure features (manifest, service worker, icons, iOS meta tags, workspace card click handlers) for correctness, security, iOS compatibility, and adherence to design contract §9.

## Verdict

**HYBRID (ACCEPT with conditions)** — Delivers the highest-leverage mobile investment with solid architecture. 6 modifications required.

## Panel Participants

- **Critic** (adversarial): `feature-critic`
- **Advocate** (constructive): `feature-advocate`
- **Judge** (neutral synthesizer): `feature-judge`

## Judge Analysis

The judge re-rated the critic's P1 findings to P2/P3, noting that the critic's concerns (iOS PWA standalone test, Tailscale direct vs HTTPS nuance, SW lifecycle) are spec-level and test-level, not implementation flaws. The core architecture (manifest at `/manifest.webmanifest`, SW at `/sw.js`, scope `/`, straightforward activation) is sound.

## Modifications Required (6 items)

1. **Fix `reply.raw` security headers bypass** — `pwa-assets.ts` served static files via `reply.raw` which bypassed Fastify's security headers plugin (`@fastify/helmet`). Changed to use `reply.type()` + `reply.send()` with explicit security headers.

2. **Fix `start_url` to `/app`** — Manifest declared `"start_url": "/"` but the app's root redirects to `/app`. Changed to `"start_url": "/app"` so the PWA launches into the workspace shell.

3. **Add `/app` to SW precache** — Service worker only precached root URL (`/`). Added `/app` to the `PRECACHE_URLS` array so the PWA shell is immediately available offline (network-required PWA still shows the shell on network loss).

4. **Add SW registration error logging** — Missing error handling on `navigator.serviceWorker.register()`. Added `.catch()` with `console.error` so registration failures are visible in dev tools.

5. **Fix SSE accept-header case sensitivity** — Server-Sent Events endpoint checked `Accept: text/event-stream` with exact matching. Changed to case-insensitive comparison (some HTTP clients send `accept: text/event-stream`).

6. **Fix cache-control for manifest** — Manifest was served without explicit `Cache-Control` header. Added `no-cache` to prevent stale manifest on PWA update checks.

## Items Discharged or Deferred

| Original Finding          | Disposition | Reason                                                         |
| ------------------------- | ----------- | -------------------------------------------------------------- |
| iOS PWA standalone test   | Deferred    | Requires physical device; tracked in device-validation         |
| SW update flow            | Discharged  | Current design (skip-waiting on install) is appropriate for v1 |
| Tailscale HTTP limitation | Noted       | Documented in REPOSITORY_ADAPTER.md as expected limitation     |
| No push notifications     | Discharged  | Not in redesign scope (P7)                                     |

## Remediations Applied

Commit `d3e28a6` applied all 6 modifications:

```
apps/api/src/routes/pwa-assets.ts         |  25 +++++---
apps/web/public/manifest.webmanifest      |   2 +-
apps/web/public/sw.js                     |   3 +-
```

## Acceptance Criteria

- [x] PWA assets served through Fastify handler with security headers (not `reply.raw`)
- [x] `start_url` points to `/app`
- [x] `/app` is in SW precache
- [x] SW registration logs errors to console
- [x] SSE accept-header check is case-insensitive
- [x] Manifest served with `Cache-Control: no-cache`

## State

**DONE** — All 6 modifications applied. No new dependencies, no schema changes, no auth changes.
