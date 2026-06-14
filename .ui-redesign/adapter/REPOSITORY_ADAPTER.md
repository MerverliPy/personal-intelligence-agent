# Repository Adapter

Status: `APPROVED`
Adapter ID: `PIA-MUR-ADAPTER-001`
Repository: `personal-intelligence-action-engine` (Personal Intelligence and Action Engine / PIA)
Commit baseline: `ef6a910` on branch `chore/install-mobile-ui-redesign-system`
Approved by: user
Approved at: 2026-06-14
Approved decision: PIA-MUR-D-001 (see `.ui-redesign/decisions/DECISION_LEDGER.md`)

> **Scope:** This adapter authorizes the **detected operating context** and the **baseline phase only**. It does **not** authorize any product-code changes. All implementation, dependency, schema, route, auth, infrastructure, and deployment changes require separate decisions and contracts.

---

## Product

- **Product purpose:** Private, evidence-grounded LLM/agent platform that ingests documents into workspace-isolated knowledge bases, retrieves grounded answers with citations, runs assistant conversations across multiple modes (Ask / Research / Analyze / Plan / Execute / Learn), and captures user feedback to improve future responses. Governance is enforced via append-only audit, durable outbox jobs, sensitivity-class-aware routing, and workspace-scoped RBAC.
- **Primary user classes:** Authenticated workspace members working with their own documents and conversations; a workspace owner/admin who configures membership; downstream P4 memory consumers and P5 tool-gateway consumers (shell, not yet implemented).
- **Critical user outcomes:**
  - Sign in via OIDC, see a list of workspaces, select one.
  - Upload documents, watch them move through `uploaded → processing → ready`, view their chunks.
  - Search across the workspace's knowledge base with retrieved chunks and scores.
  - Start conversations in one of six modes; stream assistant responses; see citations as chips that open a modal with the source claim, locator, and verification status.
  - Submit categorized feedback (`POSITIVE`, `NEGATIVE`, `INCORRECT`, `INCOMPLETE`, `CITATION_ISSUE`, `STYLE_ISSUE`, `UNSAFE`, `FREE_TEXT`) on each assistant message.
- **Highest-priority screens and flows** (current routes, server-rendered HTML):
  - `GET /` → 302 → `GET /app` (PIA shell, shows workspaces).
  - `GET /app/workspaces/:wid/documents` (document list with status badges).
  - `GET /app/workspaces/:wid/documents/:did` (document detail with chunks and metadata).
  - `GET /app/workspaces/:wid/upload` (file upload form, progress).
  - `GET /app/workspaces/:wid/search` (search form, results with score bars).
  - `GET /app/workspaces/:wid/conversations` (conversation list with mode selector).
  - `GET /app/workspaces/:wid/conversations/:cid` (message thread, SSE stream, citation modal, feedback form).
- **Network requirement:** Online-only. The redesign is a **network-required PWA** (no offline scope). All data, models, and retrieval go through the API.
- **PWA intent:** None today. The redesign is the **introduction** of a network-required PWA optimized for iPhone 16 Pro portrait, installed via "Add to Home Screen".

---

## Repository structure

- **Frontend root:** `apps/web/` (TypeScript module exporting HTML string builders; consumed by API).
- **Backend root:** `apps/api/` (Fastify HTTP server; serves both the web shell and the JSON API).
- **Worker root:** `apps/worker/` (background job consumer; outbox polling).
- **Shared packages:** `packages/{auth,config,contracts,db,domain,audit,observability,storage,jobs,knowledge,evals,ai,memory,tools}`.
- **Design-system location:** **None today.** The current "design system" is the inline `sharedCss` string in `apps/web/src/pages/shared.ts:8-66`. There are no token files, no Tailwind config, no design-system package, no Storybook, no Figma.
- **Test locations:** `apps/*/test/`, `packages/*/test/`, `test/e2e/`, `test/security/`, `evals/retrieval/`, `evals/answers/`.
- **Documentation locations:** `docs/00-09_*.md` (authoritative specs), `docs/adr/`, `docs/development/`, `docs/security/`, `docs/REPOSITORY_DOCUMENTATION_WORKFLOW.md`, `MANIFEST.md`, `README.md`, `AGENT_HANDOFF.md`, `AGENTS.md`, `planning/backlog.yaml`, `planning/status.yaml`, `planning/runs/`, `planning/reviews/`.
- **Build output:** `dist/` (per-package), `.turbo/` cache. Currently apps use **echo stubs** for `build` (AUD-P3-105).
- **Generated files:** `node_modules/`, `.turbo/`, `dist/`, `.next/` (n/a — no Next.js), `coverage/`, `ci-output/`, `test-results/`, `benchmark_out/`, `.venv/`, `__pycache__/`.

