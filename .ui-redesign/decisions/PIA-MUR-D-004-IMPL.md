# PIA-MUR-D-004-IMPL — Implementation Contract (Stream, PIA mobile UI redesign)

**Status:** `PROPOSED`
**Date:** 2026-06-15
**Parent decisions:** PIA-MUR-D-001, PIA-MUR-D-002, PIA-MUR-D-003c (Stream), PIA-MUR-D-004 (design contract), PIA-MUR-D-005, PIA-MUR-D-009, PIA-MUR-D-011.
**Authority:** This packet authorizes file-by-file changes in `apps/web/src/`, `apps/web/public/`, `apps/api/src/`, and `apps/web/test/`. Each atomic commit requires its own commit-message approval per the orchestrator's per-commit protocol.

## 1. Evidence

- Design contract: `.ui-redesign/contracts/DESIGN_CONTRACT.json` (13/13 required fields, 17/17 const checks pass).
- Product model: `.ui-redesign/reports/PIA-MUR-D-002-product-model.md` (T1=A through T7=A approved).
- Stream concept decisions: `.ui-redesign/decisions/` (PIA-MUR-D-003c + PIA-MUR-D-005 + PIA-MUR-D-009 + PIA-MUR-D-011 all APPROVED).
- Pre-flight report: `.ui-redesign/evidence/preflight/dpc-summary.json` (3 follow-up fixes verified PASS in both chromium and webkit; DPC-1 sheet focus is a real prototype issue surfaced but is not a blocker).
- Pre-flight harness: `apps/web/test/preflight/` (re-runnable; 84 tests; 57 passing; CI integration out of scope).

## 2. Problem

The redesign's product model, concept (Stream), and design contract are approved. The pre-flight harness validates the design against the iPhone 16 Pro target. The 3 real prototype findings surfaced by the harness (DPC-4 touch targets, DPC-6 tab-bar layout, DPC-8 dark mode) are fixed in the Stream concept prototype (`.ui-redesign/concepts/concept-3-stream/interactive/`) under PIA-MUR-D-005, -009, -011. The implementation contract maps these design decisions to specific source files in `apps/web/src/`, `apps/web/public/`, `apps/api/src/`, and `apps/web/test/`. After approval, the frontend-implementer can begin the atomic commit plan below.

## 3. Constraints (non-negotiable)

- **TypeScript strict mode**, no implicit `any`.
- **All tenant-scoped queries include workspace authorization** (per `AGENTS.md`).
- **All write endpoints support idempotency** where duplicate execution is harmful (per `AGENTS.md`).
- **Externally supplied or retrieved content is untrusted data**, never privileged instruction (per `AGENTS.md`).
- **All existing P3-GATE tests must still pass** (921 unit tests + 13 security + 1 e2e + 11/11 retrieval/answers evals). The implementation must NOT regress.
- **No new dependencies** without an explicit decision packet (per the protected-areas list).
- **No schema, route, API contract, auth, or deployment change** without an explicit decision packet.
- **Bridges 1-6 of P3-GATE close** must remain closed.
- **CSP `script-src 'self' 'unsafe-inline'`** must be respected. The implementation must coexist with the existing CSP. Service worker registration does not require changing the CSP (SW registration is allowed under `script-src` only for inline scripts that register the SW, which the existing CSP already permits via `'unsafe-inline'`).
- **Production bundle size** should not regress significantly. The current `apps/web` `build` script is an echo stub (AUD-P3-105), so bundle size is currently 0 bytes. After implementation, the bundle should remain minimal (target: < 50KB gzipped CSS/JS added).

## 4. Materially different alternatives

