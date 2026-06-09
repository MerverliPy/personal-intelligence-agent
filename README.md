# Personal Intelligence and Action Engine

Repository-ready product, system, architecture, data, API, and delivery specification for a private, evidence-grounded LLM/agent platform.

## Purpose

Build a controlled AI system that can retrieve trusted knowledge, maintain approved memory, analyze evidence, support decisions, and execute authorized actions while preserving provenance, permissions, auditability, and rollback.

## Start here

1. Read `AGENTS.md`.
2. Run OpenCode in **Plan** mode and execute `/project-analyze`.
3. Review `docs/06_PHASED_IMPLEMENTATION_PLAN.md`.
4. Select the first eligible task from `planning/backlog.yaml`.
5. Execute `/task-run P0-T01`.
6. Review with `/task-review P0-T01`.
7. Update `planning/status.yaml` only after verification succeeds.

## Authoritative documents

| File | Purpose |
|---|---|
| `docs/00_PRODUCT_REQUIREMENTS.md` | Product requirements document |
| `docs/01_SYSTEM_REQUIREMENTS.md` | Functional and nonfunctional system requirements |
| `docs/02_ARCHITECTURE.md` | Target architecture and key decisions |
| `docs/03_DATA_MODEL.md` | Domain model, lifecycle, and retention rules |
| `docs/04_API_ARCHITECTURE.md` | API conventions and endpoint design |
| `docs/05_SECURITY_GOVERNANCE.md` | Security, privacy, approvals, and threat controls |
| `docs/06_PHASED_IMPLEMENTATION_PLAN.md` | Human-readable execution plan |
| `docs/07_TEST_EVALUATION_STRATEGY.md` | Test, evaluation, and release gates |
| `planning/backlog.yaml` | Machine-readable task graph for OpenCode |
| `planning/status.yaml` | Execution state; update only after verification |
| `api/openapi.yaml` | Initial API contract |
| `db/schema.sql` | Initial PostgreSQL/pgvector schema |

## Recommended implementation stack

- TypeScript strict-mode monorepo
- pnpm workspaces and Turborepo
- Next.js web application
- Fastify API service
- Background worker with durable job orchestration
- PostgreSQL with pgvector and full-text search
- Redis for transient coordination and rate limiting
- S3-compatible object storage
- OpenTelemetry-compatible observability
- OIDC authentication with application-level RBAC
- OpenAI Responses API and Agents SDK behind a provider-neutral model gateway
- Docker Compose for local development; Terraform-compatible infrastructure for deployment

Versions are deliberately pinned during `P0-T01` to supported stable releases and committed in the lockfile and tool-version files.

## Execution policy

- One task at a time.
- Verify the issue or missing capability before changing code.
- `NO_CHANGE_REQUIRED` is a valid successful outcome when acceptance criteria already pass.
- Never weaken tests, permissions, or acceptance criteria to mark work complete.
- No `git push`, production deployment, destructive migration, credential creation, or external communication without explicit human approval.
- Every completed task must include tests, documentation updates when behavior changes, and a run record under `planning/runs/`.

## Initial delivery boundary

The first production release ends after Phase P3: authenticated private workspaces, document ingestion, hybrid retrieval, source-grounded assistant responses, citations, feedback capture, audit traces, and evaluation coverage. Persistent memory, external actions, and autonomous improvement are later controlled phases.
