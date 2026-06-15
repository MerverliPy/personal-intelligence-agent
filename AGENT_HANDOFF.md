# Repository Audit Agent Handoff

## Audit Summary

- **Date:** 2026-06-13
- **Repository:** Personal Intelligence and Action Engine (PIA)
- **Branch:** `main` @ `efab8b7` — clean worktree
- **Stack:** TypeScript 5.7 strict, Node.js 22.22.3, pnpm 9.15.9, Fastify, PostgreSQL 17 + pgvector, Redis 7, MinIO, Turborepo, Vitest
- **Architecture:** 3 apps (api, worker, web) composing 14 domain packages with strict dependency inversion; workspace-isolated RBAC, OIDC auth, append-only audit, durable outbox jobs, provider-neutral LLM gateway, deterministic context compiler, citation verifier, answer-scoring evaluation harness
- **Phase status:** P0 ✓ P1 ✓ P2 ✓ P3 ✓ (all four gates DONE); P4–P7 NOT_STARTED
- **Health:** All CI quality gates pass. 33 of 64 tasks complete. No secrets, no build failures, no auth bypasses, no test.skip/only patterns, no `as any` in production code.
- **Previous handoff:** `AGENT_HANDOFF.md` dated 2026-06-12 — at the time of that audit the repository was at `e209dcc` (P2-GATE closure) with P3 2/10 IN_PROGRESS and 23 of 64 tasks complete. All findings from that handoff (AUD-P2-001, AUD-P3-001) have since been resolved; AUD-P3-002 and AUD-P3-003 remain carried forward.
- **Scope inspected:** Root manifests, all CI/security scripts, compose.yaml, planning/backlog.yaml, planning/status.yaml, all 41 run records, all 39 review records, all package.json boundaries, key source paths in auth/knowledge/storage/audit/jobs/observability/config/ai/evals, API routes, db/schema.sql, db/migrations (10 files), .gitignore, .env.example, README.md, MANIFEST.md, opencode.jsonc, docs/adr/0007-path-boundary-precedent.md, evals/answers/, test/e2e/, test/security/.
- **Not inspected:** Individual migration SQL semantics, provider SDK internals, Next.js app router internals, infra/ Pulumi modules, individual file-level review of all 400+ tracked source files.
- **Commands executed (prior runs cited as evidence):** `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test:unit`, `pnpm build`, `pnpm security:secrets`, `pnpm security:dependencies`, `pnpm eval:retrieval`, `pnpm eval:answers`, `pnpm test:e2e`, `pnpm test:security`, `pnpm exec tsx scripts/ci/validate-status.ts` — full evidence in `planning/runs/P3-GATE.md:42-56`.
- **Limitations:** No PostgreSQL/Redis/MinIO running locally during this audit — integration, e2e, and security suites were not executed in this audit but have verified evidence in `planning/runs/P3-GATE.md:51-54` from the P3 closure run. `.env` file exists (931 bytes) but is gitignored and not inspected (safety boundary). Full schema reconciliation between `db/schema.sql` and 10 migration files not performed.

## Repository Map

### Applications (3)

| Path           | Package       | Purpose                                                                                              | Status |
| -------------- | ------------- | ---------------------------------------------------------------------------------------------------- | ------ |
| `apps/api/`    | `@pia/api`    | Fastify HTTP API server — auth, workspaces, uploads, documents, retrieval, conversations, feedback   | Active |
| `apps/worker/` | `@pia/worker` | Background job consumer — outbox polling, ingestion workflow, retry/dead-letter                      | Active |
| `apps/web/`    | `@pia/web`    | Next.js App Router frontend — workspaces, documents, conversations, citation UI, feedback form, a11y | Active |

### Domain Packages (14)

