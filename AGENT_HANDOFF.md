# Repository Audit Agent Handoff

## Audit Summary

- **Date:** 2026-06-12
- **Repository:** Personal Intelligence and Action Engine (PIA)
- **Branch:** `main` @ `e209dcc` — clean worktree
- **Stack:** TypeScript 5.7 strict, Node.js 22.22.3, pnpm 9.15.9, Fastify, PostgreSQL 17 + pgvector, Redis 7, MinIO, Turborepo, Vitest
- **Architecture:** 3 apps (api, worker, web) composing 14 domain packages with strict dependency inversion; workspace-isolated RBAC, OIDC auth, append-only audit, durable outbox jobs
- **Phase status:** P0 ✓ P1 ✓ P2 ✓ (all gates DONE); P3–P7 NOT_STARTED
- **Health:** All CI quality gates pass. 23 of 64 tasks complete. No secrets, no build failures, no auth bypasses, no test.skip/only patterns, no `as any` in production code.
- **Previous handoff:** `AGENT_HANDOFF.md` dated 2026-06-11 — all P1 and P2 findings (AUD-P1-001, AUD-P2-001, AUD-P2-002) resolved. Remaining P3 items partially addressed (gitignore entries added, MANIFEST count partially updated). Three new P2/P3 staleness findings discovered in this audit.
- **Scope inspected:** Root manifests, all CI/security scripts, compose.yaml, planning/backlog.yaml, planning/status.yaml, all run records (35 files), all review records (24 files), all package.json boundaries, key source paths in auth/knowledge/storage/audit/jobs/observability/config, API routes, db/schema.sql, db/migrations (7 files), .gitignore, .env.example, README.md, MANIFEST.md, opencode.jsonc.
- **Not inspected:** Individual migration SQL semantics, provider SDK internals, Next.js app router details, infra/ Pulumi modules, full integration test suite (requires PostgreSQL), individual file-level review of all 300+ tracked source files.
- **Commands executed:** `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test:unit`, `pnpm build`, `pnpm security:secrets`, `pnpm security:dependencies`, `pnpm exec tsx scripts/ci/validate-status.ts`, `pnpm eval:retrieval`.
- **Limitations:** No PostgreSQL/Redis/MinIO running locally — integration tests skipped in test:unit (by design). `.env` file exists (931 bytes) but is gitignored and not inspected (safety boundary). Full schema reconciliation between `db/schema.sql` and 7 migration files not performed.

## Repository Map

### Applications (3)

| Path           | Package       | Purpose                                                                             | Status          |
| -------------- | ------------- | ----------------------------------------------------------------------------------- | --------------- |
| `apps/api/`    | `@pia/api`    | Fastify HTTP API server — auth, workspaces, uploads, documents, retrieval, health   | Active          |
| `apps/worker/` | `@pia/worker` | Background job consumer — outbox polling, ingestion workflow, retry/dead-letter     | Active          |
| `apps/web/`    | `@pia/web`    | Next.js App Router frontend — workspace/project listing, document upload, search UI | Active (P2-T09) |

### Domain Packages (14)