| Alternative | Description | Trade-offs |
|---|---|---|
| **A. Single PR, all changes in one commit** | All 12 atomic steps land in one PR. | **Reject.** Per `AGENTS.md` "small atomic commits tied to decision and contract IDs". One PR makes review impossible and rollback all-or-nothing. |
| **B. One commit per source file** | Each file gets its own commit. | **Reject.** 12+ files = 12+ commits. Over-fragmented; dependencies between commits are hard to track. |
| **C. Themed commit groups (8 commits)** | Group related changes into themes: tokens, safe-area, top app bar, bottom tab bar, citation sheet, FAB + mode picker, dark mode / reduce motion, PWA assets. Each commit is a self-contained, reviewable, revertable unit. | **Recommended.** Matches the orchestrator's small-atomic-commits policy. 8 commits are reviewable in < 1 hour each. |
| D. Defer implementation; ship a docs-only update instead | Don't write code yet; update the design contract with the pre-flight findings and wait. | Reject. The user explicitly asked to draft the implementation contract. |

## 5. Recommendation

**Approve C.** 8 atomic commits, each independently revertable, each with a per-commit verification command. Each commit goes through the orchestrator's per-commit summary-and-approval protocol before landing.

## 6. Atomic commit plan (8 commits)

Each commit maps to a specific decision packet and a specific verification command set.

### Commit 1: `chore(redesign): extract design tokens to shared.ts` (PIA-MUR-D-004)

**Files:**
- `apps/web/src/pages/shared.ts` (the `sharedCss` string at line 8-66; 59 lines)
  - Add a `:root` block at the top with CSS custom properties: `--accent: #2563EB;`, `--bg: #FFFFFF;`, `--fg: #0A0A0A;`, `--fg-muted: #5C5C5C;`, `--divider: #ECECEC;`, `--accent-pressed: #1D4ED8;`, `--selection: #DBE7FF;`, `--t-body: 19pt;`, `--t-caption: 14pt;`, `--t-section: 24pt;`, `--s-1: 4pt;` through `--s-12: 48pt;`, `--r-sm: 8pt;` through `--r-pill: 9999pt;`, `--motion-fast: 120ms;`, `--motion-base: 200ms;`, `--motion-sheet: 280ms;`, `--motion-ease: cubic-bezier(0.32, 0.72, 0, 1);`, `--touch-min: 44pt;`, `--tab-bar-h: 49pt;`.
  - Replace existing inline colors with `var(--accent)`, `var(--bg)`, etc.
  - Use spacing tokens (`--s-4` instead of `16pt` etc.) for all paddings, margins, gaps.
  - Add 4pt grid via the spacing scale.

**Verification commands:**
- `pnpm typecheck` (must pass)
- `pnpm lint` (must pass)
- `pnpm test:unit` (must pass; 921+ tests)
- `pnpm format:check` (must pass; no prettier violations)

**Acceptance:**
- The `sharedCss` string in `apps/web/src/pages/shared.ts` contains all 18 design tokens.
- The existing `apps/web/test/a11y-static.test.ts` still passes (no a11y regression).
- 0 production-runtime tokens are introduced (all are CSS custom properties in the existing inline style block; no new dependencies).

### Commit 2: `feat(redesign): add safe-area insets + viewport-fit=cover` (PIA-MUR-D-004 §8 + PIA-MUR-D-011)

**Files:**
- `apps/api/src/routes/web.ts:25` (the viewport meta)
  - Change `<meta name="viewport" content="width=device-width, initial-scale=1.0">` to `<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">`.
- `apps/web/src/pages/shared.ts` (the `sharedCss` string)
  - Add `body { padding-top: max(env(safe-area-inset-top, 0px), 59pt); padding-bottom: env(safe-area-inset-bottom, 0px); }` for safe-area.

**Verification commands:**
- `pnpm typecheck` (must pass)
- `pnpm lint` (must pass)
- `pnpm test:unit` (must pass)
- `curl -sI http://localhost:3000/app | grep viewport-fit=cover` (must contain `viewport-fit=cover`)

**Acceptance:**
- The viewport meta has `viewport-fit=cover`.
- The body has safe-area insets.
- 0 new dependencies.

