# ADR-0007: Path-boundary precedent for web-serving routes and migrations

- Status: Accepted
- Date: 2026-06-13
- Phase: P3
- Related tasks: P2-T09, P3-T08, P3-T09, P3-T10

## Context

The Personal Intelligence Action Engine's `allowed_paths` in `planning/backlog.yaml` constrains each task to specific directories. The strict rule is that modifications must not exceed the declared boundaries. Over the course of P2 and P3, two additive path-boundary interpretations have emerged organically, each time following a precedent set by a prior task:

1. **Web-serving routes** under `apps/api/src/routes/web*.ts`. P2-T09 (commit `53af795`) introduced `web-documents.ts` to serve the document/retrieval pages from the API server, registering it in `apps/api/src/server.ts`. P3-T09 followed the same pattern with `web-conversations.ts`. Both P2-T09 and P3-T09 declared `apps/web/**` as their strict `allowed_paths` and documented the `apps/api/src/routes/web*.ts` interpretation explicitly in their run records.

2. **Database migrations** under `db/migrations/**`. P2-T10 and earlier migration work treated `db/migrations/` as the canonical location, resolved by `packages/db/src/migrate.ts:112`. P3-T08 placed new migrations (`009b_feedback_free_text.sql`, `010_feedback_retrieval_traces.sql`) in this directory even though the task's strict `allowed_paths` (`packages/ai/src/feedback/**`, `packages/db/**`, `apps/api/**`, `packages/contracts/**`) did not include it. P3-T08 documented the precedent in its run record.

Both interpretations are additive: they extend `allowed_paths` with a _canonical_ location that is already used by the repository's tooling (the Fastify server for the web routes, the migration runner for the SQL files). They are not scope expansions into unrelated areas.

AGENTS.md prohibits silently changing architecture decisions and requires an ADR proposal instead. This ADR formalizes the two precedents so P4+ tasks can rely on them and so future deviations require an explicit decision.

## Decision

The following path-boundary interpretations are **accepted** as standing precedent for the project. Future tasks may rely on them without re-justifying in the run record. Any further deviation requires either a follow-up ADR or an in-record decision approved during review.

### 1. Web-serving routes

- **Canonical location:** `apps/api/src/routes/web*.ts`, one file per page category (documents, conversations, etc.).
- **Registration point:** `apps/api/src/server.ts` (single line per route module).
- **Allowed for tasks whose primary scope is the web UI** (e.g., `apps/web/**`), when the corresponding page category has no dedicated API surface and is rendered server-side by the Fastify server.
- **Not allowed** for tasks whose primary scope is the API (e.g., `apps/api/**` tasks should not need a `web*.ts` file). Web routes are a UI-serving convenience, not a general API extension.
- **Convention:** the `web*.ts` module must import from `@pia/web` and call the appropriate page builder from `apps/web/src/pages/`. The module should not contain business logic; it is a thin serving adapter.

### 2. Database migrations

- **Canonical location:** `db/migrations/`, resolved by `packages/db/src/migrate.ts:112` as `db/migrations` relative to the repository root.
- **Allowed for any task that ships a schema change** as part of its scope, when the schema change is _additive_ (new tables, new enum values, new join tables) and the change is co-located with the feature being delivered.
- **Naming convention:** `{NNN}_{snake_case_name}.sql` for primary migrations; `{NNN}{letter}_{snake_case_name}.sql` for additive follow-up migrations to an existing versioned migration (e.g., `009b_feedback_free_text.sql` adds a value to the enum created in `009_feedback.sql`).
- **Destructive migrations** (drops, column removals, type changes) are out of scope for this precedent and require human approval per the AGENTS.md "Database changes require forward and rollback reasoning" rule.

## Consequences

Positive:

- P4+ tasks with migration or web-serving work can proceed without re-justifying the path in their run records.
- The `allowed_paths` declarations in `planning/backlog.yaml` remain strict; the interpretations are documented in one place rather than scattered across run records.
- The two precedents are narrow and additive — they do not open the door to other cross-cutting modifications.

Negative / risks:

- A task could over-interpret the precedent and place unrelated code in `apps/api/src/routes/web*.ts` or `db/migrations/**`. The conventions above limit the surface area, but a reviewer must still verify each application.
- The precedent could be cited to justify scope creep in P4+ tasks. The "Not allowed" and "destructive migrations" caveats are the guardrails.

## Compliance

This ADR is consistent with AGENTS.md. The two precedents it formalizes were already in use by P2-T09, P3-T08, and P3-T09; this ADR makes them explicit and reviewable. Future tasks that rely on the precedent should reference this ADR in their run record (e.g., "Web route added per ADR-0007 §1").

## Alternatives considered

- **Tighten `allowed_paths` and require ADRs for every web route / migration**: rejected — too heavy for a recurring pattern, and would block routine UI work.
- **Loosen `allowed_paths` to always include `apps/api/src/routes/web*.ts` and `db/migrations/**`\*\*: rejected — blurs the per-task boundary and makes it harder to detect scope creep in review.
- **Move the web-serving routes into a separate `@pia/web-server` package**: rejected — the Fastify plugin pattern is well established and the current architecture (apps/api serving both API and SSR pages) is documented in `docs/02_ARCHITECTURE.md`. A future task can revisit if the serving boundary needs to be hardened.
