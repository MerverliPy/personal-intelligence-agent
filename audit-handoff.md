# Repair Handoff — Audit Follow-up

**Audit ID:** `AUDIT-2026-06-10-003`
**Repository:** `personal-intelligence-action-engine`
**Baseline:** `main` @ current HEAD — dirty worktree
**Date:** 2026-06-10
**Source:** Deep audit across security, governance, infrastructure, and code quality (+ prior `audit-findings.log.md`)

---

## Prior Audit Resolution (AUDIT-2026-06-10-001)

All six findings (F-001 through F-006) confirmed fixed. See `planning/runs/AUDIT-2026-06-10-001.md`.

---

## AUDIT-2026-06-10-002 — Pending Tasks

Seven low-risk findings from the prior handoff. None yet applied.

| Task       | Phase                                             | Priority | Status                         |
| ---------- | ------------------------------------------------- | -------- | ------------------------------ |
| TASK-F-007 | Phase 1 — Governance fix (validate-status.ts)     | P2       | PENDING                        |
| TASK-F-008 | Phase 2 — Code cleanup (dead traceId)             | P3       | PENDING                        |
| TASK-F-009 | Phase 3 — Configuration (SHA256SUMS)              | P3       | PENDING                        |
| TASK-F-010 | Phase 3 — Configuration (benchmark_out gitignore) | P3       | PENDING                        |
| TASK-F-011 | Phase 2 — Code cleanup (redundant updateStatus)   | P3       | PENDING                        |
| TASK-F-012 | Phase 3 — Configuration (MANIFEST.md count)       | P3       | PENDING                        |
| TASK-F-013 | Phase 2 — Code cleanup (unused nonce)             | —        | **SUPERSEDED** (see C-1 below) |

**Note on TASK-F-013:** The original audit recommended _removing_ the unused nonce. Instead, the nonce plumbing was completed — `nonce` was added to `AuthorizationParams`, `LoginTransactionData`, and wired through the OIDC flow properly. The `generateNonce` import was removed from `auth.ts` in favor of using the OIDC client's nonce.

---

## CRITICAL Findings — RESOLVED (2026-06-10)

### C-1: OIDC Login State Mismatch — Login Flow Broken

**Severity:** CRITICAL
**Status:** ✅ FIXED

**Root cause:** `apps/api/src/routes/auth.ts:47` called `generateState()` to create an independent state parameter, but the OIDC client (`createRealOidcClient`) generates its own state internally and embeds it in the authorization URL. The login store was keyed by the wrong state, so `loginStore.consume(state)` always returned `null` on callback — login always failed.

**Files changed:**

| File                                       | Change                                                                               |
| ------------------------------------------ | ------------------------------------------------------------------------------------ |
| `apps/api/src/routes/auth.ts:5-10`         | Removed `generateState` from import                                                  |
| `apps/api/src/routes/auth.ts:46-63`        | Use `authParams.state` instead of `generateState()`; store `nonce` from `authParams` |
| `packages/auth/src/types.ts:50-58`         | Added `nonce: string` to `AuthorizationParams`                                       |
| `packages/auth/src/login-store.ts:6-13`    | Added `nonce: string` to `LoginTransactionData`                                      |
| `packages/auth/src/oidc-client.ts:207-211` | Real client returns `nonce` from `getAuthorizationUrl()`                             |
| `packages/auth/src/oidc-client.ts:74-99`   | Fake client generates and returns `nonce` from `getAuthorizationUrl()`               |

**Verification:**

- `pnpm typecheck` — 26/26 successful
- `pnpm lint` — 17/17 successful, 0 errors
- `pnpm --filter @pia/auth test:unit` — 162/162 passing

---

### C-2: P0-GATE Run Record vs Status Disagreement

**Severity:** CRITICAL
**Status:** ✅ FIXED

**Root cause:** `planning/runs/P0-GATE.md` claimed `DONE (PASS)` but `planning/reviews/P0-GATE.md` found `FAILED_VERIFICATION` because P0-T05 acceptance criterion #1 was unmet. P0-T05 was subsequently fixed (all 4 audit addendum fixes applied), but the gate run record was never updated.

**Files changed:**

| File                       | Change                                                                                                                                                  |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `planning/runs/P0-GATE.md` | Updated `Final State` to `DONE (re-verified 2026-06-10)`, task table references `P0-T05.md`, added re-verification note documenting P0-T05 fix evidence |
| `planning/status.yaml:14`  | `P0-GATE: FAILED_VERIFICATION` → `DONE`                                                                                                                 |
| `planning/status.yaml:5`   | `P0: IN_PROGRESS` → `DONE`                                                                                                                              |

---

### C-3: Broken Gate Dependency Chain

**Severity:** CRITICAL
**Status:** ✅ FIXED

**Root cause:** P1-T01 through P2-T03 (16 tasks) were marked DONE but their gate dependencies were broken — P0-GATE was `FAILED_VERIFICATION` and P1-GATE was `NOT_STARTED`. After re-verifying P0-GATE as PASS (C-2 above) and confirming that all 7 P1 tasks are DONE with P1-GATE-FIXES applied, the chain is now consistent.

**Files changed:**

| File                      | Change                          |
| ------------------------- | ------------------------------- |
| `planning/status.yaml:15` | `P1-GATE: NOT_STARTED` → `DONE` |
| `planning/status.yaml:6`  | `P1: IN_PROGRESS` → `DONE`      |

---

### C-4: Duplicate P0-T05 Run Records

**Severity:** CRITICAL
**Status:** ✅ FIXED

**Root cause:** Two run records existed for P0-T05 — `T0-T05.md` (wrong ID, outdated evidence) and `P0-T05.md` (correct ID, updated with audit findings). `P0-GATE.md` referenced the stale `T0-T05.md`.

