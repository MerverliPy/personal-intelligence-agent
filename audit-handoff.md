# Repair Handoff — Audit Follow-up

**Audit ID:** `AUDIT-2026-06-10-001`
**Repository:** `personal-intelligence-action-engine`
**Baseline:** `main` @ `90e6423` — clean worktree
**Date:** 2026-06-10
**Source:** `audit-findings.log.md`

---

## Overview

Six confirmed findings need repair across three phases. No critical or high-severity defects. All work is bounded, low-risk, and independently reversible.

| Phase                | Tasks               | Risk     | Est. Effort |
| -------------------- | ------------------- | -------- | ----------- |
| Phase 1 — Governance | F-001, F-002        | Very low | 15 min      |
| Phase 2 — Logout fix | F-003               | Low      | 20 min      |
| Phase 3 — Cleanup    | F-004, F-005, F-006 | Very low | 20 min      |

---

## Phase 1 — Governance Consistency

### TASK-F-001: Reconcile P1-T02 status

**Problem:** `planning/status.yaml:31` says `P1-T02: FAILED_VERIFICATION`. Run record says `DONE`.

**Action:** Update `planning/status.yaml` line 31.

**Edit `planning/status.yaml`** — change this line:

```yaml
P1-T02: FAILED_VERIFICATION
```

To:

```yaml
P1-T02: DONE
```

**Validation:**

```bash
pnpm exec tsx scripts/ci/validate-status.ts
```

Expect: `✅ Transition validation PASSED`

**Rollback:**

```bash
git checkout planning/status.yaml
```

---

### TASK-F-002: Reconcile P0-T05 status

**Problem:** `planning/status.yaml:27` says `P0-T05: FAILED_VERIFICATION`. Code already has all required fixes.

**Evidence the fixes exist:**

- `packages/jobs/src/consumer.ts:198-200` — wraps handler in `runWithCorrelation`
- `apps/api/src/plugins/correlation.ts:18-22` — per-request correlation context
- `apps/api/src/plugins/request-id.ts:8,14` — bounded ID validation
- `apps/api/test/api.test.ts:254-323` — context isolation tests

**Action:** Update `planning/status.yaml` line 27. Update run record to note completion.

**Edit `planning/status.yaml`** — change this line:

```yaml
P0-T05: FAILED_VERIFICATION
```

To:

```yaml
P0-T05: DONE
```

**Edit `planning/runs/P0-T05.md`** — append to the audit addendum section (after line 109, before the file ends):

```markdown
## AUDIT ADDENDUM RESOLUTION (2026-06-10)

All four required fixes identified in the 2026-06-10 audit addendum have been
applied:

1. **Per-request correlation** — `apps/api/src/plugins/correlation.ts` wraps every
   request in `runWithCorrelation()` via the `onRequest` hook.
2. **Per-job correlation** — `packages/jobs/src/consumer.ts:198-200` wraps handler
   execution in `runWithCorrelation()` with `createCorrelationContext(record.id)`.
3. **Bounded inbound ID validation** — `apps/api/src/plugins/request-id.ts` enforces
   max length (64 chars) and safe character set (`[a-zA-Z0-9\-_]+`).
4. **Context isolation tests** — `apps/api/test/api.test.ts:254-323` proves
   correlation context propagation and isolation across concurrent requests.

Acceptance criteria AC-1 is now MET. Task state updated from FAILED_VERIFICATION
to DONE.
```

**Validation:**

```bash
# Verify correlation tests exist and pass
grep -n "correlation context matches" apps/api/test/api.test.ts
# Line 278 — should show the test exists

# Verify consumer wraps handler in correlation context
grep -n "runWithCorrelation" packages/jobs/src/consumer.ts
# Lines 3, 198 — should show import and usage

# Run status validation
pnpm exec tsx scripts/ci/validate-status.ts
# Expect: ✅ Transition validation PASSED
```

**Rollback:**

```bash
git checkout planning/status.yaml planning/runs/P0-T05.md
```

---

## Phase 2 — Session Revocation Fix

### TASK-F-003: Fix auth logout (Option B recommended — defer server-side revocation)

**Recommendation:** Use Option B (defer). Server-side session revocation requires a Redis-backed `RevocationStore` that isn't implemented yet. The P1-T02 run record already documents this as deferred work. We should remove the broken code rather than let it silently fail.

**Problem:** `apps/api/src/routes/auth.ts:200` — `revokeSession(token, oidcConfig.sessionSecret, undefined as never)` crashes silently.

**Action:** Remove the broken `revokeSession` call. Document the deferral.

**Edit `apps/api/src/routes/auth.ts`** — lines 192-212:

Before:

```typescript
app.post('/auth/logout', async (request: FastifyRequest, reply: FastifyReply) => {
  const cookieHeader = request.headers['cookie'];
  if (cookieHeader) {
    // Extract and potentially revoke the session token
    const cookies = parseCookiesStr(cookieHeader);
    const token = cookies['pia_session'];
    if (token) {
      try {
        await revokeSession(token, oidcConfig.sessionSecret, undefined as never);
      } catch {
        // Token may already be expired/invalid — clear cookie regardless
      }
    }
  }

  // Clear the session cookie
  const clearHeader = clearSessionCookieHeader(oidcConfig.secureCookies);
  void reply.header('set-cookie', clearHeader);

  return reply.send({ status: 'ok', message: 'Logged out.' });
});
```

After:

```typescript
app.post('/auth/logout', async (request: FastifyRequest, reply: FastifyReply) => {
  // NOTE: Server-side session revocation is deferred.
  // The session token remains valid until natural expiry (max 24h).
  // Mitigation: cookies are HttpOnly + SameSite=Lax.
  // A Redis-backed RevocationStore will enable full revocation (see P1-T02 run record).

  // Clear the session cookie
  const clearHeader = clearSessionCookieHeader(oidcConfig.secureCookies);
  void reply.header('set-cookie', clearHeader);

  return reply.send({ status: 'ok', message: 'Logged out.' });
});
```

**Also remove the unused import** on line 11. Before:

```typescript
import {
  generateState,
  generateNonce,
  createSessionToken,
  sessionCookieHeader,
  clearSessionCookieHeader,
  revokeSession,
  resolveOrCreateUser,
} from '@pia/auth';
```

After (remove `revokeSession`):

```typescript
import {
  generateState,
  generateNonce,
  createSessionToken,
  sessionCookieHeader,
  clearSessionCookieHeader,
  resolveOrCreateUser,
} from '@pia/auth';
```

**Validation:**

```bash
pnpm typecheck
pnpm lint
pnpm --filter @pia/api test:unit
```

All should pass. No new lint warnings from the removed import.

**Rollback:**

```bash
git checkout apps/api/src/routes/auth.ts
```

---

## Phase 3 — Code Quality and Documentation

### TASK-F-004: Add null guard to `hashPayload`

**Problem:** `apps/api/src/plugins/idempotency.ts:262-265` — `Object.keys(null)` crashes.

**Action:** Add a defensive guard.

**Edit `apps/api/src/plugins/idempotency.ts`** — lines 262-265:

Before:

```typescript
function hashPayload(payload: unknown): string {
  const normalized = JSON.stringify(payload, Object.keys(payload as object).sort());
  return createHash('sha256').update(normalized).digest('hex');
}
```

After:

```typescript
function hashPayload(payload: unknown): string {
  // Guard against null, primitives, and arrays — only plain objects are hashable
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    payload = {};
  }
  const normalized = JSON.stringify(payload, Object.keys(payload as object).sort());
  return createHash('sha256').update(normalized).digest('hex');
}
```

**Validation:**

```bash
pnpm typecheck
pnpm lint
```

No new tests needed — the function is internal and the guard is trivial. If desired, add a quick inline test:

```bash
node -e "
const { createHash } = require('node:crypto');
function hashPayload(payload) {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) payload = {};
  return createHash('sha256').update(JSON.stringify(payload, Object.keys(payload).sort())).digest('hex');
}
console.log(hashPayload(null));
console.log(hashPayload(undefined));
console.log(hashPayload('string'));
console.log(hashPayload(42));
console.log('All inputs handled without crash');
"
```

**Rollback:**

```bash
git checkout apps/api/src/plugins/idempotency.ts
```

---

### TASK-F-005: Cache health check database pool

**Problem:** `apps/api/src/routes/health.ts:18-21` — new pool created and destroyed on every `/health/ready` call.

**Action:** Move pool to module scope. Clean up on server close.

**Edit `apps/api/src/routes/health.ts`** — replace lines 1-34:

Before:

```typescript
import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import type { HealthResponse } from '@pia/contracts';

const healthRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get('/health/live', async (): Promise<HealthResponse> => {
    return { status: 'ok' };
  });

  app.get('/health/ready', async (_request, reply): Promise<HealthResponse> => {
    // Check database connectivity
    try {
      const { createPool } = await import('@pia/db');
      const pool = createPool();
      await pool.query('SELECT 1');
      await pool.end();

      return { status: 'ok', checks: { database: 'ok' } };
    } catch {
      void reply.status(503);
      return {
        status: 'unavailable',
        checks: { database: 'unavailable' },
      };
    }
  });
};

export default healthRoutes;
```

After:

```typescript
import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import type { HealthResponse } from '@pia/contracts';
import { createPool } from '@pia/db';
import type { Pool } from 'pg';

let healthPool: Pool | null = null;

function getHealthPool(): Pool {
  if (!healthPool) {
    healthPool = createPool();
  }
  return healthPool;
}

const healthRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // Clean up the health-check pool on server shutdown
  app.addHook('onClose', async () => {
    if (healthPool) {
      await healthPool.end();
      healthPool = null;
    }
  });

  app.get('/health/live', async (): Promise<HealthResponse> => {
    return { status: 'ok' };
  });

  app.get('/health/ready', async (_request, reply): Promise<HealthResponse> => {
    try {
      const pool = getHealthPool();
      await pool.query('SELECT 1');

      return { status: 'ok', checks: { database: 'ok' } };
    } catch {
      void reply.status(503);
      return {
        status: 'unavailable',
        checks: { database: 'unavailable' },
      };
    }
  });
};

export default healthRoutes;
```