---

## Stack detection

- **Package manager:** pnpm 9.15.9 (workspaces, `pnpm-workspace.yaml`).
- **Runtime:** Node.js 22.22.3 (`.nvmrc` requires `>=22`).
- **Frontend framework:** **No framework.** `@pia/web` is a TypeScript module that exports HTML string builders (server-rendered by the API). NOT Next.js, NOT Vite, NOT any SPA. Despite some legacy doc references calling it "Next.js App Router", no Next.js dependency exists.
- **Styling system:** **Inline CSS in a string constant** (`apps/web/src/pages/shared.ts:8-66`). No CSS-in-JS, no Tailwind, no PostCSS, no design tokens.
- **State management:** **None on the client.** All state is in the DOM; the page loads data via `apiFetch()` from injected module scripts. Server state is held by the API and Fastify plugins.
- **Routing:** API-side route registration via Fastify plugins (`apps/api/src/server.ts`); HTML pages are served by `apps/api/src/routes/web*.ts`. The "SPA" navigation is a set of `location.href` assignments in client scripts — no client-side router.
- **API architecture:** Fastify 5.8.5 + fastify-plugin 6, JSON-only at `/v1/*`, SSE for conversation streams. OpenAPI 3.1 contract at `api/openapi.yaml` (37 operations).
- **Authentication:** OIDC (Keycloak) with a fake provider for dev (`createFakeOidcClient`, `InMemoryLoginTransactionStore`). JWT cookies via `@fastify/cookie` + `@pia/auth` plugin. RBAC at route, service, and DB layers; workspace authorization via `requireWorkspaceContext`; DB RLS policies on tenant-scoped tables.
- **Persistence:** PostgreSQL 17 + pgvector (drizzle-free, hand-written pg queries in `@pia/db`); Redis 7 (rate limit, idempotency); MinIO/S3 (signed uploads, `@pia/storage`).
- **PWA implementation:** **None.** No `manifest.webmanifest`, no `service-worker.*`, no `sw.js`, no `sw.ts`, no `workbox-*`, no `next-pwa`, no `vite-plugin-pwa`, no `serwist`. No `viewport-fit=cover`, no `theme-color`, no `apple-touch-icon`, no `safe-area-inset` CSS. **Clean-slate baseline.**
- **Existing browser automation:** **None.** CI has no Playwright, Cypress, axe-core, Lighthouse, or Puppeteer (`.github/workflows/ci.yaml` covers format, lint, typecheck, unit tests, build, secret scan, dependency audit only). No browser binary on the host (`which playwright chromium chrome firefox safari` returns nothing).
- **Existing accessibility tooling:** **Static-only.** `apps/web/test/a11y-static.test.ts` asserts that buttons have accessible text/aria-label, inputs have associated labels, no positive tabindex, headings descend, navigation landmark present, citation modal uses native `<dialog>`, message thread has `role="log"` + `aria-live`. **No axe-core, no browser-based a11y validation, no color-contrast measurement, no focus-trap tests.**
- **Existing performance tooling:** **None** in the web app. `@pia/observability` has structured logging, correlation context, and redaction, but no web-vitals, no Lighthouse runs, no bundle-size budgets.

---

## Commands