| Path                      | Package              | Purpose                                                                                                | Status     |
| ------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------ | ---------- |
| `packages/auth/`          | `@pia/auth`          | OIDC client, JWT sessions, RBAC, policy decisions, fake provider                                       | Active     |
| `packages/config/`        | `@pia/config`        | Typed env-var config with Redacted secret handling                                                     | Active     |
| `packages/contracts/`     | `@pia/contracts`     | Shared API types, error envelopes, pagination                                                          | Active     |
| `packages/db/`            | `@pia/db`            | PostgreSQL pool, migrations, membership + conversation + feedback repositories                         | Active     |
| `packages/domain/`        | `@pia/domain`        | Authorization types, role hierarchy, failure taxonomy                                                  | Active     |
| `packages/audit/`         | `@pia/audit`         | Append-only audit event writer, reader, redaction                                                      | Active     |
| `packages/observability/` | `@pia/observability` | Structured logger, correlation context, redaction                                                      | Active     |
| `packages/storage/`       | `@pia/storage`       | S3/MinIO adapter, signed uploads, local adapter                                                        | Active     |
| `packages/jobs/`          | `@pia/jobs`          | Outbox events, consumer, retry policies                                                                | Active     |
| `packages/knowledge/`     | `@pia/knowledge`     | Parsing, chunking, embeddings, retrieval, citations, state machine, verification                       | Active     |
| `packages/evals/`         | `@pia/evals`         | Evaluation scorers, retrieval harness runner, answer harness runner, dataset framework                 | Active     |
| `packages/ai/`            | `@pia/ai`            | Model gateway, prompt registry, context compiler, assistant orchestrator, feedback service, SSE events | Active     |
| `packages/memory/`        | `@pia/memory`        | Candidate/approved memory lifecycle                                                                    | Shell (P4) |
| `packages/tools/`         | `@pia/tools`         | Tool registry, policy engine, approvals                                                                | Shell (P5) |

### Evaluation, Test, and Architecture Decision Records

| Path                                       | Purpose                                                                                  |
| ------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `evals/retrieval/`                         | Retrieval evaluation CLI + datasets (P2-T10)                                             |
| `evals/answers/`                           | Grounded-answer evaluation CLI + datasets — 4 fixture datasets (P3-T10)                  |
| `test/e2e/`                                | End-to-end journey tests — upload-to-feedback (P3-T10)                                   |
| `test/security/`                           | Security suite — citation cross-tenant, prompt injection, provider failure, P3-T08 gap   |
| `docs/adr/0007-path-boundary-precedent.md` | Formalizes `apps/api/src/routes/web*.ts` and `db/migrations/**` path-boundary precedents |

### Infrastructure & Configuration

| Path                                     | Purpose                                                                            |
| ---------------------------------------- | ---------------------------------------------------------------------------------- |
| `compose.yaml`                           | Local dev dependencies (pgvector, Redis, MinIO)                                    |
| `db/schema.sql`                          | Reference PostgreSQL/pgvector schema                                               |
| `db/migrations/`                         | 10 versioned forward migrations (001–010)                                          |
| `.github/workflows/ci.yaml`              | CI quality gates + security checks                                                 |
| `scripts/ci/check-all.sh`                | Local CI simulation (format → lint → status → typecheck → test → build → security) |
| `scripts/ci/validate-status.ts`          | Governance validation (dependency/reviewer/gate integrity)                         |
| `scripts/security/check-secrets.sh`      | Secret pattern scan with false-positive filters                                    |
| `scripts/security/check-dependencies.sh` | `pnpm audit --prod` vulnerability scan                                             |
| `api/openapi.yaml`                       | OpenAPI 3.1 contract                                                               |

### Planning Artifacts

| Path                    | Purpose                                                                  |
| ----------------------- | ------------------------------------------------------------------------ |
| `planning/backlog.yaml` | 64 tasks across 8 phases (P0–P7)                                         |
| `planning/status.yaml`  | Execution state tracker — 33 DONE, 31 NOT_STARTED, 0 FAILED_VERIFICATION |
| `planning/runs/`        | 41 per-task run records with verification evidence                       |
| `planning/reviews/`     | 39 review records (all P0–P3 tasks, gates, and audit findings)           |

### Excluded/Generated Areas

- `node_modules/`, `.turbo/`, `dist/`, `.next/`, `coverage/`, `ci-output/`, `test-results/`, `benchmark_out/`
- `.venv/`, `__pycache__/` (Python tooling artifacts, gitignored)
- `.opencode/`, `.git/`

## Validation Results

P3-GATE-anchored evidence (full reproduction in `planning/runs/P3-GATE.md:42-56`).