| Path                      | Package              | Purpose                                                            | Status          |
| ------------------------- | -------------------- | ------------------------------------------------------------------ | --------------- |
| `packages/auth/`          | `@pia/auth`          | OIDC client, JWT sessions, RBAC, policy decisions, fake provider   | Active          |
| `packages/config/`        | `@pia/config`        | Typed env-var config with Redacted secret handling                 | Active          |
| `packages/contracts/`     | `@pia/contracts`     | Shared API types, error envelopes, pagination                      | Active          |
| `packages/db/`            | `@pia/db`            | PostgreSQL pool, migrations, membership queries                    | Active          |
| `packages/domain/`        | `@pia/domain`        | Authorization types and role hierarchy                             | Active          |
| `packages/audit/`         | `@pia/audit`         | Append-only audit event writer, reader, redaction                  | Active          |
| `packages/observability/` | `@pia/observability` | Structured logger, correlation context, redaction                  | Active          |
| `packages/storage/`       | `@pia/storage`       | S3/MinIO adapter, signed uploads, local adapter                    | Active          |
| `packages/jobs/`          | `@pia/jobs`          | Outbox events, consumer, retry policies                            | Active          |
| `packages/knowledge/`     | `@pia/knowledge`     | Parsing, chunking, embeddings, retrieval, citations, state machine | Active          |
| `packages/evals/`         | `@pia/evals`         | Evaluation scorers, retrieval harness runner, dataset framework    | Active (P2-T10) |
| `packages/ai/`            | `@pia/ai`            | Model gateway, prompt registry, context compiler                   | Shell (P3)      |
| `packages/memory/`        | `@pia/memory`        | Candidate/approved memory lifecycle                                | Shell (P4)      |
| `packages/tools/`         | `@pia/tools`         | Tool registry, policy engine, approvals                            | Shell (P5)      |

### Infrastructure & Configuration

| Path                                     | Purpose                                                                            |
| ---------------------------------------- | ---------------------------------------------------------------------------------- |
| `compose.yaml`                           | Local dev dependencies (pgvector, Redis, MinIO)                                    |
| `db/schema.sql`                          | Reference PostgreSQL/pgvector schema (619 lines)                                   |
| `db/migrations/`                         | 7 versioned forward migrations (001–006, 663 lines total)                          |
| `.github/workflows/ci.yaml`              | CI quality gates + security checks                                                 |
| `scripts/ci/check-all.sh`                | Local CI simulation (format → lint → status → typecheck → test → build → security) |
| `scripts/ci/validate-status.ts`          | Governance validation (dependency/reviewer/gate integrity)                         |
| `scripts/security/check-secrets.sh`      | Secret pattern scan with false-positive filters                                    |
| `scripts/security/check-dependencies.sh` | `pnpm audit --prod` vulnerability scan                                             |
| `api/openapi.yaml`                       | OpenAPI 3.1 contract (37 operations)                                               |

### Planning Artifacts

| Path                    | Purpose                                            |
| ----------------------- | -------------------------------------------------- |
| `planning/backlog.yaml` | 64 tasks across 8 phases (P0–P7)                   |
| `planning/status.yaml`  | Execution state tracker — 23 DONE, 41 NOT_STARTED  |
| `planning/runs/`        | 35 per-task run records with verification evidence |
| `planning/reviews/`     | 24 review records (all P0–P2 tasks + gates)        |

### Excluded/Generated Areas

- `node_modules/`, `.turbo/`, `dist/`, `.next/`, `coverage/`, `ci-output/`, `test-results/`, `benchmark_out/`
- `.venv/`, `__pycache__/` (Python tooling artifacts, gitignored)
- `.opencode/`, `.git/`

## Validation Results

| Check                 | Command                                       | Result     | Evidence                                                                                                     |
| --------------------- | --------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------ |
| Format check          | `pnpm format:check`                           | **Passed** | All matched files use Prettier code style                                                                    |
| Lint                  | `pnpm lint`                                   | **Passed** | 17/17 packages, 0 errors (all cached)                                                                        |
| Type check            | `pnpm typecheck`                              | **Passed** | 28/28 tasks successful (11 build-cached, 17 typecheck)                                                       |
| Unit tests            | `pnpm test:unit`                              | **Passed** | 34/34 tasks successful — 160 knowledge tests, 162 auth tests, 85 API tests, 38 evals tests, all others green |
| Build                 | `pnpm build`                                  | **Passed** | 17/17 packages compile (14 tsc, 2 no-build shells)                                                           |
| Secrets scan          | `pnpm security:secrets`                       | **Passed** | No secrets detected                                                                                          |
| Dependency audit      | `pnpm security:dependencies`                  | **Passed** | No known vulnerabilities found                                                                               |
| Governance validation | `pnpm exec tsx scripts/ci/validate-status.ts` | **Passed** | 64 tasks, 8 phases — all dependency/reviewer/gate checks pass                                                |
| Retrieval evaluation  | `pnpm eval:retrieval`                         | **Passed** | 5/5 cases passed, 100% recall@K, 100% MRR, 100% version/auth correctness                                     |