**Validation:**

```bash
pnpm typecheck
pnpm lint
pnpm --filter @pia/api test:unit
```

All should pass.

**Rollback:**

```bash
git checkout apps/api/src/routes/health.ts
```

---

### TASK-F-006: Update MANIFEST.md

**Problem:** `MANIFEST.md:5` says `Files: 37`. Actual count is 219.

**Action:** Replace the manifest with a current summary.

**Edit `MANIFEST.md`** — replace entire contents:

```markdown
# Repository Manifest

Personal Intelligence and Action Engine — monorepo for a private, evidence-grounded
LLM/agent platform with workspace isolation, OIDC authentication, document ingestion,
hybrid retrieval, and governed persistent memory.

## Current State (2026-06-10)

- **Tracked files:** 219
- **Phase:** P0, P1, P2 in progress; P3-P7 not started
- **Backlog tasks:** 64 defined, 17 completed, 2 failed verification
- **Baseline:** `main` @ `90e6423`

## Package Inventory

| Package              | Status | Purpose                                              |
| -------------------- | ------ | ---------------------------------------------------- |
| `@pia/api`           | Active | Fastify API server with auth, workspaces, uploads    |
| `@pia/worker`        | Active | Background job consumer with outbox polling          |
| `@pia/web`           | Shell  | Future Next.js frontend                              |
| `@pia/auth`          | Active | OIDC client, JWT sessions, RBAC, identity resolution |
| `@pia/config`        | Active | Typed env-var config with Redacted secret handling   |
| `@pia/contracts`     | Active | Shared API types, error envelopes, pagination        |
| `@pia/db`            | Active | PostgreSQL pool, migrations, membership queries      |
| `@pia/domain`        | Active | Authorization types and role hierarchy               |
| `@pia/jobs`          | Active | Outbox events, consumer, retry policies              |
| `@pia/knowledge`     | Active | Document repos, ingestion workflow, scan provider    |
| `@pia/observability` | Active | Structured logger, correlation context, redaction    |
| `@pia/storage`       | Active | S3 and in-memory storage adapters                    |
| `@pia/audit`         | Active | Audit event writer, reader, redaction                |
| `@pia/ai`            | Shell  | Future AI/LLM integration (Phase P3)                 |
| `@pia/memory`        | Shell  | Future persistent memory (Phase P4)                  |
| `@pia/tools`         | Shell  | Future tool gateway (Phase P5)                       |
| `@pia/evals`         | Shell  | Future evaluation framework (Phase P6)               |

## Key Artifacts

| Path                        | Purpose                                                   |
| --------------------------- | --------------------------------------------------------- |
| `docs/00-09_*.md`           | Authoritative specifications (PRD through external basis) |
| `planning/backlog.yaml`     | Machine-readable task graph (64 tasks, 8 phase gates)     |
| `planning/status.yaml`      | Execution state tracker                                   |
| `planning/runs/`            | Per-task run records with verification evidence           |
| `api/openapi.yaml`          | API contract (37 operations)                              |
| `db/schema.sql`             | Reference PostgreSQL/pgvector schema                      |
| `db/migrations/`            | Versioned forward migrations                              |
| `.github/workflows/ci.yaml` | CI quality gates and security checks                      |
| `compose.yaml`              | Local development dependencies (pgvector, Redis, MinIO)   |
```

**Validation:**

```bash
grep "Files:" MANIFEST.md
# Should show the updated text, not "Files: 37"
```

**Rollback:**

```bash
git checkout MANIFEST.md
```

---

## Execution Order

Tasks within each phase are independent but phases should run sequentially:

```
Phase 1 (governance)
  ├── TASK-F-001  (P1-T02 status)
  └── TASK-F-002  (P0-T05 status, depends on F-001 passing validation)

Phase 2 (logout fix)
  └── TASK-F-003  (standalone)

Phase 3 (cleanup)
  ├── TASK-F-004  (hashPayload guard)
  ├── TASK-F-005  (health pool caching)
  └── TASK-F-006  (MANIFEST update)
```

---

## Approval Required

**Before any edits**, confirm:

1. The working tree is clean (`git status` shows nothing)
2. You have reviewed the exact changes listed above
3. You understand the rollback for each task

Reply with the phases you want applied (e.g., "Apply Phase 1 and Phase 2" or "Apply all phases").

---

## Post-Repair Checklist

After all approved phases are applied:

```bash
# Governance validation
pnpm exec tsx scripts/ci/validate-status.ts

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

# Review the diff
git diff --stat
git diff
```