| Check                 | Command                                       | Result     | Evidence                                                                                                      |
| --------------------- | --------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------- |
| Format check          | `pnpm format:check`                           | **Passed** | All matched files use Prettier code style (auto-fix applied to `planning/reviews/P3-T10.md`)                  |
| Lint                  | `pnpm lint`                                   | **Passed** | 17/17 packages, 0 errors; 1 pre-existing unrelated warning in `packages/ai/src/assistant/orchestrator.ts:521` |
| Type check            | `pnpm typecheck`                              | **Passed** | 29/29 tasks successful                                                                                        |
| Unit tests            | `pnpm test:unit`                              | **Passed** | 34/34 tasks successful — **921 tests** cumulative across 13 packages                                          |
| Build                 | `pnpm build`                                  | **Passed** | 17/17 packages compile                                                                                        |
| Secrets scan          | `pnpm security:secrets`                       | **Passed** | No secrets detected                                                                                           |
| Dependency audit      | `pnpm security:dependencies`                  | **Passed** | No known production-runtime vulnerabilities; 2 dev-only advisories (see AUD-P3-104)                           |
| Governance validation | `pnpm exec tsx scripts/ci/validate-status.ts` | **Passed** | 64 tasks, 8 phases, 8 gates — all dependency/reviewer/gate checks pass                                        |
| Retrieval evaluation  | `pnpm eval:retrieval`                         | **Passed** | 11/11 cases, 0 failures, 0 security failures                                                                  |
| Answer evaluation     | `pnpm eval:answers`                           | **Passed** | 11/11 evaluated; 4 `security_critical: true` correctly flagged; release-blocking exit-2 fires by design       |
| End-to-end suite      | `pnpm test:e2e`                               | **Passed** | 1/1 upload-to-feedback journey                                                                                |
| Security suite        | `pnpm test:security`                          | **Passed** | 13/13 tests across 5 files (cross-tenant, injection, provider failure, P3-T08 sentinel)                       |

### Test breakdown by package (cumulative, P3-GATE.md:62-77)

| Package       | Tests   | Result   |
| ------------- | ------- | -------- |
| domain        | 11      | PASS     |
| web           | 51      | PASS     |
| config        | 17      | PASS     |
| observability | 34      | PASS     |
| contracts     | 21      | PASS     |
| storage       | 34      | PASS     |
| auth          | 162     | PASS     |
| jobs          | 18      | PASS     |
| audit         | 36      | PASS     |
| knowledge     | 201     | PASS     |
| evals         | 81      | PASS     |
| ai            | 143     | PASS     |
| api           | 112     | PASS     |
| **Total**     | **921** | **PASS** |

## Findings Summary

| ID         | Severity | Confidence | Finding                                                                                                                                 | Location                                                                                                           | Status                                                                                |
| ---------- | -------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| AUD-P2-001 | P2       | High       | README progress indicators (badges, phase table, summary, in-progress section, footer) were stale — P2 shown as 7/10 in-progress        | `README.md` lines 18, 44, 50, 57–65, 761                                                                           | **Resolved** (commits `dd84116`, `ab7247e`; run record `planning/runs/AUD-P2-001.md`) |
| AUD-P3-001 | P3       | High       | MANIFEST metadata (tracked-file count, phase, task counts) was stale                                                                    | `MANIFEST.md` lines 9–11                                                                                           | **Resolved** (commits `dd84116`, `ab7247e`)                                           |
| AUD-P3-002 | P3       | Medium     | 5 `as unknown as` type casts in production code at adapter boundaries                                                                   | `publishing-stage.ts:40`, `s3-adapter.ts:133`, `session.ts:105`, `upload-workflow.ts:46`, `idempotency.ts:189,202` | Carried forward                                                                       |
| AUD-P3-003 | P3       | Low        | `db/schema.sql` reference vs 10 cumulative migrations — drift risk                                                                      | `db/schema.sql`, `db/migrations/*.sql`                                                                             | Carried forward                                                                       |
| AUD-P3-101 | P3       | High       | `submitFeedback` does not verify that `messageId` belongs to the supplied `workspaceId` at the service layer                            | `packages/ai/src/feedback/service.ts`                                                                              | New — P4 follow-up                                                                    |
| AUD-P3-102 | P3       | Medium     | Orchestrator passes raw provider error text to the client (truncated to 200 chars) — not mapped to sanitized safe messages              | `packages/ai/src/assistant/orchestrator.ts:524-532`                                                                | New — P4 follow-up                                                                    |
| AUD-P3-103 | P3       | Low        | `test/e2e/**` and `test/security/**` not in `.eslintrc.json` `parserOptions.project` — `pnpm exec eslint test/...` reports parse errors | `.eslintrc.json`                                                                                                   | New — optional hardening                                                              |
| AUD-P3-104 | P3       | High       | Dev-only dependency advisories: `vitest@2.1.9` (critical GHSA-5xrq-8626-4rwp), `esbuild`/`vite` (moderate) — no production impact       | `pnpm-lock.yaml`                                                                                                   | New — known dev-only                                                                  |
| AUD-P3-105 | P3       | Low        | `apps/api`, `apps/web`, `apps/worker` use `echo`-based build stubs; real build tooling deferred                                         | `apps/api/package.json`, `apps/web/package.json`, `apps/worker/package.json`                                       | New — known shell                                                                     |
| AUD-P3-106 | P3       | Medium     | File scanning uses a stub; real malware scanning deferred to P7                                                                         | `packages/knowledge/src/ingestion/scan-stub`                                                                       | New — P7 follow-up                                                                    |