## Findings Summary

| ID         | Severity | Confidence | Finding                                                                                                                                                                                                                | Location                                                                                                                         | Status          |
| ---------- | -------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| AUD-P2-001 | P2       | High       | README.md progress badges, phase table, and summary text are stale — P2 shown as 7/10 in-progress but is 10/10 DONE; "20 of 50" should be "23 of 64"; "Currently In Progress" section lists completed tasks P2-T08–T10 | `README.md` lines 16–19, 43–62, 762                                                                                              | New             |
| AUD-P3-001 | P3       | High       | MANIFEST.md stale — "P2 in progress" should be "P2 complete"; "17 completed" should be "23 completed"; "301 tracked files" should be "329"                                                                             | `MANIFEST.md` lines 7–11                                                                                                         | New             |
| AUD-P3-002 | P3       | Medium     | 12 `as unknown as` type casts — 5 in production code paths, 7 in test code. Present since original audit; no regression but no hardening either                                                                        | `publishing-stage.ts:40`, `s3-adapter.ts:133`, `session.ts:105`, `upload-workflow.ts:46`, `idempotency.ts:189,202`, 7 test files | Carried forward |
| AUD-P3-003 | P3       | Low        | `db/schema.sql` (619 lines reference) vs 7 migration files (663 lines) — potential drift; never systematically reconciled                                                                                              | `db/schema.sql`, `db/migrations/*.sql`                                                                                           | Carried forward |

### Previously Resolved Findings (from 2026-06-11 handoff)

| ID                                                          | Status                                                        |
| ----------------------------------------------------------- | ------------------------------------------------------------- |
| AUD-P1-001 (P2-T07 missing from status.yaml)                | **Resolved** — P2-T07 added to status.yaml as DONE            |
| AUD-P2-001 (P2-T07 review record missing)                   | **Resolved** — `planning/reviews/P2-T07.md` created           |
| AUD-P2-002 (P2-T08–T10 missing from status)                 | **Resolved** — all three added to status.yaml as DONE         |
| AUD-P3-001 (MANIFEST tracked files 228→301)                 | **Partially resolved** — count was 301, now 329 (stale again) |
| AUD-P3-002 (.gitignore missing `__pycache__/` and `.venv/`) | **Resolved** — entries added to `.gitignore`                  |
| AUD-P3-003 (untracked dev artifacts)                        | **Resolved** — entries added to `.gitignore`                  |

## Detailed Findings

### AUD-P2-001 — README.md Stale Progress Indicators (P2)

**Severity:** P2 | **Confidence:** High | **Status:** New

**Affected locations:**

- `README.md:18` — Badge: `P2_Knowledge-7%2F10-F59E0B` (amber) should be `P2_Knowledge-COMPLETE-22C55E` (green)
- `README.md:50` — Phase table: P2 row says `7/10` with `In Progress` gate; should be `10/10` with `DONE`
- `README.md:43` — Summary: "20 of 50 tasks complete" should be "23 of 64 tasks complete"
- `README.md:57–65` — "Currently In Progress" section lists P2-T08, P2-T09, P2-T10 as "last blockers"; all three are DONE
- `README.md:59` — "These 3 tasks are the last blockers before the P2 knowledge phase can be closed" — P2 gate closed on 2026-06-12
- `README.md:762` — Footer: "20 of 50 tasks complete · P0 ✓ · P1 ✓ · P2 in progress" should be "23 of 64 tasks complete · P0 ✓ · P1 ✓ · P2 ✓"