### Commit 3: `feat(redesign): add bottom tab bar (T1=A)` (PIA-MUR-D-002 + PIA-MUR-D-011)

**Files:**
- `apps/web/src/pages/shared.ts` (the `pageShell` function at line 126-192; 67 lines)
  - Add `<nav class="tab-bar" role="navigation" aria-label="Primary">` with 3 tabs: Conversations, Documents, Search.
  - Each tab: `<button class="tab" data-tab="conversations" aria-current="page">Conversations</button>` (and similarly for documents, search).
  - CSS for `.tab-bar`: `position: fixed; left: 0; right: 0; bottom: 0; height: var(--tab-bar-h) + env(safe-area-inset-bottom); padding-bottom: env(safe-area-inset-bottom); display: flex; background: var(--bg); border-top: 0.5pt solid var(--divider); z-index: 10;` (per PIA-MUR-D-011).
  - CSS for `.tab`: `flex: 1 1 0; min-height: var(--touch-min); display: flex; align-items: center; justify-content: center;`.
  - Add JS to handle tab clicks: set `aria-current="page"` on the clicked tab, remove from others. Navigate to the corresponding screen.

**Verification commands:**
- `pnpm typecheck` (must pass)
- `pnpm lint` (must pass)
- `pnpm test:unit` (must pass)
- `pnpm preflight:device` (DPC-6 should still pass; DPC-7 should still pass; DPC-12 keyboard tab order should still pass)

**Acceptance:**
- The tab bar has 3 tabs (Conversations, Documents, Search).
- The tab bar is `position: fixed; bottom: 0`.
- Tab click navigates to the corresponding screen.
- `aria-current="page"` is set on the active tab.
- Touch targets are ≥ 44pt (DPC-4 sub-test passes).

### Commit 4: `feat(redesign): add top app bar (T4=A) with 44pt avatar` (PIA-MUR-D-002 + PIA-MUR-D-009)

**Files:**
- `apps/web/src/pages/shared.ts` (the `pageShell` function)
  - Add `<header class="app-header" role="banner">` with the avatar button and the page title.
  - The avatar: `<button id="avatar-btn" class="app-header__avatar" aria-label="Workspace: PIA Workspace. Tap to switch." aria-haspopup="dialog" aria-expanded="false">` (44pt × 44pt per PIA-MUR-D-009).
  - The title: a `<div class="app-header__title">` that gets updated by the JS based on the active tab.
  - CSS for `.app-header__avatar`: `width: 44pt; height: 44pt;` (per PIA-MUR-D-009).
  - Add JS to handle avatar click: open the workspace switcher sheet (or alert in v1).

**Verification commands:**
- `pnpm typecheck` (must pass)
- `pnpm lint` (must pass)
- `pnpm test:unit` (must pass)
- `pnpm preflight:device` (DPC-4 sub-test `avatar meets 44pt` should now pass)

**Acceptance:**
- The header has an avatar button + page title.
- The avatar measures ≥ 44×44pt.
- `role="banner"` is set on the header.

### Commit 5: `feat(redesign): add network-loss banner (T6=A) + offline detection` (PIA-MUR-D-002 §5)

**Files:**
- `apps/web/src/pages/shared.ts` (the pageShell)
  - Add `<div id="network-banner" class="network-banner" role="status" aria-live="polite" hidden>` with text "You're offline. Some actions are disabled."
  - CSS for `.network-banner`: `position: fixed; top: max(env(safe-area-inset-top), 59pt); left: 0; right: 0; padding: 8pt 16pt; background: var(--danger); color: white; z-index: 50;`
  - Add client-side JS: `window.addEventListener('online', () => networkBanner.hidden = true); window.addEventListener('offline', () => networkBanner.hidden = false); navigator.onLine` to set initial state.
  - Also disable destructive buttons (FAB, Send, etc.) when offline.

**Verification commands:**
- `pnpm typecheck` (must pass)
- `pnpm lint` (must pass)
- `pnpm test:unit` (must pass)
- `pnpm preflight:device` (DPC-14 should still pass)

