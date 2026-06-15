# Repository Manifest

Personal Intelligence and Action Engine — monorepo for a private, evidence-grounded
LLM/agent platform with workspace isolation, OIDC authentication, document ingestion,
hybrid retrieval, and governed persistent memory.

## Current State (2026-06-15)

- **Tracked files:** 618
- **Phase:** P0, P1, P2, P3 complete; P4-P7 not started
- **Backlog tasks:** 64 defined, 33 completed, 0 failed verification
- **Baseline:** `main` @ `09d9c77`

## Package Inventory

| Package              | Status | Purpose                                                  |
| -------------------- | ------ | -------------------------------------------------------- |
| `@pia/api`           | Active | Fastify API server with auth, workspaces, uploads        |
| `@pia/worker`        | Active | Background job consumer with outbox polling              |
| `@pia/web`           | Active | TypeScript HTML string builders (server-rendered by API) |
| `@pia/auth`          | Active | OIDC client, JWT sessions, RBAC, identity resolution     |
| `@pia/config`        | Active | Typed env-var config with Redacted secret handling       |
| `@pia/contracts`     | Active | Shared API types, error envelopes, pagination            |
| `@pia/db`            | Active | PostgreSQL pool, migrations, membership queries          |
| `@pia/domain`        | Active | Authorization types and role hierarchy                   |
| `@pia/jobs`          | Active | Outbox events, consumer, retry policies                  |
| `@pia/knowledge`     | Active | Document repos, ingestion workflow, scan provider        |
| `@pia/observability` | Active | Structured logger, correlation context, redaction        |
| `@pia/storage`       | Active | S3 and in-memory storage adapters                        |
| `@pia/audit`         | Active | Audit event writer, reader, redaction                    |
| `@pia/ai`            | Active | Model gateway, prompt registry, context, assistant       |
| `@pia/memory`        | Shell  | Future persistent memory (Phase P4)                      |
| `@pia/tools`         | Shell  | Future tool gateway (Phase P5)                           |
| `@pia/evals`         | Active | Evaluation framework, runners, scorers                   |

## Key Artifacts

| Path                        | Purpose                                                        |
| --------------------------- | -------------------------------------------------------------- |
| `docs/00-09_*.md`           | Authoritative specifications (PRD through external basis)      |
| `docs/adr/`                 | Architecture decision records (path-boundary, etc.)            |
| `planning/backlog.yaml`     | Machine-readable task graph (64 tasks, 8 phase gates)          |
| `planning/status.yaml`      | Execution state tracker                                        |
| `planning/runs/`            | Per-task run records with verification evidence                |
| `planning/reviews/`         | Independent reviewer verdicts and gate reviews                 |
| `evals/retrieval/`          | Retrieval evaluation CLI and datasets (P2-T10)                 |
| `evals/answers/`            | Grounded-answer evaluation CLI and datasets (P3-T10)           |
| `test/e2e/`                 | End-to-end journey tests (upload → feedback, P3-T10)           |
| `test/security/`            | Security suite (citation, injection, provider failure, P3-T10) |
| `api/openapi.yaml`          | API contract (37 operations)                                   |
| `db/schema.sql`             | Reference PostgreSQL/pgvector schema                           |
| `db/migrations/`            | Versioned forward migrations                                   |
| `.github/workflows/ci.yaml` | CI quality gates and security checks                           |
| `compose.yaml`              | Local development dependencies (pgvector, Redis, MinIO)        |