### Resolved Findings (from 2026-06-12 handoff)

| ID                                              | Status                       | Evidence                                                               |
| ----------------------------------------------- | ---------------------------- | ---------------------------------------------------------------------- |
| AUD-P2-001 (README stale progress)              | **Resolved**                 | Commits `dd84116`, `ab7247e`; run record `planning/runs/AUD-P2-001.md` |
| AUD-P3-001 (MANIFEST stale metadata)            | **Resolved**                 | Commits `dd84116`, `ab7247e`                                           |
| AUD-P1-001 (P2-T07 missing from status)         | **Resolved** (prior handoff) | `planning/status.yaml:42`                                              |
| AUD-P2-002 (P2-T08–T10 missing from status)     | **Resolved** (prior handoff) | `planning/status.yaml:43-45`                                           |
| AUD-P3-002 (gitignore `__pycache__/`, `.venv/`) | **Resolved** (prior handoff) | `.gitignore`                                                           |

## Detailed Findings

### AUD-P2-001 — README.md Stale Progress Indicators (P2) — **RESOLVED**

- **Resolution commits:** `dd84116` ("docs: reconcile README and MANIFEST with current delivery state") and `ab7247e` ("docs: reconcile README and MANIFEST with P3-GATE completion").
- **Current state:** P2 badge shows `P2_Knowledge-COMPLETE-22C55E` (green); phase table row shows 10/10 DONE; summary reads "33 of 64 tasks complete"; "Currently In Progress" section now describes P4 as the next active phase; footer reads "33 of 64 tasks complete · P0 ✓ · P1 ✓ · P2 ✓ · P3 ✓".
- **Evidence:** `planning/runs/AUD-P2-001.md`.

### AUD-P3-001 — MANIFEST.md Stale Metadata (P3) — **RESOLVED**

- **Resolution commits:** `dd84116`, `ab7247e`.
- **Current state (2026-06-13):** Tracked files 442, phase "P0, P1, P2, P3 complete; P4-P7 not started", 64 defined, 33 completed, 0 failed verification, baseline `dd84116`.
- **Note:** The `git ls-files | wc -l` count is now 467 (25 higher than MANIFEST reports) — see AUD-P3-107 below.

### AUD-P3-002 — `as unknown as` Type Casts in Production Code (P3) — **CARRIED FORWARD**

5 production casts (no change since prior handoff). No runtime evidence of bugs. Replacement requires narrowing at adapter boundaries (`pg.Pool` ↔ internal pool type, Fastify request augmentation, S3 head metadata, verified session payload). See `AGENT_HANDOFF.md@2026-06-12:175-200` for full location list and rationale.

### AUD-P3-003 — Schema Drift Risk Between `db/schema.sql` and Migrations (P3) — **CARRIED FORWARD**

10 migrations (001–010, cumulative post-P3-T08); `db/schema.sql` is a reference design artifact and has not been systematically reconciled. Mitigated by `db/schema.sql:2` comment declaring migrations authoritative. See `AGENT_HANDOFF.md@2026-06-12:202-217` for remediation options.

### AUD-P3-101 — P3-T08 Cross-Tenant Insert Gap (P3) — **NEW, P4 FOLLOW-UP**

- **Affected:** `packages/ai/src/feedback/service.ts` `submitFeedback()` does not verify that the supplied `messageId` belongs to the supplied `workspaceId`.
- **Defense-in-depth present:** (1) `apps/api/src/routes/feedback.ts` calls `requireWorkspaceContext`; (2) DB-level RLS policy on `feedback` enforces workspace isolation.
- **Gap:** A direct caller of `submitFeedback` (bypassing the route) could insert feedback for another workspace's message. The route is the only production caller.
- **Evidence:** `test/security/p3-t08-cross-tenant-insert.test.ts` documents the gap as a regression sentinel. Cited in `planning/runs/P3-GATE.md:131-134`.
- **Remediation:** Add workspace alignment check in `submitFeedback`; add a unit test that does not rely on the route layer.
- **Acceptance criteria:** `submitFeedback` rejects (or aligns) when `messageId.workspaceId !== workspaceId`; the regression sentinel in `test/security/p3-t08-cross-tenant-insert.test.ts` passes.

### AUD-P3-102 — Orchestrator Provider-Error Sanitization (P3) — **NEW, P4 FOLLOW-UP**