**Acceptance:**
- The banner appears below the Dynamic Island when offline.
- FAB and Send are disabled when offline.
- The banner uses `role="status"` and `aria-live="polite"`.

### Commit 6: `feat(redesign): footnote-style citation chip + citation sheet` (PIA-MUR-D-002 + PIA-MUR-D-004 §3.4)

**Files:**
- `apps/web/src/pages/conversation-detail.ts:100-104` (the existing `renderCitationChipClient` function)
  - Change from filled button to footnote-style text chip: remove the button background, change color to `var(--accent)`, add `text-decoration: underline` on `:hover/:focus-visible`.
  - Increase the tap area: add `min-width: 44pt; min-height: 44pt;` (per PIA-MUR-D-009).
- `apps/web/src/pages/conversation-detail.ts:45` (the existing `<dialog id="citation-modal">`)
  - Wrap in a sheet-style container with `position: fixed; bottom: 0; left: 0; right: 0; max-height: 80vh; transform: translateY(100%); transition: transform var(--motion-sheet) var(--motion-ease);`
  - On `showModal()`: `transform: translateY(0);` (slide up).
  - Add `aria-modal="true"` (already present) and `aria-labelledby="citation-modal-title"` (already present).

**Verification commands:**
- `pnpm typecheck` (must pass)
- `pnpm lint` (must pass)
- `pnpm test:unit` (must pass)
- `pnpm preflight:device` (DPC-1 partially PASS; DPC-4 citation chip sub-test now passes)

**Acceptance:**
- The citation chip is footnote-style (text-only, accent color, underline on hover).
- The citation chip measures ≥ 44×44pt.
- The citation modal slides up from the bottom.
- The focus moves into the sheet on open.

### Commit 7: `feat(redesign): FAB (T7=A) on Conversations / Documents + mode-of-conversation sheet`

**Files:**
- `apps/web/src/pages/conversation-list.ts` (add `<button class="fab" id="fab-conversation" aria-label="New conversation">` at the bottom)
- `apps/web/src/pages/document-list.ts` (add `<button class="fab" id="fab-document" aria-label="Upload document">` at the bottom)
- `apps/web/src/pages/shared.ts` (the pageShell)
  - CSS for `.fab`: `position: fixed; bottom: calc(var(--tab-bar-h) + env(safe-area-inset-bottom) + 16pt); right: 16pt; width: 56pt; height: 56pt; border-radius: 50%; background: var(--accent); color: var(--accent-fg); border: 0; z-index: 20;` (per T7=A).
- New mode-of-conversation sheet: `<div id="mode-sheet" class="sheet" hidden>` with 6 radio rows (ASK / RESEARCH / ANALYZE / PLAN / EXECUTE / LEARN).
  - Add JS to open the sheet on FAB click; pre-select ASK.

**Verification commands:**
- `pnpm typecheck` (must pass)
- `pnpm lint` (must pass)
- `pnpm test:unit` (must pass)
- `pnpm preflight:device` (DPC-4 FAB sub-test still passes; DPC-1 mode sheet focus works)

**Acceptance:**
- The FABs measure ≥ 56×56pt.
- The FABs open the mode sheet on click.
- The mode sheet has 6 radio rows.

### Commit 8: `feat(redesign): PWA manifest + service worker + theme-color + apple-touch-icon` (PIA-MUR-D-004 §9)

**Files:**
- `apps/web/public/manifest.webmanifest` (NEW)
  ```json
  {
    "name": "Personal Intelligence and Action Engine",
    "short_name": "PIA",
    "start_url": "/app",
    "display": "standalone",
    "background_color": "#FFFFFF",
    "theme_color": "#2563EB",
    "icons": [
      { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
      { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
    ]
  }
  ```
