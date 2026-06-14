# Feature-Parity Matrix

Baseline commit: `ef6a910` on `chore/install-mobile-ui-redesign-system`
Target commit: *(pending — will be set on first implementation-contract approval)*
Baseline evidence: `.ui-redesign/baseline/REPOSITORY_BASELINE.md` (captured 2026-06-14, decision PIA-MUR-D-001)

| Feature or behavior | Current route/screen | Current evidence | Planned disposition | Decision ID | Automated evidence | Device evidence | Status |
|---|---|---|---|---|---|---|---|
| Workspace shell (PIA landing) | `GET /` → `GET /app` | `apps/api/src/routes/web.ts:12-15`; `apps/web/src/index.ts`; HTTP probe 200 (4538 B) | TBD | — | P3-GATE.md:42-56; http-baseline-probes.json:public_routes | UNCONFIRMED (B-1) | `UNCHANGED` (baseline) |
| Workspaces list (after sign-in) | `GET /app` (in-page `apiFetch('/v1/workspaces')`) | `apps/api/src/routes/web.ts:50-95`; `/v1/workspaces` returns 401 unauthenticated | TBD | — | P3-GATE.md:42-56; http-baseline-probes.json:api_routes | UNCONFIRMED (B-1) | `UNCHANGED` (baseline) |
| Document list | `GET /app/workspaces/:wid/documents` | `apps/api/src/routes/web-documents.ts`; `apps/web/src/pages/document-list.ts`; HTTP probe 200 (11,491 B) | TBD | — | 51 web unit tests; http-baseline-probes.json:workspace_routes | UNCONFIRMED (B-1) | `UNCHANGED` (baseline) |
| Document detail (chunks) | `GET /app/workspaces/:wid/documents/:did` | `apps/api/src/routes/web-documents.ts`; `apps/web/src/pages/document-detail.ts` | TBD | — | unit + e2e | UNCONFIRMED (B-1) | `UNCHANGED` (baseline) |
| Document upload | `GET /app/workspaces/:wid/upload` | `apps/api/src/routes/web-documents.ts`; `apps/web/src/pages/upload.ts`; HTTP probe 200 (13,574 B) | TBD | — | unit + integration | UNCONFIRMED (B-1) | `UNCHANGED` (baseline) |
| Knowledge-base search | `GET /app/workspaces/:wid/search` | `apps/api/src/routes/web-documents.ts`; `apps/web/src/pages/search.ts`; HTTP probe 200 (13,892 B) | TBD | — | retrieval eval 11/11 | UNCONFIRMED (B-1) | `UNCHANGED` (baseline) |
| Conversation list (with mode selector) | `GET /app/workspaces/:wid/conversations` | `apps/api/src/routes/web-conversations.ts`; `apps/web/src/pages/conversation-list.ts`; HTTP probe 200 (10,882 B) | TBD | — | 51 web unit tests | UNCONFIRMED (B-1) | `UNCHANGED` (baseline) |
| Conversation detail (SSE, citation modal, feedback form) | `GET /app/workspaces/:wid/conversations/:cid` | `apps/web/src/pages/conversation-detail.ts`; HTTP probe 200 (21,841 B — **largest**) | TBD | — | unit + e2e + security 13/13 | UNCONFIRMED (B-1) | `UNCHANGED` (baseline) |
| PWA installation (iPhone Safari → Add to Home Screen) | — | `/manifest.webmanifest`, `/service-worker.js`, `/sw.js`, `/apple-touch-icon.png`, `/favicon.ico` all 404; no `<link rel="manifest">` in any served HTML | TBD | — | http-baseline-probes.json:pwa_assets (all 404) | UNCONFIRMED (B-1) | `REPLACED` (intent) — clean slate |
| `viewport-fit=cover` / safe-area / Dynamic Island | — | 0 safe-area refs, 0 touch-action refs, 0 @media (hover: none), 0 @media (pointer: coarse); viewport meta is `width=device-width, initial-scale=1.0` only | TBD | — | http-baseline-probes.json:html_evidence_all_screens | UNCONFIRMED (B-1) | `REPLACED` (intent) — clean slate |
| Mobile-first layout / touch targets | — | `.container { max-width: 960px }` (desktop-first); no touch-target sizing | TBD | — | http-baseline-probes.json | UNCONFIRMED (B-1) | `REPLACED` (intent) — clean slate |
| `theme-color` / `apple-touch-icon` | — | Both absent in served HTML | TBD | — | http-baseline-probes.json | UNCONFIRMED (B-1) | `REPLACED` (intent) — clean slate |
| Keyboard / focus / external-keyboard a11y (iOS) | — | `apps/web/test/a11y-static.test.ts` (static only); no axe-core, no focus-trap test, no browser-based a11y validation | TBD | — | static a11y only | UNCONFIRMED (B-1) | `IMPROVED` (intent) |
| Service worker (offline-cached shell) | — | None. Note: redesign is **network-required PWA** (no offline scope); service worker is still useful for fast shell + Add to Home Screen installability | TBD | — | http-baseline-probes.json | UNCONFIRMED (B-1) | `IMPROVED` (intent) |
| Auth: `/auth/logout` | `/auth/logout` | HTTP probe 404 — **not implemented** | TBD | — | http-baseline-probes.json:auth_routes | UNCONFIRMED (B-1) | `BLOCKED` (gap; surfaces in product model) |
| OpenAPI contract served at runtime | `/openapi.yaml` | HTTP probe 404 (contract exists at `api/openapi.yaml` on disk) | TBD | — | http-baseline-probes.json:api_routes | UNCONFIRMED (B-1) | `BLOCKED` (gap; out of redesign scope) |
| CSP — service-worker-compatible | `script-src 'self' 'unsafe-inline'` | Inline scripts present in served HTML (`sharedJs`, `bodyScript`); service worker registration will need to coexist | TBD | — | http-baseline-probes.json:security_headers.csp_observation | UNCONFIRMED (B-1) | `IMPROVED` (intent; design-contract) |

Statuses:

- `UNCHANGED` — feature stays as-is in redesign.
- `IMPROVED` — feature stays but is enhanced in redesign.
- `MOVED` — feature relocates (e.g., to a bottom tab, sheet, or new URL).
- `COMBINED` — multiple features merge in redesign.
- `REPLACED` — feature is removed and replaced by something materially different.
- `REMOVED_WITH_APPROVAL` — feature is removed after explicit user approval.
- `BLOCKED` — feature cannot ship until a blocker is resolved.
- `REGRESSION` — feature once passed but now fails automated/device check.
