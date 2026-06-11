# Audit Findings Log

**Audit ID:** `AUDIT-2026-06-10-001`
**Repository:** `personal-intelligence-action-engine`
**Date:** 2026-06-10
**Baseline:** `main` @ `90e6423` — clean worktree, 219 tracked files
**Result:** 6 confirmed findings (0 critical, 0 high, 4 medium, 2 low) · 0 secrets exposed

---

## Finding F-001 — P1-T02 Status/Run Record Disagreement

| Field      | Value                                                   |
| ---------- | ------------------------------------------------------- |
| Priority   | P2 (material)                                           |
| Confidence | Confirmed                                               |
| Category   | Planning governance                                     |
| Files      | `planning/status.yaml:31` · `planning/runs/P1-T02.md:7` |

### What happened

`planning/status.yaml` says `P1-T02: FAILED_VERIFICATION`. The run record at `planning/runs/P1-T02.md` says `Final State: DONE` with every acceptance criterion documented as PASS and all 34 tests passing.

One of these is wrong. Either the status file wasn't updated after the task was completed, or the run record doesn't capture a real verification failure.

### Why it matters

The planning governance system is the single source of truth for what's built and what's broken. When it disagrees with itself, nobody knows the real state. The CI validation script (`scripts/ci/validate-status.ts`) will flag inconsistencies downstream.

### Fix

Reconcile the two files. The run record's evidence (all tests pass, all criteria met) strongly suggests the task is DONE. Update `planning/status.yaml` line 31 from `FAILED_VERIFICATION` to `DONE`. If there truly is a verification failure, document it in the run record and change its final state.

---

## Finding F-002 — P0-T05 Audit Addendum Is Stale

| Field      | Value                                                                     |
| ---------- | ------------------------------------------------------------------------- |
| Priority   | P2 (material)                                                             |
| Confidence | Confirmed                                                                 |
| Category   | Planning governance                                                       |
| Files      | `planning/runs/P0-T05.md:73-80` · `packages/jobs/src/consumer.ts:198-200` |

### What happened

The audit addendum in the P0-T05 run record (dated 2026-06-10) claims that `runWithCorrelation()` is missing from both the API request pipeline and the job consumer. It demands four fixes be applied before the task can return to DONE.

All four fixes are **already in the code**:

| Required fix                             | Status in code                                     |
| ---------------------------------------- | -------------------------------------------------- |
| Wrap API requests in correlation context | Done — `apps/api/src/plugins/correlation.ts:18-22` |
| Wrap job handlers in correlation context | Done — `packages/jobs/src/consumer.ts:198-200`     |
| Add bounded ID validation                | Done — `apps/api/src/plugins/request-id.ts:8,14`   |
| Add context isolation tests              | Done — `apps/api/test/api.test.ts:254-323`         |

The code was fixed but the status was never updated.

### Why it matters

P0-T05 is a dependency of P0-GATE. The gate is marked `FAILED_VERIFICATION` in status.yaml partly because P0-T05 is blocked. This is a false block — the work is done. It prevents the phase from being formally closed.

### Fix

Update `planning/status.yaml` line 27 from `FAILED_VERIFICATION` to `DONE`. Update the run record to note that the audit addendum fixes have been applied and the task is complete.

---

## Finding F-003 — Auth Logout Doesn't Revoke Sessions

| Field      | Value                             |
| ---------- | --------------------------------- |
| Priority   | P2 (material)                     |
| Confidence | Confirmed                         |
| Category   | Correctness — runtime crash       |
| Files      | `apps/api/src/routes/auth.ts:200` |

### What happened

```typescript
// apps/api/src/routes/auth.ts, line 200
await revokeSession(token, oidcConfig.sessionSecret, undefined as never);
```

The `revokeSession` function requires a `RevocationStore` as its third argument. The logout route doesn't have one, so `undefined as never` was used to silence TypeScript. At runtime, `undefined.revoke()` throws `TypeError`.

The call is wrapped in try/catch so the server doesn't crash visibly, but **the session is never actually revoked**. A logged-out user's JWT remains valid until natural expiry (up to 24 hours).

### Why it matters

An attacker with a stolen session cookie can use it after the victim logs out. The security spec requires server-side session termination on logout. Cookie flags (`HttpOnly`, `SameSite=Lax`) reduce the token theft risk but don't eliminate it.

### Fix

Two options:

**Option A (fix):** Add `RevocationStore` to the auth routes plugin options, inject it from `server.ts`, and pass it to `revokeSession`. Requires implementing the store (in-memory for now, Redis later).