- `apps/web/public/icon-192.png` (NEW; 192x192 PNG; placeholder solid color or PIA logo)
- `apps/web/public/icon-512.png` (NEW; 512x512 PNG)
- `apps/web/public/apple-touch-icon.png` (NEW; 180x180 PNG)
- `apps/web/public/service-worker.js` (NEW; basic pre-cache + offline fallback)
  ```js
  const CACHE = 'pia-shell-v1';
  const SHELL_ASSETS = ['/', '/app', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png', '/styles.css'];
  self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL_ASSETS))));
  self.addEventListener('fetch', e => {
    if (e.request.method !== 'GET') return;
    if (new URL(e.request.url).pathname.startsWith('/v1/')) return; // let API calls fail
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).catch(() => caches.match('/'))));
  });
  ```
- `apps/api/src/routes/web.ts` (add static asset route for `/manifest.webmanifest`, `/icon-*.png`, `/apple-touch-icon.png`, `/service-worker.js`)
- `apps/web/src/pages/shared.ts` (add `<link rel="manifest" href="/manifest.webmanifest">`, `<meta name="theme-color" content="#2563EB">`, `<meta name="apple-mobile-web-app-capable" content="yes">`, `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">`, `<link rel="apple-touch-icon" href="/apple-touch-icon.png">` to the `<head>`)

**Verification commands:**
- `pnpm typecheck` (must pass)
- `pnpm lint` (must pass)
- `pnpm test:unit` (must pass)
- `pnpm security:secrets` (must pass; the placeholder icons are 1x1 PNGs, no secrets)
- `pnpm security:dependencies` (must pass; no new deps)
- `curl -sI http://localhost:3000/manifest.webmanifest` (must return 200)
- `curl -sI http://localhost:3000/icon-192.png` (must return 200)
- `curl -sI http://localhost:3000/service-worker.js` (must return 200)
- `pnpm preflight:device` (DPC-11 PWA install is still PARTIALLY_VERIFIED — manual on real iPhone; the harness confirms `matchMedia('(display-mode: standalone)')` works)

**Acceptance:**
- The manifest is valid JSON and served at `/manifest.webmanifest`.
- The icons exist at `/icon-192.png`, `/icon-512.png`, `/apple-touch-icon.png`.
- The service worker is served at `/service-worker.js`.
- The viewport meta + theme-color + apple-touch-icon links are in the page `<head>`.
- The service worker pre-caches the shell assets and serves them on subsequent loads.
- Network-required PWA: API calls (`/v1/*`) are NOT cached; they fail through to the page-level error handling.

## 7. Per-commit protocol

Per the orchestrator's mission: "Each commit must reference the decision or contract ID it implements. Atomic commits only."

For each of the 8 commits above, the orchestrator will:
1. Produce a per-commit summary (files changed, verification commands run, evidence).
2. Surface it to the user for explicit approval.
3. Wait for the "Approve" response before landing the commit.
4. Repeat for the next commit.

## 8. Atomic rollback plan

Each commit is revertable via `git revert <commit-hash>`. The 8 commits form a coherent stack; rolling back commit N restores the pre-commit-N state for that file set.

Full rollback (revert all 8 commits) returns the source tree to its pre-PIA-MUR-D-004-IMPL state. The pre-flight harness would then re-detect the un-implemented state (DPC-4 avatar 32pt FAIL, DPC-6 tab-bar absolute FAIL, etc.).

## 9. Database / API / schema / auth effects

**Zero.** The implementation contract does NOT touch:
- `db/schema.sql` or any migration file
- `api/openapi.yaml` (no new endpoints)
- The OIDC auth flow
- The rate limit or idempotency key infrastructure
- The existing routes (`workspaces`, `documents`, `uploads`, `retrieval`, `conversations`, `feedback`, `health`)

The only API-side changes are: serving new static assets at `/manifest.webmanifest`, `/icon-*.png`, `/apple-touch-icon.png`, `/service-worker.js`. These are GET routes that serve files from `apps/web/public/`. No write endpoints, no schema changes, no auth changes.