- **Affected:** `packages/ai/src/assistant/orchestrator.ts:524-532` passes raw provider error text through to the client, bounded only by `truncateSafe` to 200 chars.
- **Risk:** Provider error strings can leak implementation details (model name, internal ids, partial request bodies).
- **Evidence:** `test/security/provider-failure.test.ts` documents the current contract. Cited in `planning/runs/P3-GATE.md:129`.
- **Remediation:** Map `ModelGatewayError.category` to a sanitized user-facing message; preserve the raw error in the audit/observability stream only.
- **Acceptance criteria:** `run.failed` envelope contains a category-derived safe message; raw provider text is not in the client envelope.

### AUD-P3-103 — Vitest Config Gap for `test/e2e/**` and `test/security/**` (P3) — **NEW, OPTIONAL**

- **Affected:** `.eslintrc.json` does not include `test/e2e/**` or `test/security/**` in `parserOptions.project`.
- **Impact:** `pnpm exec eslint test/...` reports parsing errors. Monorepo `pnpm lint` (scoped to packages + apps) passes without errors. The test files are validated by vitest directly and not seen by `pnpm typecheck` (root `tsconfig.json` is references-only).
- **Evidence:** `planning/runs/P3-GATE.md:142`.
- **Remediation:** Add a `test/tsconfig.json` that includes the test directories, and update `.eslintrc.json` `parserOptions.project` to include it.
- **Acceptance criteria:** `pnpm exec eslint test/e2e test/security` exits 0; existing test/typecheck/lint remain green.

### AUD-P3-104 — Dev-Only Dependency Vulnerabilities (P3) — **NEW, KNOWN**

- **Affected:** `vitest@2.1.9` (critical GHSA-5xrq-8626-4rwp), `esbuild` / `vite` (moderate). Carried from P0/P2 audits; no regression.
- **Impact:** None on production runtime. `pnpm security:dependencies` is clean for production dependencies.
- **Evidence:** `planning/runs/P3-GATE.md:140`.
- **Remediation:** Track upstream fixes; bump when the project's supported `vitest` minor version moves. Document acceptance in a security ADR if the dev-only risk is considered permanent.
- **Acceptance criteria:** A `pnpm audit --prod` run remains clean; a tracking issue / ADR records the dev-only risk.

### AUD-P3-105 — App Build Stubs (P3) — **NEW, KNOWN**

- **Affected:** `apps/api`, `apps/web`, `apps/worker` use `echo` build stubs (from P0). Real build tooling is deferred.
- **Impact:** No production impact at this stage — the API shell runs Fastify via `tsx`, web uses plain TypeScript, worker uses Node directly. `pnpm build` succeeds for these packages but does not produce a production bundle.
- **Evidence:** `planning/runs/P3-GATE.md:136`.
- **Remediation:** Replace with real bundlers (e.g., `tsup` or `esbuild`) when the deployment target is finalized (likely P7).

### AUD-P3-106 — File Scanning Stub (P3) — **NEW, P7 FOLLOW-UP**

- **Affected:** `packages/knowledge/src/ingestion/scan-stub` provides a no-op file scanning adapter.
- **Impact:** Document uploads are ingested without malware scanning. Acceptable for blueprint / development; production requires real scanning.
- **Remediation:** Real scanning integration is a P7 deliverable per the phased plan.

### AUD-P3-107 — MANIFEST Tracked-File Count Lag (P3) — **NEW, MINOR**

- **Affected:** `MANIFEST.md:9` reports "Tracked files: 442"; `git ls-files | wc -l` returns 467 (25 higher).
- **Cause:** The MANIFEST was last reconciled at commit `dd84116`; subsequent P3 commits (P3-T08/T09/T10 and gate evidence) added test directories and ADR files.
- **Remediation:** Update `MANIFEST.md:9` to 467. Alternatively, automate the count via a script in `scripts/`.
- **Acceptance criteria:** `MANIFEST.md` tracked-file count equals `git ls-files | wc -l` to within the current commit.

## Suspected Issues and Risks

### Maintainability Risks

1. **README / MANIFEST staleness recurrence risk:** Both files contain manually-maintained counts and status descriptions. The prior handoff captured this risk and the drift has already re-occurred for `MANIFEST.md` (AUD-P3-107). A CI check that validates badge text, phase table, and counts against `planning/status.yaml` and `git ls-files` would prevent recurrence.
2. **P3-GATE follow-ups are not yet tracked in the backlog:** AUD-P3-101, AUD-P3-102, AUD-P3-103, AUD-P3-106, AUD-P3-107 are documented here only. Future P4 work should triage and schedule them, or this handoff becomes a parallel ledger to `planning/backlog.yaml`.
3. **`@pia/memory` and `@pia/tools` are scaffolded shells:** Their package directories exist; P4 and P5 will fill them. Any cross-package import from these shells will fail to resolve.
4. **App build stubs (AUD-P3-105):** When P7 begins deployment, the build scripts must be replaced with real bundlers in a single coordinated change.