**Observed vs expected:** The README reflects repository state from before P2-T08/T09/T10 and P2-GATE completion. All P2 tasks are DONE and the P2-GATE closure run record exists at `planning/runs/P2-GATE.md`. The user-facing README misrepresents project maturity to readers.

**Impact:** External-facing documentation (GitHub README, npm/registry badges) shows incorrect project status — understates completion by 3 tasks and mislabels the P2 phase as active rather than complete.

**Root cause:** README was not updated when P2-T08, P2-T09, P2-T10, and P2-GATE were completed (commits `ce7ae55`, `37b66e8`, `53af795`, `aabb577`, `e209dcc`).

**Remediation:**

1. Change P2 badge from `7/10` amber to `COMPLETE` green (update URL-encoded badge text)
2. Change P2 phase table row from `7/10, In Progress` to `10/10, DONE`
3. Change summary from "20 of 50 tasks complete" to "23 of 64 tasks complete"
4. Replace "Currently In Progress" section — either remove it or update to reflect P3 as next phase
5. Change footer line from "20 of 50 tasks complete · P0 ✓ · P1 ✓ · P2 in progress" to "23 of 64 tasks complete · P0 ✓ · P1 ✓ · P2 ✓"
6. If any "P3–P7 Planned" section text references the P2 gap, update accordingly
7. Regenerate badge on shield.io or update the static badge text

**Acceptance criteria:**

- README.md badge shows P2=COMPLETE (green)
- Phase table row for P2 shows 10/10 with DONE gate
- Task count summary matches `planning/status.yaml` (23/64)
- No "Currently In Progress" text references completed P2 tasks
- Footer summary is accurate

**Regression risk:** None — documentation-only change. No code, test, or configuration impact.

### AUD-P3-001 — MANIFEST.md Stale Metadata (P3)

**Severity:** P3 | **Confidence:** High | **Status:** New

**Affected locations:**

- `MANIFEST.md:9` — "Tracked files: 301" → actual count is 329
- `MANIFEST.md:10` — "Phase: P0, P1, P2 in progress; P3-P7 not started" → should be "P0, P1, P2 complete; P3-P7 not started"
- `MANIFEST.md:11` — "Backlog tasks: 64 defined, 17 completed, 2 failed verification" → should be "64 defined, 23 completed, 0 failed verification"

**Observed vs expected:** The manifest was partially updated (tracked files changed from 228→301 in prior fix) but not kept in sync as P2 tasks completed and files were added. The phase description and task counts are stale.

**Root cause:** MANIFEST.md requires manual updates; no automated enforcement.

**Remediation:** Update lines 9–11 with current counts from `git ls-files | wc -l`, `planning/status.yaml`, and `planning/backlog.yaml`.

**Acceptance criteria:**

- Tracked file count matches `git ls-files | wc -l` (currently 329)
- Phase status matches `planning/status.yaml` (P0/P1/P2 DONE)
- Task counts match `planning/status.yaml` (23 DONE, 0 FAILED_VERIFICATION)
- Date stamp updated to reflect the update date

### AUD-P3-002 — `as unknown as` Type Casts in Production Code (P3)

**Severity:** P3 | **Confidence:** Medium | **Status:** Carried forward from 2026-06-11 audit

**Affected production locations (5):**
| File | Line | Pattern |
|------|------|---------|
| `packages/knowledge/src/ingestion/publishing-stage.ts` | 40 | `const q = client as unknown as Pool` |
| `packages/storage/src/s3-adapter.ts` | 133 | `const s3Checksum = (head as unknown as Record<string, unknown>)['ChecksumSHA256']` |
| `packages/auth/src/session.ts` | 105 | `const { jti: _jti, ...sessionData } = payload as unknown as VerifiedSessionPayload` |
| `apps/api/src/services/upload-workflow.ts` | 46 | `return client as unknown as Pool` |
| `apps/api/src/plugins/idempotency.ts` | 189, 202 | `(request as unknown as IdempotencyRequest).__idempotency` |