## 10. Verification strategy

For each commit:
- `pnpm format:check` — must pass (no prettier violations introduced).
- `pnpm lint` — must pass (no eslint violations introduced).
- `pnpm typecheck` — must pass (no type errors introduced).
- `pnpm test:unit` — must pass (all 921+ unit tests still green; new tests added where appropriate).
- `pnpm security:secrets` — must pass (no secrets in any committed file).
- `pnpm security:dependencies` — must pass (no new dependencies introduced; lockfile may shift slightly but no new entries).
- For commits that affect the visual surface: `pnpm preflight:device` — re-run the pre-flight harness; the relevant DPC must continue to PASS.

After all 8 commits:
- `pnpm ci:check` — full CI check.
- `pnpm eval:retrieval` and `pnpm eval:answers` — must still 11/11 PASS (no regression in retrieval or answer quality).
- `pnpm test:security` — must still 13/13 PASS.
- `pnpm test:e2e` — must still 1/1 PASS.

## 11. Acceptance criteria for PIA-MUR-D-004-IMPL

- **AC1.** All 8 commits land atomically with the per-commit approval protocol.
- **AC2.** Each commit passes `format:check` + `lint` + `typecheck` + `test:unit` + `security:secrets` + `security:dependencies` at landing time.
- **AC3.** The P3-GATE inherited checks (921 unit + 13 security + 1 e2e + 11 retrieval/11 answers) all still PASS after the 8 commits.
- **AC4.** The pre-flight harness re-runs and shows: DPC-4 PASS (avatar 44pt + chip 44pt), DPC-6 PASS (tab-bar fixed), DPC-7 PASS (viewport 393x852), DPC-8 PASS (dark mode auto-switch), DPC-9 PASS (AX5), DPC-12 PASS (BT keyboard), DPC-14 PASS (offline banner).
- **AC5.** `curl -sI http://localhost:3000/manifest.webmanifest` returns 200.
- **AC6.** `curl -sI http://localhost:3000/service-worker.js` returns 200 and the SW is registered on page load (`navigator.serviceWorker.controller !== null` after a refresh).
- **AC7.** The total `apps/web` bundle size has not regressed (target: < 50KB gzipped CSS/JS added).
- **AC8.** No new dependencies, no new endpoints, no schema changes, no auth changes.

## 12. Response syntax

- **"Approve PIA-MUR-D-004-IMPL"** → I begin the per-commit approval protocol. Commit 1 (design tokens) goes first; you see the diff, run the verification yourself if you want, then "Approve" lands it. Continue through all 8 commits.
- **"Approve with overrides"** → e.g., "skip the PWA assets (commit 8); do them later" or "merge commits 1-2 into a single commit". I document the override.
- **"Reject PIA-MUR-D-004-IMPL: <reason>"** → e.g., "too many commits; condense to 4" or "skip the citation sheet redesign (commit 6); keep the existing dialog". I revise.
- **"Defer PIA-MUR-D-004-IMPL"** → I save the packet as a future reference; no implementation begins. The workflow remains in `preflight-report-review`.

## 13. Out of scope

- **Real iPhone DPC-11 PWA install check** (manual; not in this packet).
- **DPC-1 sheet focus remaining issue** (prototype issue; can be fixed in a follow-up or deferred to the implementation).
- **CI integration of the pre-flight harness** (out of scope per PIA-MUR-D-016; future ADR).
- **DPC-2 native dialog focus** (BLOCKED; deferred to authenticated integration tests).
- **DPC-5 pixel-perfect visual diff** (manual; the 6 PNGs and 6 SVGs are committed for reference).
- **PIA-MUR-D-006 (iOS dialog focus), PIA-MUR-D-007 (reduce-motion in PWA), PIA-MUR-D-008 (active-workspace endpoint)** — separate follow-up decisions if needed.
- **Reverting the prototype's Stream concept** — the prototype remains the source of truth for the visual design; the implementation mirrors it.