| Purpose | Command | Working directory | Mutates files | Approval | Notes |
|---|---|---|---|---|---|
| Install | `pnpm install` | repo root | yes | **required** | First-time setup |
| Install (frozen) | `pnpm install --frozen-lockfile` | repo root | no | allowed | Matches CI; reproducible |
| Start deps | `./scripts/dev/start-deps.sh` | repo root | yes | **required** | Currently deps are already up |
| Stop deps | `./scripts/dev/stop-deps.sh` | repo root | maybe | **required** | |
| Teardown deps | `./scripts/dev/teardown-deps.sh` | repo root | yes | **required** | Destructive; `opencode.jsonc` flags `docker compose down -v*` as ask |
| Start API (dev) | `pnpm --filter @pia/api dev` (echo stub today) | `apps/api` | no | **required** if network-exposed | Live API already on :3000 (PID 216180) |
| Build | `pnpm build` (= `turbo run build`) | repo root | maybe | **required** | Apps use echo stubs |
| Lint | `pnpm lint` | repo root | no | allowed | |
| Typecheck | `pnpm typecheck` | repo root | no | allowed | |
| Unit tests | `pnpm test:unit` | repo root | no | allowed | 921 tests, all green per P3-GATE |
| Integration tests | `pnpm test:integration` | repo root | maybe | **required** | Requires live DB+Redis+MinIO |
| E2E tests | `pnpm test:e2e` | repo root | maybe | **required** | 1 journey, green per P3-GATE |
| Security tests | `pnpm test:security` | repo root | maybe | **required** | 13/13, green per P3-GATE |
| Retrieval eval | `pnpm eval:retrieval` | repo root | maybe | **required** | 11/11, green per P3-GATE |
| Answer eval | `pnpm eval:answers` | repo root | maybe | **required** | 11/11 evaluated; `exit 2` is by-design for security-critical cases |
| Format check | `pnpm format:check` | repo root | no | allowed | |
| Format fix | `pnpm format:fix` | repo root | yes | **required** | |
| Secret scan | `pnpm security:secrets` | repo root | no | allowed | |
| Dependency audit | `pnpm security:dependencies` | repo root | no | allowed | |
| DB migrate (test) | `pnpm db:migrate:test` | repo root | yes | **required** | |
| CI simulator | `pnpm ci:check` (= `bash scripts/ci/check-all.sh`) | repo root | maybe | **required** | |
| Bridge to iPhone | `cloudflared tunnel --no-autoupdate --url http://localhost:3000` | repo root or anywhere | no | **required** | Quick-tunnel; output URL goes to evidence |
| Governance validation | `pnpm exec tsx scripts/ci/validate-status.ts` | repo root | no | allowed | |

**Disabled / denied commands (per `opencode.jsonc`):** `git push*`, `git reset*`, `git clean*`, `git restore*`, `git checkout*`, `git switch*`, `git rebase*`, `git merge*`, `git cherry-pick*`, `git stash*`, `rm -rf *`, `sudo *`, `terraform apply/destroy`, `pulumi up/destroy`, `kubectl apply`, `helm upgrade`, `npm/pnpm publish`.

---

## Runtime access

- **Local URL:** `http://localhost:3000` (API live; serves web pages and JSON).
- **LAN URL:** `http://<host-LAN-IP>:3000` (Fastify binds `0.0.0.0:3000`). Host LAN IP not yet captured.
- **Secure tunnel:** `https://<random>.trycloudflare.com` via `cloudflared quick-tunnel` (primary bridge for installed-PWA validation).
- **Staging URL:** None yet (P7 deliverable).
- **Installed-PWA launch URL:** `https://<random>.trycloudflare.com` (Safari → Share → Add to Home Screen → launch from Home Screen). **HTTPS required for service-worker registration.**
- **HTTPS requirement:** Yes for service worker, push, install banners, and many PWA APIs. The local API is HTTP; the cloudflared quick-tunnel upgrades it to HTTPS automatically.
- **CORS constraints:** API serves same-origin pages from the web routes; the `/v1/*` JSON API is consumed same-origin via `apiFetch(path)`. Cross-origin exposure is not required for the redesign.
- **Browser test method:** **None today.** Desktop browser testing would be manual (host has no browser binary). Mobile testing requires the cloudflared bridge + physical iPhone 16 Pro.
- **Physical-device bridge:**
  - **Primary (installed PWA):** `cloudflared quick-tunnel` to a public HTTPS URL → iPhone Safari → Add to Home Screen.
  - **Secondary (Safari browser, fast):** Tailscale direct `http://100.81.83.98:3000` (host on `tailscale0`); suitable only for HTTP-based Safari testing, not installed-PWA validation.
  - **Confirmation required:** physical iPhone 16 Pro presence and its network reachability to the bridge are UNCONFIRMED.

---

## Real data