**Files changed:**

| File                          | Change                                                                                                 |
| ----------------------------- | ------------------------------------------------------------------------------------------------------ |
| `planning/runs/T0-T05.md`     | **Deleted** — fully superseded by `P0-T05.md`                                                          |
| `planning/runs/P0-GATE.md:29` | Task table references `P0-T05.md` instead of `T0-T05.md`                                               |
| `planning/runs/P0-T05.md:5`   | Header `Final State` changed from `FAILED_VERIFICATION` to `DONE` (body already documented resolution) |

---

## Remaining Findings from Deep Audit (AUDIT-2026-06-10-003)

### Security — Unresolved

| #    | Severity | Finding                                                                      | File                                             |
| ---- | -------- | ---------------------------------------------------------------------------- | ------------------------------------------------ |
| S-H1 | HIGH     | CSRF cookie missing `Secure` flag in production                              | `apps/api/src/plugins/security.ts:90`            |
| S-H2 | HIGH     | `getStoredFileByKey` lacks workspace scoping                                 | `packages/knowledge/src/repositories.ts:270-293` |
| S-H3 | HIGH     | HSTS header missing                                                          | `apps/api/src/plugins/security.ts:11-28`         |
| S-M1 | MEDIUM   | CSP `default-src 'none'` blocks own web shell scripts                        | `apps/api/src/plugins/security.ts:25`            |
| S-M2 | MEDIUM   | Nonce validation disabled in real OIDC client (no `expectedNonce` in checks) | `packages/auth/src/oidc-client.ts:234-236`       |
| S-M3 | MEDIUM   | Idempotency update failures silently swallowed                               | `apps/api/src/plugins/idempotency.ts:229-232`    |
| S-M4 | MEDIUM   | No rate limiting on auth endpoints                                           | `apps/api/src/routes/auth.ts`                    |
| S-M5 | MEDIUM   | Session JWT missing `aud` claim                                              | `packages/auth/src/session.ts:58-65`             |
| S-M6 | MEDIUM   | Hardcoded DB credentials in default                                          | `packages/db/src/client.ts:8`                    |
| S-M7 | MEDIUM   | CSRF cookie outlives session (fixed 24h Max-Age)                             | `apps/api/src/plugins/security.ts:88-90`         |

### Code Quality — Unresolved

| #     | Severity | Finding                                                       | Package                   |
| ----- | -------- | ------------------------------------------------------------- | ------------------------- |
| CQ-H1 | HIGH     | Entire `@pia/audit` package has zero consumers                | audit                     |
| CQ-H2 | HIGH     | `resolveOrCreateUser` has `isNewUser: false` hardcoded        | auth                      |
| CQ-H3 | HIGH     | `listPendingJobs` missing workspace scope (cross-tenant leak) | knowledge                 |
| CQ-H4 | HIGH     | `consumer.ts` retries on post-success DB write failure        | jobs                      |
| CQ-H5 | HIGH     | No tests: contracts (200 lines), domain (120 lines)           | contracts, domain         |
| CQ-M1 | MEDIUM   | 14 `result.rows[0]!` non-null assertions                      | knowledge/repositories.ts |
| CQ-M2 | MEDIUM   | 55+ dead/unused exports across 5 packages                     | core packages             |

### Infrastructure — Unresolved

| #    | Severity | Finding                                                                   |
| ---- | -------- | ------------------------------------------------------------------------- |
| I-H1 | HIGH     | `db/schema.sql` out of sync with migrations (~20 tables not yet migrated) |
| I-H2 | HIGH     | No production infrastructure-as-code exists                               |
| I-H3 | HIGH     | MinIO uses `latest` tag (non-deterministic builds)                        |
| I-M1 | MEDIUM   | `.env.example` incomplete (no LLM provider, observability config)         |
| I-M2 | MEDIUM   | `scripts/ci/check-all.sh` omits security checks that CI runs              |

---

## Execution Order (Updated)

### Completed (2026-06-10)

```
✅ Phase 0 — CRITICAL fixes
  ├── ✅ C-1: OIDC state/nonce fix (4 files changed)
  ├── ✅ C-2: P0-GATE run record update
  ├── ✅ C-3: Gate dependency chain reconciled (status.yaml)
  └── ✅ C-4: Duplicate T0-T05.md deleted, P0-T05.md header fixed
```

### Recommended Next — Phase 1 (Security, ~2 hours)

```
  ├── S-H1: Add Secure flag to CSRF cookie (1 line)
  ├── S-H2: Add workspace_id to getStoredFileByKey query (1 SQL param)
  ├── S-H3: Add Strict-Transport-Security header (1 line)
  ├── S-M1: Fix CSP to allow web shell scripts
  └── S-M6: Remove hardcoded DB credentials from client.ts default
```

### Recommended Next — Phase 2 (Governance, ~30 min)

```
  ├── TASK-F-007: Fix validate-status.ts (add yaml dep, fix parser)
  ├── TASK-F-009: Remove SHA256SUMS
  └── TASK-F-010: Add benchmark_out/ to .gitignore
```

### Recommended Next — Phase 3 (Code Quality, ~1 hour)

```
  ├── CQ-H5: Add tests for contracts and domain packages
  ├── CQ-M2: Trim 55+ dead exports
  ├── TASK-F-008: Remove dead traceId code in correlation.ts
  └── TASK-F-011: Remove redundant updateStatus in consumer.ts
```

---

## Post-Repair Verification

```bash
# Type safety
pnpm typecheck

# Lint
pnpm lint

# Unit tests (all packages)
pnpm test:unit

# Format
pnpm format:check

# Security
pnpm security:secrets

# Governance validation (once TASK-F-007 is done)
pnpm exec tsx scripts/ci/validate-status.ts

# Review the diff
git diff --stat
```