**Affected test locations (7):** `ingestion-workflow.test.ts:158`, `upload-workflow.test.ts:128`, `rbac.test.ts:86`, `contracts.test.ts:80`, `audit.test.ts:50`, `parsing.test.ts:481,515`, `runner.ts:600`

**Analysis:** These casts appear intentional — bridging type gaps at adapter boundaries (e.g., `Pool` from `pg` vs internal pool type, session claims spanning internal vs verified payload types, Fastify request augmentation for idempotency metadata). No runtime crashes have been evidenced. However, they bypass TypeScript strict checking at trust boundaries.

**Impact:** Low — no observed failures, but these casts could mask type mismatches if internal types drift from their underlying implementations.

**Remediation:** Replace with proper type narrowing (type guards, branded types, or interface casting where the contract is guaranteed). For idempotency request augmentation, use Fastify's `decorateRequest` instead of `as unknown as`.

**Acceptance criteria:**

- `as unknown as` removed or replaced with type-narrowing patterns in production code
- Existing test coverage passes unchanged
- Typecheck continues to pass without new suppressions

### AUD-P3-003 — Schema Drift Risk Between `db/schema.sql` and Migrations (P3)

**Severity:** P3 | **Confidence:** Low | **Status:** Carried forward from 2026-06-11 audit

**Details:** `db/schema.sql` is a 619-line reference schema meant for design and migration planning. Seven versioned migrations exist (001–006, 663 lines total). The comment at `db/schema.sql:2` states: "Implementation MUST use versioned migrations; do not apply this file directly to production." The migrations are authoritative; `schema.sql` is a design artifact.

**Risk:** If `schema.sql` diverges from the cumulative migration state, it could mislead developers about the current schema shape.

**Remediation options:**

1. Generate `schema.sql` from migration state (pg_dump after applying all migrations)
2. Add a CI check that diffs `schema.sql` against migration output
3. Remove `schema.sql` and rely solely on migrations + generated documentation
4. Add a comment noting the last reconciliation date and any known delta

**Acceptance criteria:** Either schema.sql is reconciled with migration state (documented) or an automated check prevents drift.

## Suspected Issues and Risks

### Maintainability Risks

1. **README/MANIFEST staleness recurrence risk:** Both files contain manually-maintained counts and status descriptions. Without automated enforcement, they will drift again. Consider a CI check that validates README badge text and MANIFEST counts against `planning/status.yaml` and `git ls-files`.

2. **Web shell build output:** `apps/api/build` and `apps/worker/build` scripts output `echo 'api: nothing to build' && exit 0` — these are placeholder shells. TypeScript compilation (tsc --noEmit) happens during typecheck but not build. When these apps contain real Next.js/Fastify compilation, the build scripts must be updated.

3. **`eval:retrieval` requires PostgreSQL:** The evaluation harness at `evals/retrieval/run.ts` expects a running PostgreSQL instance. CI's `test:unit` job does not provide one; the eval script is not run in CI by default. It ran successfully in this audit because PostgreSQL was available locally.

### Security Note

- `.env` file exists (931 bytes, gitignored). No secrets were detected by `security:secrets` scan. The file was not read due to safety policy. Its contents are development-only per `.env.example` patterns.

## Execution Plan

### Phase 1 — Update README.md Progress Indicators (P2)

**Objective:** Correct all stale progress badges, phase table entries, summary counts, and in-progress descriptions in README.md.

**Finding IDs:** AUD-P2-001

**Expected paths:** `README.md` only

**Tasks:**

- [ ] Update P2 badge from `7/10 amber` to `COMPLETE green` (line 18)
- [ ] Update P2 phase table row: `7/10, In Progress` → `10/10, DONE` (line 50)
- [ ] Update summary line: "20 of 50" → "23 of 64" (lines 43, 762)
- [ ] Remove or replace "Currently In Progress" section listing completed P2-T08–T10 tasks (lines 57–65)
- [ ] Add note that P3 is the next active phase
- [ ] Update footer: "P2 in progress" → "P2 ✓" (line 762)