### Operational Notes

1. **`eval:retrieval` and `eval:answers` require PostgreSQL.** CI's `test:unit` does not provide one; the suites run against `docker compose up -d postgres` locally. `test:e2e` and `test:security` skip with a clear log message when PostgreSQL is not reachable.
2. **`pnpm eval:answers` exits 2 on security-critical failures** — this is the FR-EVAL-003 release-blocking rule. A non-zero exit is a PASS, not a CI failure. See `planning/runs/P3-GATE.md:51`.
3. **Provider adapters are fakes/mocks.** No real OIDC provider, embedding API, or LLM provider keys are configured. The OpenAI adapter exists in `packages/ai/src/gateway/` and is exercised by unit tests, but production credentials are out of scope for the blueprint.

### Security Note

- `.env` file exists (931 bytes, gitignored). No secrets were detected by `security:secrets` scan. The file was not read due to safety policy. Its contents are development-only per `.env.example` patterns.
- The P3 phase implemented defense-in-depth: provider-neutral gateway with redaction, code-managed prompts (no in-DB prompt storage), workspace-scoped conversation + message + run persistence, sensitivity-class-aware routing, deterministic citation verifier, citation + authorization security tests, indirect prompt injection detection, provider-failure graceful degradation.
- Free-text feedback content is stored verbatim (render layer escapes); classifier signature explicitly does not inspect free-text (P3-T08 security hardening).
- Cross-tenant data access is enforced at three layers: (1) `workspace_id` FK constraints, (2) RLS policies, (3) application-layer checks. The P3-T08 feedback-boundary gap (AUD-P3-101) is documented and scheduled for P4.

## Execution Plan

### Phase 1 — Drift Sentinel: README and MANIFEST (Read-Only Verification)

**Objective:** Confirm the user-facing delivery-state documents still match the authoritative ledger before any P4 work begins.

**Expected paths:** None (read-only check). If drift is found, propose a docs-update follow-up rather than editing here.

**Tasks:**

- [ ] Run `git ls-files | wc -l` and compare to `MANIFEST.md:9` (currently 467 vs 442 → AUD-P3-107).
- [ ] Compare `planning/status.yaml` task counts to `MANIFEST.md:11` and `README.md:44,761`.
- [ ] Compare `README.md` phase table to `planning/status.yaml:5-12` (phases) and `:13-21` (gates).
- [ ] If any drift is found, file a follow-up to invoke `@repository-docs` (or `/docs-update`) per `docs/REPOSITORY_DOCUMENTATION_WORKFLOW.md`.

**Acceptance criteria:**

- [ ] Tracked file count delta is ≤ 0 after a potential MANIFEST update.
- [ ] Phase table matches `status.yaml` phases and gates.
- [ ] "Currently In Progress" section describes P4 (or is removed if P4 is also complete).

**Rollback:** N/A — this phase is a verification step.

---

### Phase 2 — Hardening (Optional, Deferrable)

**Objective:** Address the carried-forward and new P3 findings that are not on the critical path for P4.

**Finding IDs:** AUD-P3-002, AUD-P3-003, AUD-P3-103, AUD-P3-105

**Expected paths:**

- `publishing-stage.ts`, `s3-adapter.ts`, `session.ts`, `upload-workflow.ts`, `idempotency.ts` (AUD-P3-002)
- `db/schema.sql`, `db/migrations/*.sql` (AUD-P3-003)
- `test/tsconfig.json` (new), `.eslintrc.json` (AUD-P3-103)
- `apps/{api,web,worker}/package.json` (AUD-P3-105)

**Tasks:**

- [ ] AUD-P3-002: Replace `as unknown as` with type-narrowing patterns; use `fastify.decorateRequest` for idempotency metadata.
- [ ] AUD-P3-003: Run migrations against a fresh PostgreSQL; `pg_dump --schema-only`; diff against `db/schema.sql`; reconcile or document deltas; consider generating `db/schema.sql` from migration output.
- [ ] AUD-P3-103: Add `test/tsconfig.json`; update `.eslintrc.json` `parserOptions.project`.
- [ ] AUD-P3-105: Replace `echo` build stubs with real bundlers when the P7 deployment target is set.

