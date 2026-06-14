# Repository Baseline (PIA Mobile UI Redesign)

**Status:** `CAPTURED`
**Baseline commit:** `ef6a910` (the `db76db2` adapter-adoption commit does not change product code)
**Captured at:** 2026-06-14
**Captured by:** `mobile-ui-orchestrator` (read-only; no product code modified)
**Decision ID:** `PIA-MUR-D-001` (authorizes the baseline phase)
**Next gate:** product-model (`PIA-MUR-D-002` to be opened after this baseline is approved)

> **Scope:** This document records the **current** state of the running
> application, the **current** HTML/CSS/viewport behavior, and the
> **current** PWA and accessibility surface. It does not propose changes
> to product code. All changes require separate decisions and contracts.

---

## 1. Real runtime evidence

Captured via orchestrator `curl` probes against `http://localhost:3000`
on 2026-06-14. Raw evidence: `.ui-redesign/evidence/automated/http-baseline-probes.json`.

| Component | Status | Evidence |
|---|---|---|
| API | LIVE | PID 216180; `GET /health/live` → 200 OK |
| Database | REACHABLE | `GET /health/ready` → `{"status":"ok","checks":{"database":"ok"}}` |
| Redis | UP (inherited) | PID 198199 (per workflow-state.json; not re-probed) |
| MinIO | UP (inherited) | PID 199086 (per workflow-state.json; not re-probed) |
| Authentication | ENFORCED | All `/v1/*` routes return 401 with structured error envelope |

### Public routes (unauthenticated)

| Path | Status | Content type | Size |
|---|---:|---|---:|
| `/` | 302 → `/app` | — | — |
| `/app` | 200 | `text/html` | 4,538 B |
| `/health/live` | 200 | `application/json` | 18 B |
| `/health/ready` | 200 | `application/json` | 35 B |

### Workspace routes (server-rendered shell, no auth at render time)

All 6 workspace pages return **200 OK with HTML** even when the
workspace ID does not exist (`ws-baseline-probe` placeholder). The
shell is always rendered; workspace existence is validated **client-side**
via `apiFetch('/v1/workspaces/:wid/...')`, which returns 401
unauthenticated.

| Path | Size (B) |
|---|---:|
| `/app/workspaces/:wid/documents` | 11,491 |
| `/app/workspaces/:wid/documents/:did` | *(sized; not recorded)* |
| `/app/workspaces/:wid/upload` | 13,574 |
| `/app/workspaces/:wid/search` | 13,892 |
| `/app/workspaces/:wid/conversations` | 10,882 |
| `/app/workspaces/:wid/conversations/:cid` | **21,841** (largest) |

### API routes (auth-protected)

| Path | Status | Notes |
|---|---:|---|
| `/v1/me` | 401 | `{"error":{"code":"UNAUTHORIZED","message":"Authentication required.","request_id":"<redacted>"}}` |
| `/v1/workspaces` | 401 | same envelope |
| `/v1/workspaces/:wid/documents` | 401 | same envelope |
| `/v1/workspaces/:wid/conversations` | 401 | same envelope |
| `/openapi.yaml` | 404 | contract exists at `api/openapi.yaml` on disk; not served from this path |

### Auth routes

| Path | Status | Notes |
|---|---:|---|
| `/auth/login` | 302 | redirects to OIDC provider |
| `/auth/callback` | 400 | expected 400 for direct callback without state |
| `/auth/logout` | 404 | **not implemented** (gap to flag for product model) |

---

## 2. PWA and mobile evidence (served HTML)

All 6 served HTML pages were inspected for PWA and mobile-specific
markers. **All markers are absent.**

| Marker | Status |
|---|---|
| `<meta name="viewport" ...>` | Present, bare: `width=device-width, initial-scale=1.0` |
| `viewport-fit=cover` | **absent** |
| `theme-color` | **absent** |
| `apple-touch-icon` | **absent** |
| `<link rel="manifest">` | **absent** |
| `<link rel="serviceworker">` | **absent** |
| `safe-area-inset` references | **0** |
| `touch-action` references | **0** |
| `@media (hover: none)` references | **0** |
| `@media (pointer: coarse)` references | **0** |

### PWA assets (all 404 — clean-slate baseline)

| Path | Status |
|---|---:|
| `/manifest.webmanifest` | 404 |
| `/manifest.json` | 404 |
| `/service-worker.js` | 404 |
| `/service-worker.ts` | 404 |
| `/sw.js` | 404 |
| `/sw.ts` | 404 |
| `/apple-touch-icon.png` | 404 |
| `/apple-touch-icon-precomposed.png` | 404 |
| `/favicon.ico` | 404 |

---

## 3. Security headers (served HTML)

| Header | Value |
|---|---|
| `x-content-type-options` | `nosniff` |
| `x-frame-options` | `DENY` |
| `referrer-policy` | `strict-origin-when-cross-origin` |
| `permissions-policy` | `camera=(), microphone=(), geolocation=(), interest-cohort=()` |
| `content-security-policy` | `default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; form-action 'self'` |
| `strict-transport-security` | absent (expected on HTTP) |