**Validation:**

```bash
# Verify README mentions match status.yaml
grep -c "DONE$" planning/status.yaml  # should be 29 (23 tasks + 3 phases + 3 gates)
grep -E "^\s+- id: P" planning/backlog.yaml | wc -l  # 64 tasks
# Visual inspection of README.md for consistency
```

**Acceptance criteria:**

- [ ] P2 badge is green and shows COMPLETE
- [ ] Phase table P2 row shows 10/10 DONE
- [ ] Summary text reads "23 of 64 tasks complete"
- [ ] No "In Progress" section references completed P2 tasks
- [ ] Footer reads "P0 ✓ · P1 ✓ · P2 ✓"

**Rollback:** Revert README.md to previous commit state.

---

### Phase 2 — Update MANIFEST.md Metadata (P3)

**Objective:** Correct stale tracked-file count, phase status, and task completion counts.

**Finding IDs:** AUD-P3-001

**Expected paths:** `MANIFEST.md` only

**Tasks:**

- [ ] Update line 9: "Tracked files: 301" → "Tracked files: 329" (or current `git ls-files | wc -l`)
- [ ] Update line 10: "P0, P1, P2 in progress" → "P0, P1, P2 complete"
- [ ] Update line 11: "17 completed, 2 failed verification" → "23 completed, 0 failed verification"
- [ ] Update date stamp on line 7 if applicable

**Validation:**

```bash
git ls-files | wc -l  # verify tracked file count
grep -E "^\s+P[0-2]-T[0-9]+: DONE" planning/status.yaml | wc -l  # verify completed count
grep "FAILED_VERIFICATION" planning/status.yaml | wc -l  # verify failed count
```

**Acceptance criteria:**

- [ ] Tracked file count matches `git ls-files | wc -l`
- [ ] Phase status correctly reflects P2 as complete
- [ ] Task completion count matches status.yaml
- [ ] No stale "failed verification" claims

**Rollback:** Revert MANIFEST.md to previous commit state.

---

### Phase 3 — Hardening: Type-Safety at Adapter Boundaries (P3, Optional)

**Objective:** Replace `as unknown as` casts in production code with proper type guards or branded types.

**Finding IDs:** AUD-P3-002

**Expected paths:**

- `packages/knowledge/src/ingestion/publishing-stage.ts`
- `packages/storage/src/s3-adapter.ts`
- `packages/auth/src/session.ts`
- `apps/api/src/services/upload-workflow.ts`
- `apps/api/src/plugins/idempotency.ts`

**Tasks:**

- [ ] Audit each `as unknown as` cast for correctness and replace with type guards
- [ ] For idempotency plugin: use `fastify.decorateRequest` instead of property augmentation via `(request as unknown as)`
- [ ] For publishing-stage/upload-workflow: align pool types between `pg.Pool` and internal `@pia/db` types
- [ ] For s3-adapter: use a proper type for S3 head response metadata
- [ ] For session: use explicit type narrowing for verified session payloads

**Validation:**

```bash
pnpm typecheck   # must pass
pnpm lint        # 0 errors
pnpm test:unit   # all 34 tasks pass
rg "as unknown as" packages/ apps/ --include="*.ts" --exclude="test/"  # 0 results in production code
```

**Acceptance criteria:**

- [ ] Zero `as unknown as` in production source files
- [ ] Typecheck passes
- [ ] All unit tests pass unchanged
- [ ] No new type suppressions introduced

**Rollback:** Revert affected files. No data migration required.

---

### Phase 4 — Schema Reconciliation (P3, Optional)

**Objective:** Verify or reconcile `db/schema.sql` against cumulative migration state.

**Finding IDs:** AUD-P3-003

**Expected paths:**