**Validation:**

```bash
pnpm typecheck            # must pass
pnpm lint                 # 0 errors (now also covers test/)
pnpm test:unit            # 921 tests still pass
rg "as unknown as" packages/ apps/ --include="*.ts" --exclude="test/"  # 0 in production
```

**Acceptance criteria:**

- [ ] Zero `as unknown as` in production code.
- [ ] `pnpm exec eslint test/e2e test/security` exits 0.
- [ ] `db/schema.sql` matches migration state (or deltas are documented with a "last reconciled" stamp).
- [ ] Build scripts produce real artifacts for `apps/{api,web,worker}`.

**Rollback:** Revert affected files. No data migration required.

---

### Phase 3 — P4 Pre-Flight (Recommended Before `P4-T01` Begins)

**Objective:** Address the P3-GATE observations that touch the P4 backlog's prerequisites before P4 work begins.

**Finding IDs:** AUD-P3-101, AUD-P3-102, AUD-P3-104 (tracking), AUD-P3-106 (P7, note only)

**Expected paths:**

- `packages/ai/src/feedback/service.ts` (AUD-P3-101)
- `packages/ai/src/assistant/orchestrator.ts` (AUD-P3-102)
- `package.json` (AUD-P3-104 — track bump)
- `test/security/p3-t08-cross-tenant-insert.test.ts` (sentinel; flip from documenting gap to asserting the fix)

**Tasks:**

- [ ] AUD-P3-101: Add workspace-alignment check in `submitFeedback`; flip the regression sentinel to assert the fix.
- [ ] AUD-P3-102: Map `ModelGatewayError.category` to a sanitized user-facing message; preserve raw text in audit/observability only.
- [ ] AUD-P3-104: Track `vitest@2.1.9` and `esbuild`/`vite` upstream fixes; bump when supported.
- [ ] AUD-P3-106: Document the file-scanning stub status in the P7 plan; do not block P4 on it.

**Validation:**

```bash
pnpm test:security                          # 13/13 still pass; p3-t08 sentinel now asserts the fix
pnpm test:unit                              # 921 tests still pass
pnpm eval:retrieval                         # 11/11 still pass
pnpm eval:answers                           # 11/11 evaluated; security_critical cases still flagged
```

**Acceptance criteria:**

- [ ] `submitFeedback` rejects or aligns cross-workspace `messageId` at the service layer.
- [ ] Orchestrator `run.failed` envelope contains a category-derived safe message; raw provider text not in client envelope.
- [ ] `vitest` is on a version that closes GHSA-5xrq-8626-4rwp (or a security ADR documents the dev-only risk).

**Rollback:** Revert affected files. No data migration required.

---

## Final Verification Checklist

After any phase completes:

```bash
# Quality gates
pnpm format:check          # Prettier compliance
pnpm lint                  # 0 ESLint errors (and 0 warnings introduced)
pnpm typecheck             # 29/29 tasks pass
pnpm test:unit             # 921 tests pass
pnpm build                 # 17/17 packages compile

# Evaluation and integration
pnpm eval:retrieval        # 11/11 cases
pnpm eval:answers          # 11/11 evaluated; security_critical cases flagged
pnpm test:e2e              # 1/1 journey
pnpm test:security         # 13/13 tests

# Security
pnpm security:secrets      # No secrets detected
pnpm security:dependencies # No production vulnerabilities

# Governance
pnpm exec tsx scripts/ci/validate-status.ts  # PASSED

# Git state
git status --short         # Only intended changes
git diff --stat            # Verify scope
```

## Deferred, Blocked, and Rejected Findings

| ID                              | Decision                       | Reason                                                                        | Prerequisite                  |
| ------------------------------- | ------------------------------ | ----------------------------------------------------------------------------- | ----------------------------- |
| AUD-P3-002 (type casts)         | Deferred to Phase 2 (optional) | No runtime evidence of bugs; refactor is local, low-risk                      | None                          |
| AUD-P3-003 (schema drift)       | Deferred to Phase 2 (optional) | Requires running PostgreSQL; reference schema is design-only                  | Running PostgreSQL instance   |
| AUD-P3-103 (vitest config)      | Deferred to Phase 2 (optional) | Cosmetic; monorepo lint and typecheck are clean                               | None                          |
| AUD-P3-105 (build stubs)        | Deferred to Phase 2 (optional) | No production impact at this stage; aligned with P7                           | P7 deployment target decision |
| AUD-P3-106 (scan stub)          | Deferred to P7                 | Real malware scanning is a P7 deliverable per the phased plan                 | P7                            |
| AUD-P3-101 (feedback gap)       | Pre-flight for P4              | Defense-in-depth gap; not a release blocker; route-layer check + RLS cover it | P4-T01 start                  |
| AUD-P3-102 (error sanitization) | Pre-flight for P4              | Information-disclosure risk; bounded by `truncateSafe` to 200 chars           | P4-T01 start                  |
| AUD-P3-104 (dep vulns)          | Track only                     | Dev-only; no production impact                                                | Upstream fix or security ADR  |
| AUD-P3-107 (MANIFEST lag)       | Cosmetic                       | 25-file drift; auto-fix candidate for `@repository-docs`                      | None                          |