### CSP observation

`script-src 'self' 'unsafe-inline'` is permissive. **A service-worker
registration will require revisiting the CSP** — service workers need
a registered script that is `'self'` (or nonced); `'unsafe-inline'`
permits inline scripts but does not by itself block SW registration,
yet many SW tutorials recommend tightening this in tandem with SW
introduction. This is a **design-contract** concern, not a
baseline-blocker.

### Inline scripts in served HTML

`apps/web/src/pages/shared.ts:186-189` and the `web.ts` route inject
`<script type="module">` blocks with shared JavaScript and
per-page scripts. Service-worker registration will need to coexist
with these modules.

---

## 4. Source-code baseline (read-only inspection)

### Frontend (`apps/web/`)

- **No framework.** Plain TypeScript module exporting HTML string builders.
- **No bundler.** `package.json` has `build: "echo 'web: nothing to build' && exit 0"`.
- **No PWA dependencies.** No `next-pwa`, `vite-plugin-pwa`, `workbox-*`, `serwist`.
- **No design tokens.** All CSS is inline in `sharedCss` (`apps/web/src/pages/shared.ts:8-66`).
- **No mobile-specific styles.** Confirmed by grep across `apps/web/src/pages/*.ts`.

### Backend (`apps/api/`)

- Fastify 5.8.5, no changes detected.
- OIDC authentication plugin in `apps/api/src/plugins/auth.ts`.
- Web routes serve HTML pages; JSON routes under `/v1/*`.

### Dependencies

- All inherited P3-GATE dependencies are unchanged.
- No new dependencies added during the redesign (B-6 still pending).

---

## 5. Confirmed P3-GATE baseline (inherited)

Per `planning/runs/P3-GATE.md:42-56` (executed 2026-06-13):

| Check | Result |
|---|---|
| Format | PASS |
| Lint | PASS (17/17 packages, 0 errors) |
| Typecheck | PASS (29/29 tasks) |
| Unit tests | PASS (921/921) |
| Build | PASS (17/17 echo-stub) |
| Secrets scan | PASS |
| Dependency audit | PASS (no production vulns; 2 dev-only) |
| Governance validation | PASS (64 tasks, 8 phases, 8 gates) |
| Retrieval eval | PASS (11/11) |
| Answer eval | PASS (11/11) |
| E2E | PASS (1/1) |
| Security | PASS (13/13) |

No redesign work has touched product code; this baseline is still valid.

---

## 6. Open gaps (for the design-contract phase, not baseline-blockers)

These gaps will be raised in the product-model and design-contract
decisions. They are NOT blockers for baseline.

1. **No PWA manifest.** Required for "Add to Home Screen" installability.
2. **No service worker.** Required for offline-cached shell + secure-context features.
3. **No `viewport-fit=cover` / safe-area insets.** Required for edge-to-edge layout on iPhone 16 Pro with Dynamic Island.
4. **No `theme-color` / `apple-touch-icon`.** Required for Home-Screen icon appearance and Safari chrome color.
5. **No touch-target / mobile-first layout.** `.container { max-width: 960px }` is desktop-first.
6. **No axe-core / no browser-based a11y validation.** Only static checks exist.
7. **No service-worker-aware CSP.** Will need tightening.
8. **No HSTS.** Will appear automatically when served via HTTPS (cloudflared).
9. **`/auth/logout` not implemented.** 404.
10. **`/openapi.yaml` not served.** Contract is at `api/openapi.yaml` on disk; not exposed.
11. **Largest page 21,841 B uncompressed.** For mobile networks, compression and per-page size budgets will need explicit targets.

---

## 7. Blocker status (unchanged from adapter)

| ID | Title | Status |
|---|---|---|
| B-1 | Physical iPhone 16 Pro availability UNCONFIRMED | open |
| B-2 | `mobile-ui-design-contract` command missing | open |
| B-3 | `.opencode/run-logs/cookies.txt` real session cookie | mitigated (defensive `.gitignore`); never read, never committed |
| B-4 | `opencode.json` vs `opencode.jsonc` ambiguity | open (ADR) |
| B-5 | `AGENT_HANDOFF.md` mislabels `@pia/web` as Next.js | open (low-risk docs) |
| B-6 | Playwright + axe-core dependency-approval policy | open |

---

## 8. Evidence manifest reference

| Artifact | Path |
|---|---|
| HTTP probes (raw) | `.ui-redesign/evidence/automated/http-baseline-probes.json` |
| Evidence index | `.ui-redesign/evidence/automated/README.md` |
| Feature-parity matrix | `.ui-redesign/contracts/FEATURE_PARITY_MATRIX.md` |
| Decision ledger | `.ui-redesign/decisions/DECISION_LEDGER.md` |
| Workflow state | `.ui-redesign/state/workflow-state.json` |
| Adapter | `.ui-redesign/adapter/REPOSITORY_ADAPTER.md` |
| P3-GATE run record | `planning/runs/P3-GATE.md:42-56` |
| AGENT_HANDOFF (pre-existing) | `AGENT_HANDOFF.md` (modified; not in scope for redesign) |