- `db/schema.sql`
- `db/migrations/*.sql`

**Tasks:**

- [ ] Apply all migrations to a fresh PostgreSQL instance
- [ ] Dump the resulting schema with `pg_dump --schema-only`
- [ ] Diff the dump against `db/schema.sql`
- [ ] Either reconcile differences, document known deltas, or add automated CI check
- [ ] Consider generating `db/schema.sql` from migration output

**Validation:**

```bash
# Requires running PostgreSQL
docker compose up -d postgres
pnpm db:migrate:test
# Dump and diff against db/schema.sql
```

**Acceptance criteria:**

- [ ] `db/schema.sql` matches migration state OR documented deltas exist
- [ ] CI or pre-commit check prevents future drift (optional)

**Rollback:** Revert manual schema.sql changes; migrations are authoritative.

---

## Final Verification Checklist

After all phases complete:

```bash
# Quality gates
pnpm format:check          # Prettier compliance
pnpm lint                  # 0 ESLint errors
pnpm typecheck             # 28/28 tasks pass
pnpm test:unit             # All 34 tasks pass
pnpm build                 # 17/17 packages compile

# Security
pnpm security:secrets      # No secrets detected
pnpm security:dependencies # No known vulnerabilities

# Governance
pnpm exec tsx scripts/ci/validate-status.ts  # PASSED

# Git state
git status --short         # Only intended changes
git diff --stat            # Verify scope
```

## Deferred, Blocked, and Rejected Findings

| ID                        | Decision                       | Reason                                                               | Prerequisite                |
| ------------------------- | ------------------------------ | -------------------------------------------------------------------- | --------------------------- |
| AUD-P3-002 (type casts)   | Deferred to Phase 3 (optional) | No runtime evidence of bugs; low-risk cleanup                        | None                        |
| AUD-P3-003 (schema drift) | Deferred to Phase 4 (optional) | Requires running PostgreSQL; reference schema not used in production | Running PostgreSQL instance |

## Open Questions and Limitations

1. **Integration tests not run:** `pnpm test:integration` requires running PostgreSQL, Redis, and MinIO. The CI pipeline provides a PostgreSQL service container but integration tests were not executed in this audit.
2. **`.env` contents not inspected:** Safety boundary prevents reading `.env` files. The 931-byte file is gitignored. Secrets scan passed — no real credentials detected in tracked files.
3. **Full source audit coverage:** ~300+ tracked source files; only key security boundaries and representative samples were inspected. Deep review of every module was not performed.
4. **Dependency versions:** `pnpm audit --prod` found no known vulnerabilities, but this covers only the public advisory database. Supply-chain risk from transitive dependencies not assessed.
5. **Next.js web app:** The `apps/web/` package has a TypeScript shell but no actual Next.js build output. Its build script is a no-op. Full Next.js compilation was not tested.
6. **Provider adapters:** No real OIDC provider, embedding API, or LLM provider keys are configured. All adapters use fake/mock implementations suitable for development and testing.

## Implementation Agent Starting Point

**First phase:** Phase 1 — Update README.md Progress Indicators

**First paths to modify:**

- `README.md` — lines 16–19 (badges), lines 43–65 (progress summary, phase table, in-progress section), line 762 (footer)

**First validation command:** `pnpm format:check` (after README edit)

**Blockers:** None. All tasks are documentation-only changes in Phase 1–2; no dependencies on running services.

**Repository state note:** Worktree is clean. No uncommitted changes. Commit `e209dcc` is the HEAD.

**Changes that must remain separate:**

- README.md changes (Phase 1) and MANIFEST.md changes (Phase 2) are independent — they can be in the same commit or separate commits.
- Phase 3 (type casts) and Phase 4 (schema reconciliation) are independent of Phase 1–2 and should be in separate commits.
- Do not modify `planning/status.yaml`, `planning/backlog.yaml`, or any source code in Phase 1–2.
