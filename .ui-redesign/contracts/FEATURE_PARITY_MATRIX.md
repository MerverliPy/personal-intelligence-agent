# Feature-Parity Matrix

Baseline commit: `ef6a910` on `chore/install-mobile-ui-redesign-system`
Target commit: *(pending — will be set on first implementation-contract approval)*

| Feature or behavior | Current route/screen | Current evidence | Planned disposition | Decision ID | Automated evidence | Device evidence | Status |
|---|---|---|---|---|---|---|---|
| Workspace shell (PIA landing) | `GET /` → `GET /app` | `apps/api/src/routes/web.ts:12-15`; `apps/api/src/server.ts` (Fastify); `apps/web/src/index.ts` (re-exports pageShell) | TBD | — | `planning/runs/P3-GATE.md:42-56` (CI gates) | UNCONFIRMED (B-1) | `UNCHANGED` (baseline) |
| Workspaces list (after sign-in) | `GET /app` (in-page `apiFetch('/v1/workspaces')`) | `apps/api/src/routes/web.ts:50-95`; `@pia/api` workspace route | TBD | — | unit + integration passing | UNCONFIRMED (B-1) | `UNCHANGED` (baseline) |
| Document list | `GET /app/workspaces/:wid/documents` | `apps/api/src/routes/web-documents.ts`; `apps/web/src/pages/document-list.ts`; static a11y test in `apps/web/test/a11y-static.test.ts` | TBD | — | 51 web unit tests passing | UNCONFIRMED (B-1) | `UNCHANGED` (baseline) |
| Document detail (chunks) | `GET /app/workspaces/:wid/documents/:did` | `apps/api/src/routes/web-documents.ts`; `apps/web/src/pages/document-detail.ts` | TBD | — | unit + e2e | UNCONFIRMED (B-1) | `UNCHANGED` (baseline) |
| Document upload | `GET /app/workspaces/:wid/upload` | `apps/api/src/routes/web-documents.ts`; `apps/web/src/pages/upload.ts`; `apps/api/src/routes/uploads.ts` | TBD | — | unit + integration | UNCONFIRMED (B-1) | `UNCHANGED` (baseline) |
| Knowledge-base search | `GET /app/workspaces/:wid/search` | `apps/api/src/routes/web-documents.ts`; `apps/web/src/pages/search.ts`; `apps/api/src/routes/retrieval.ts` | TBD | — | retrieval eval 11/11 | UNCONFIRMED (B-1) | `UNCHANGED` (baseline) |
| Conversation list (with mode selector) | `GET /app/workspaces/:wid/conversations` | `apps/api/src/routes/web-conversations.ts`; `apps/web/src/pages/conversation-list.ts` | TBD | — | 51 web unit tests | UNCONFIRMED (B-1) | `UNCHANGED` (baseline) |
| Conversation detail (SSE, citation modal, feedback form) | `GET /app/workspaces/:wid/conversations/:cid` | `apps/web/src/pages/conversation-detail.ts`; `apps/web/test/citation-modal.test.ts`; `apps/web/test/feedback-form.test.ts`; `apps/web/test/sse-client.test.ts` | TBD | — | unit + e2e + security 13/13 | UNCONFIRMED (B-1) | `UNCHANGED` (baseline) |
| PWA installation (iPhone Safari → Add to Home Screen) | — | **No manifest, no service worker, no viewport-fit=cover, no theme-color, no apple-touch-icon** | TBD | — | NONE today | UNCONFIRMED (B-1) | `REPLACED` (intent) — clean slate |
| Safe-area / Dynamic Island handling | — | No `safe-area-inset` CSS anywhere; no `viewport-fit=cover` | TBD | — | NONE today | UNCONFIRMED (B-1) | `REPLACED` (intent) — clean slate |
| Touch-target / mobile-first layout | — | `.container { max-width: 960px }`; no `@media (hover: none)` / `@media (pointer: coarse)`; no `touch-action` tuning | TBD | — | NONE today | UNCONFIRMED (B-1) | `REPLACED` (intent) — clean slate |
| Keyboard accessibility (iOS external keyboard / iPhone focus) | — | `apps/web/test/a11y-static.test.ts` (static only — no axe-core, no focus-trap test) | TBD | — | static a11y only | UNCONFIRMED (B-1) | `IMPROVED` (intent) |

Statuses:

- `UNCHANGED` — feature stays as-is in redesign.
- `IMPROVED` — feature stays but is enhanced in redesign.
- `MOVED` — feature relocates (e.g., to a bottom tab, sheet, or new URL).
- `COMBINED` — multiple features merge in redesign.
- `REPLACED` — feature is removed and replaced by something materially different.
- `REMOVED_WITH_APPROVAL` — feature is removed after explicit user approval.
- `BLOCKED` — feature cannot ship until a blocker is resolved.
- `REGRESSION` — feature once passed but now fails automated/device check.