- **Environment:** Local development (docker compose) — **currently live**: API PID 216180, Postgres PID 978, Redis PID 198199, MinIO PID 199086. `/health/live` and `/health/ready` return 200.
- **Data source:** PostgreSQL 17 + pgvector (via `@pia/db`); Redis 7 (rate limit, idempotency keys); MinIO (S3-compatible, `@pia/storage`).
- **Authentication method:** OIDC (Keycloak) with fake provider in dev; dev bypass returns `sub=dev-user-1, email=dev@localhost`; JWT cookie session.
- **Read/write authority:** All write endpoints require authenticated session + workspace membership. Cross-tenant data access is enforced at three layers: (1) `workspace_id` FK constraints, (2) DB-level RLS policies, (3) application-layer checks. Free-text feedback content is stored verbatim (render layer escapes); classifier signature explicitly does not inspect free-text (P3-T08 security hardening). Provider errors are truncated to 200 chars (orchestrator:524-532) — AUD-P3-102.
- **Sensitive fields:** Session cookies, OIDC tokens, embedding vectors (sensitivity-class-gated), user-submitted documents, free-text feedback.
- **Redaction policy:** Logger redaction in `@pia/observability`; provider-error truncation in `@pia/ai` orchestrator. **No screenshots, recordings, or evidence may include session cookies, tokens, or user-submitted free-text content.** Real-data evidence must use test accounts with synthetic content (per `evals/answers/datasets/*.yaml` patterns).
- **Data unavailable behavior:** **BLOCK — never invent.** If real data is unavailable (DB down, dev user not provisioned), the workflow stops and the user is informed; no mock data, no fabricated acceptance data.

---

## Protected areas

| Area | Paths/interfaces | Reason | Required approval |
|---|---|---|---|
| Authentication | `apps/api/src/routes/auth.ts`, `apps/api/src/plugins/auth.ts`, `packages/auth/src/`, `apps/api/src/plugins/cookie.ts` | Identity, session, OIDC flow | **separate** |
| Authorization | `packages/domain/src/`, `packages/db/src/membership*`, `apps/api/src/plugins/workspace-context.ts` | RBAC, workspace isolation | **separate** |
| Public API contract | `api/openapi.yaml`, `apps/api/src/routes/*.ts` (except `web*.ts`) | Breaking changes affect all clients | **separate** |
| Database schema | `db/schema.sql`, `db/migrations/`, `packages/db/src/migrations/` | Forward + rollback reasoning required | **separate** |
| Infrastructure | `infra/`, `compose.yaml`, `.github/workflows/`, `Dockerfile`s | Provisioning, deploy | **separate** |
| Deployment | `apps/*/Dockerfile`, `.github/workflows/`, `package.json` `deploy` scripts | Production risk | **separate** |
| Existing tests | `apps/*/test/`, `test/e2e/`, `test/security/`, `packages/*/test/`, `evals/{retrieval,answers}/` | Baseline protection; no silent removal | **contract** (no silent changes) |
| Credentials | `.env`, `.env.*`, `*.pem`, `*.key`, `*credentials*`, `.opencode/run-logs/cookies.txt` | Never read, never modify, never include in evidence | **NEVER** |
| Documentation | `AGENTS.md`, `AGENT_HANDOFF.md`, `README.md`, `MANIFEST.md`, `docs/`, `planning/` | Governance, run records, manifest | per doc-workflow policy |
| Workflow config | `opencode.json`, `opencode.jsonc`, `.opencode/agents/`, `.opencode/commands/`, `.opencode/skills/`, `.ui-redesign/` | Orchestrator + specialist config | **separate** for any change |

---

## Git policy