## Open Questions and Limitations

1. **Integration tests not re-executed in this audit:** `pnpm test:integration`, `pnpm test:e2e`, and `pnpm test:security` require running PostgreSQL (and Redis, MinIO for the API integration tests). The CI pipeline provides PostgreSQL via service container, and the P3-GATE run executed them successfully (1/1 + 13/13). This audit did not re-run them; their results are cited from `planning/runs/P3-GATE.md:51-54`.
2. **`.env` contents not inspected:** Safety boundary prevents reading `.env` files. The 931-byte file is gitignored. Secrets scan passed — no real credentials detected in tracked files.
3. **Full source audit coverage:** 467 tracked files; only key security boundaries, representative samples, and the new P3 areas (`packages/ai/src/assistant/`, `packages/ai/src/feedback/`, `evals/answers/`, `test/e2e/`, `test/security/`, `docs/adr/0007-…`) were inspected. Deep review of every module was not performed.
4. **Dependency versions:** `pnpm audit --prod` found no known production-runtime vulnerabilities. Supply-chain risk from transitive dependencies not assessed.
5. **Next.js web app:** The `apps/web/` package has a TypeScript shell with a real conversation UI (P3-T09) and SSE parser, but no Next.js production build output. The build script is a no-op (AUD-P3-105). Full Next.js compilation was not tested.
6. **Provider adapters:** No real OIDC provider, embedding API, or LLM provider keys are configured. The OpenAI adapter exists in `packages/ai/src/gateway/` and is exercised by unit tests; production credentials are out of scope for the blueprint.
7. **P3-GATE non-blocking observations vs backlog:** AUD-P3-101..107 are documented in this handoff but are not in `planning/backlog.yaml`. The P4 pre-flight (Phase 3) depends on someone triaging and scheduling them — either as P4 candidate tasks or as scope-explicit deferrals.

## Implementation Agent Starting Point

**Recommended first phase:** Phase 3 — P4 Pre-Flight.

**First paths to modify (if Phase 3 is authorized):**

- `packages/ai/src/feedback/service.ts` — add workspace-alignment check in `submitFeedback` (AUD-P3-101).
- `packages/ai/src/assistant/orchestrator.ts` — map `ModelGatewayError.category` to a sanitized safe message (AUD-P3-102).
- `test/security/p3-t08-cross-tenant-insert.test.ts` — flip from documenting the gap to asserting the fix.

**Pre-P4 sanity check (no code changes):**

- [ ] `planning/status.yaml` shows P3-GATE: DONE and P4-GATE: NOT_STARTED.
- [ ] `@pia/memory` package exists and is a shell (P4-T01..T07 will fill it).
- [ ] `pnpm test:security` still passes 13/13 (defense-in-depth is intact).
- [ ] No P4 tasks are in `IN_PROGRESS` state.

**Blockers for P4 start:** None. All P3 dependencies (P2-GATE, P3-T01..T10, P3-GATE) are DONE with verified run records and reviewer sign-off. The only P4 prerequisite is the Phase 3 pre-flight, which is recommended but not strictly required — each AUD-P3-101/102 fix can be folded into the P4 task that owns the affected code.

**Repository state note:** Worktree is clean. No uncommitted changes. Commit `efab8b7` is the HEAD.

**Changes that must remain separate:**

- Phase 1 (drift sentinel) is read-only; no commit.
- Phase 2 (hardening) findings are independent of each other and of Phase 3 — group by finding or by package, not by phase.
- Phase 3 (P4 pre-flight) findings should be folded into the P4 task that owns the affected code, or landed as a small pre-P4 commit — but should not be lumped with unrelated Phase 2 hardening.
- Do not modify `planning/status.yaml`, `planning/backlog.yaml`, `README.md`, `MANIFEST.md`, or any source code in Phase 1. Phase 2 and Phase 3 modify source code as scoped above.