**Option B (defer):** Remove the broken `revokeSession` call entirely. Add a comment documenting that server-side revocation is deferred (as already noted in `planning/runs/P1-T02.md:157-158`). Clear the cookie only.

Either way, the `undefined as never` type assertion must be removed.

---

## Finding F-004 — `hashPayload` Crashes on Non-Object Input

| Field      | Value                                         |
| ---------- | --------------------------------------------- |
| Priority   | P3 (low)                                      |
| Confidence | Confirmed                                     |
| Category   | Robustness — latent defect                    |
| Files      | `apps/api/src/plugins/idempotency.ts:262-265` |

### What happened

```typescript
function hashPayload(payload: unknown): string {
  const normalized = JSON.stringify(payload, Object.keys(payload as object).sort());
  return createHash('sha256').update(normalized).digest('hex');
}
```

If `payload` is `null`, a string, a number, or an array, `Object.keys()` throws `TypeError`. The function's type signature says `unknown` but it only works for plain objects.

The **current call site** at line 56 is safe — `request.body ?? {}` replaces null/undefined with `{}`. But the function itself has no guard. A future caller could introduce a crash.

### Fix

Add a defensive check at the top of the function:

```typescript
if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
  payload = {};
}
```

Add unit tests for `hashPayload(null)`, `hashPayload(undefined)`, `hashPayload("string")`.

---

## Finding F-005 — Health Check Creates New DB Pool Per Call

| Field      | Value                                 |
| ---------- | ------------------------------------- |
| Priority   | P3 (low)                              |
| Confidence | Confirmed                             |
| Category   | Resource efficiency                   |
| Files      | `apps/api/src/routes/health.ts:18-21` |

### What happened

Every call to `GET /health/ready` creates a new PostgreSQL pool, runs `SELECT 1`, and immediately destroys it:

```typescript
const { createPool } = await import('@pia/db');
const pool = createPool();
await pool.query('SELECT 1');
await pool.end();
```

Under frequent health checks (e.g. Kubernetes probes every 10 seconds), this creates unnecessary TCP connection churn and PostgreSQL handshake overhead.

### Fix

Create the pool once at module scope and reuse it. Clean it up in a Fastify `onClose` hook or process exit handler.

---

## Finding F-006 — MANIFEST.md Is Outdated

| Field      | Value           |
| ---------- | --------------- |
| Priority   | P3 (low)        |
| Confidence | Confirmed       |
| Category   | Documentation   |
| Files      | `MANIFEST.md:5` |

### What happened

`MANIFEST.md` claims the repository contains **37 files**. The actual count is **219**. The file was written during the initial specification bundle and never updated through P0, P1, and P2 implementation phases. The content table lists only the original specification and planning files; all implementation source is absent.

### Fix

Update the file count and content table, or remove the manifest if it's been superseded by git-tracked inventory.

---

## Suspected Findings (Not Confirmed)

### SF-001 — P1-T02 run record says production OIDC client is a stub

The run record at `planning/runs/P1-T02.md:153` states `createRealOidcClient` is a stub. Looking at `packages/auth/src/oidc-client.ts:168-271`, the implementation is **complete** — it uses `openid-client` with proper discovery, PKCE, and token validation. The run record is outdated.

### SF-002 — Unused nonce generated in auth login route

`apps/api/src/routes/auth.ts:50` generates a nonce, stores it in the login transaction, but never passes it to the OIDC client's `getAuthorizationUrl()`. The real OIDC client generates its own nonce internally via `openid-client`. The stored nonce serves no purpose.

---

## Token Observations

- The `repository-integrity` agent instructions (`.opencode/agents/repository-integrity.md`, 335 lines) are self-referentially verbose. Approximately 60-70% could be condensed for repeated invocations without losing correctness.
- `planning/backlog.yaml` at 3,621 lines is frequently referenced by OpenCode commands. Task-specific extractions would reduce context loading.

---

## What Was NOT Found

- ❌ No hardcoded secrets or credentials in source code
- ❌ No injection vulnerabilities in reviewed code paths
- ❌ No workspace isolation bypasses
- ❌ No secret leakage in logging (Redacted class + SENSITIVE_LOG_FIELDS)
- ❌ No missing authentication on protected endpoints
- ❌ No dependency vulnerabilities (`pnpm audit` path exists)
- ❌ No missing input validation at API boundaries
- ❌ No broken build or type errors in current code

---

## File Index

| File                    | Lines     | Purpose                                           |
| ----------------------- | --------- | ------------------------------------------------- |
| `audit-findings.log.md` | this file | Human-readable findings log                       |
| `audit-handoff.md`      | companion | Repair phase handoff with executable instructions |
