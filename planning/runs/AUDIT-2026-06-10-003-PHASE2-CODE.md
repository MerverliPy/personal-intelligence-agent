# AUDIT-2026-06-10-003 — Phase 2 Code Cleanup (TASK-F-008, TASK-F-011)

**Task ID:** `AUDIT-2026-06-10-003-PHASE2-CODE`
**Final State:** `DONE`
**Date:** 2026-06-10
**Source:** `audit-handoff.md` Phase 2 — Code Cleanup & AUDIT-2026-06-10-002 pending tasks

---

## Repository State Inspected

- `packages/observability/src/correlation.ts` (75 → 72 lines) — target for TASK-F-008
- `packages/jobs/src/consumer.ts` (302 lines) — target for TASK-F-011
- Git history: commit `8d4c42b` ("audit: apply repair handoff (AUDIT-2026-06-10-002)")
- `packages/audit/src/types.ts`, `reader.ts`, `writer.ts` — confirmed separate audit `traceId` (unrelated to `CorrelationContext.traceId`)
- Full grep for `CorrelationContext.*traceId` and `.traceId` — zero consumer references

---

## Missing Capability Reproduced

### TASK-F-008: Dead `traceId` on `CorrelationContext`

Commit `8d4c42b` removed the dead traceId variable-setting logic from `createCorrelationContext()` but left behind:

1. `traceId?: string;` field on the `CorrelationContext` interface (line 12)
2. `@param traceId - Optional distributed trace ID.` in the JSDoc (line 30)

The field was never set by `createCorrelationContext()`, never read by any consumer, and had zero references across all packages. The audit package's `AuditEvent.traceId` is a completely separate concept (audit trail identifier, not correlation context).

**Before:** Dead field visible in IDE autocompletion, misleading JSDoc
**After:** `CorrelationContext` has only `correlationId` and optional `spanId`

### TASK-F-011: Redundant `updateStatus` in `consumer.ts`

Commit `8d4c42b` already fully resolved this:

- Removed `updateStatus()` private method (was: `UPDATE outbox_events SET status = $2 WHERE id = $1`)
- Removed `processJob()`'s redundant `await this.updateStatus(record.id, 'PROCESSING')` call before handler invocation
- Removed `OutboxStatus` import

The PROCESSING status is now set atomically in `fetchPending()` via `UPDATE...SET status = 'PROCESSING'...RETURNING`, eliminating the redundant separate update that could fail independently.

**Verdict:** `NO_CHANGE_REQUIRED` — the fix was already applied in commit `8d4c42b`.

---

## Files Changed

| File                                        | Change                                                                                                            |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `packages/observability/src/correlation.ts` | TASK-F-008: Removed `traceId?: string;` from `CorrelationContext` interface. Removed `@param traceId` from JSDoc. |

**Total:** 1 file changed, 3 lines deleted. Cumulative across all audit phases: 7 files, +23/-13.

---

## Design Decisions

### TASK-F-008 completion

The prior commit (`8d4c42b`) removed the code that _set_ `traceId` but left the field declaration as dead interface surface. Removing it now is safe because:

- `CorrelationContext` is a DTO (not serialized to DB or wire)
- No consumer imports or destructures `.traceId` from a `CorrelationContext`
- The audit package has its own `traceId` on `AuditEvent`, which is a separate concept
- 34/34 observability tests pass with the field removed

### TASK-F-011 disposition

The prior commit fully resolved this. Evidence:

- `consumer.ts:237-267`: `fetchPending()` atomically sets `status = 'PROCESSING'` via `UPDATE...RETURNING`
- `consumer.ts:176-227`: `processJob()` no longer calls a separate `updateStatus()`
- `consumer.ts`: No `updateStatus` method or `OutboxStatus` import exists

---

## Commands Run and Results

| Command                                                         | Result                                                                                                         |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `git show 8d4c42b -- packages/jobs/src/consumer.ts`             | Confirmed TASK-F-011 fix: removed updateStatus method and redundant PROCESSING call (+1/-16)                   |
| `git show 8d4c42b -- packages/observability/src/correlation.ts` | Confirmed partial TASK-F-008 fix: removed traceId logic from createCorrelationContext, but field remained dead |
| `grep -r "traceId" packages/ --include="*.ts"`                  | Only audit package `traceId` remains (separate concept); no consumer references `CorrelationContext.traceId`   |
| `pnpm typecheck`                                                | 26/26 successful                                                                                               |
| `pnpm lint`                                                     | 17/17 successful, 0 errors                                                                                     |
| `pnpm --filter @pia/observability test:unit`                    | 34/34 passing                                                                                                  |

---

## Acceptance-Criterion Evidence

### TASK-F-008 — Dead traceId removed

- [x] `CorrelationContext` interface no longer has `traceId` field
- [x] JSDoc no longer references `traceId` parameter
- [x] Zero remaining references to `CorrelationContext.traceId` in codebase
- [x] TypeScript strict mode passes (26/26)
- [x] All 34 observability tests pass

### TASK-F-011 — Redundant updateStatus removed

- [x] No `updateStatus` method in `consumer.ts`
- [x] No `OutboxStatus` import in `consumer.ts`
- [x] `fetchPending()` atomically sets PROCESSING via `UPDATE...RETURNING`
- [x] `processJob()` calls `markCompleted`/`markDead`/`scheduleRetry` directly (no intermediate PROCESSING update)
- [x] Fix verified via git history (commit `8d4c42b`) — `NO_CHANGE_REQUIRED`

---

## Security/Privacy Impact

- **None** — Interface cleanup and verification of existing fix only; no runtime behavior change.

---

## Database/API Compatibility Impact

- **None** — No schema, migration, or API changes.

---

## Remaining Risks or Follow-up Tasks

### AUDIT-2026-06-10-002 tasks — ALL RESOLVED

| Task       | Status                                                        |
| ---------- | ------------------------------------------------------------- |
| TASK-F-007 | ✅ Fixed (Phase 2 Governance)                                 |
| TASK-F-008 | ✅ Fixed (dead traceId removed from interface)                |
| TASK-F-009 | ✅ NO_CHANGE_REQUIRED (SHA256SUMS already absent)             |
| TASK-F-010 | ✅ NO_CHANGE_REQUIRED (benchmark_out/ already in .gitignore)  |
| TASK-F-011 | ✅ NO_CHANGE_REQUIRED (fix already applied in commit 8d4c42b) |
| TASK-F-012 | ⬜ PENDING (MANIFEST.md count)                                |
| TASK-F-013 | ✅ SUPERSEDED (nonce plumbing completed per C-1)              |

### AUDIT-2026-06-10-003 remaining

**Phase 3 (Code Quality):**

- CQ-H5: Add tests for contracts and domain packages
- CQ-M2: Trim 55+ dead exports
- TASK-F-012: Update MANIFEST.md file count

**Security (MEDIUM):**

- S-M2 through S-M7 remain unresolved