- **Branch strategy:** Single working branch `chore/install-mobile-ui-redesign-system` for the adapter-and-baseline setup commit; cut a dedicated redesign branch (`redesign/mobile-ui-pia-mur-001` suggested) **after** adapter approval and **before** baseline work begins, so each redesign artifact (adapter, baseline, design contract, implementation contract) becomes its own commit.
- **Worktree strategy:** No parallel worktrees detected. If parallelism emerges, use `git worktree add` per-artifact and merge sequentially.
- **Commit convention:** Conventional commits (`chore:`, `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `audit:`). Each commit must reference the decision or contract ID it implements. Atomic commits only.
- **Pull-request timing:** **No PR is opened during adapter or baseline phases.** The first PR is opened at the end of the **evidence-bundle** phase, with the full evidence manifest and rollback instructions.
- **Protected branches:** `main` is implicitly protected (no push per `opencode.jsonc` deny rules).
- **Required checks (existing CI):** format, lint, typecheck, unit, build, secrets, dependency audit, governance validation. **Adding browser/E2E to CI requires Playwright + axe-core approval and security review.**
- **Rollback method:** `git revert <commit>` for commits on this branch; `git restore` (deny) is replaced by individual commit reverts. For destructive changes (DB migrations, infrastructure), document a forward-rollback path in the run record.

---

## Device matrix

| Environment | Priority | Required status | Notes |
|---|---:|---|---|
| iPhone 16 Pro Safari portrait | primary | **mandatory** | UNCONFIRMED physical device (B-1); bridge: cloudflared quick-tunnel |
| iPhone 16 Pro installed PWA portrait | primary | **mandatory** | UNCONFIRMED physical device (B-1); requires HTTPS (cloudflared provides) |
| iPhone 16 Pro iOS Chrome portrait | secondary | **mandatory** | UNCONFIRMED (B-1); iOS Chrome is a third-party browser; same viewport/DOM as Safari for our purposes |
| iPhone 15 / 14 / 13 / SE | compatibility | **mandatory** | UNCONFIRMED (B-1); ensure no iPhone 16 Pro-only assumptions |
| Desktop responsive browser (Chromium, Firefox, Safari) | compatibility | repository-defined | **No browser binary on host.** Automated validation would require Playwright + axe-core as a new dependency (B-6). |
| Android Chrome / Samsung Internet | compatibility | optional | Out of scope for v1 of the redesign; not in matrix until v1 ships |

---

## Approval

This adapter authorizes the detected operating context and the next **baseline** phase only. It does **not** authorize product-code changes, dependency additions, schema changes, route changes, API contract changes, auth/authorization changes, or infrastructure changes. All of those require separate decisions and contracts.

**Required pre-approvals before the next phase can begin:**

1. **Approve PIA-MUR-ADAPTER-001** as `PROPOSED → APPROVED` with commit baseline `ef6a910`.
2. **Confirm physical iPhone 16 Pro availability** and its network reach to the chosen bridge (cloudflared or Tailscale).
3. **Approve deletion of the stray `tatus --short` file** (3,859 B, captured `git status --short` output, no secrets, safe to delete).
4. **Approve `.gitignore` addition for `.opencode/run-logs/`** to defensively exclude `cookies.txt` from any future commit.
5. **Resolve the `mobile-ui-design-contract` command gap** (create the command, or document its absence as accepted and dispatch via orchestrator).
6. **Confirm the dependency-approval policy** for adding Playwright + axe-core to support automated a11y/visual evidence at the G7 gate (CI has none today).
7. **Decide on `opencode.json` vs `opencode.jsonc` canonicalization** (ADR; not blocking baseline but should not be silently resolved).

---

## Detected evidence and verification status

- ✅ Verified by orchestrator + `repository-discovery` specialist on 2026-06-14.
- ✅ P3-GATE baseline: 921/921 unit, 13/13 security, 1/1 e2e, 11/11 retrieval, 11/11 answers; all CI quality gates pass.
- ✅ Runtime is live: API on `:3000`, Postgres on `:5432`, Redis on `:6379`, MinIO on `:9000`/`:9001`.
- ✅ No PWA assets exist; no `@media (hover: none)` / `@media (pointer: coarse)` / `safe-area-inset` / `touch-action` styling.
- ✅ All 11 subagent specialists installed; 10 of 11 workflow commands present; `mobile-ui-design-contract` missing.
- ⚠ Physical iPhone 16 Pro presence UNCONFIRMED (B-1).
- ⚠ `.opencode/run-logs/cookies.txt` contains a real session cookie (B-3).
- ⚠ `opencode.json` vs `opencode.jsonc` ambiguity (B-4).
- ⚠ `AGENT_HANDOFF.md` mislabels `@pia/web` as Next.js (B-5; low-risk documentation drift).
- ⚠ Dependency policy for Playwright + axe-core not established (B-6).
