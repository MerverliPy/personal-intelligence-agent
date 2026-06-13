# Repository Documentation Profile

## Identity

- Project: Personal Intelligence and Action Engine (PIA)
- Repository: `MerverliPy/personal-intelligence-agent`
- Purpose: self-hosted, private, evidence-grounded LLM/agent platform with workspace isolation, document ingestion, hybrid retrieval, and governed actions.
- Type: TypeScript/pnpm/Turbo monorepo containing applications, packages, infrastructure, database assets, API contracts, specifications, and phase-driven delivery records.
- Default branch: `main`
- Release model: no published release line is assumed; current delivery is phase/task driven.

## Canonical evidence

| Subject            | Primary source                                                                                  | Notes                                                                   |
| ------------------ | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Product scope      | `docs/01_PRODUCT_AND_SCOPE.md` when present, otherwise relevant authoritative `docs/00-09_*.md` | Verify exact path before use.                                           |
| Architecture       | `docs/02_ARCHITECTURE.md`                                                                       | Authoritative design; implementation still determines current behavior. |
| API contract       | `api/openapi.yaml`                                                                              | Read-only for this agent.                                               |
| Planned work       | `planning/backlog.yaml`                                                                         | Planned scope, not availability.                                        |
| Delivery state     | `planning/status.yaml`                                                                          | Verify required run/review evidence before public claims.               |
| Execution evidence | `planning/runs/` and `planning/reviews/`                                                        | Read-only.                                                              |
| User onboarding    | `README.md`                                                                                     | Output document; may be stale.                                          |
| Repository summary | `MANIFEST.md`                                                                                   | Output summary; recalculate rather than trust counts/dates.             |
| CI gates           | `.github/workflows/ci.yaml` and invoked scripts                                                 | Inspect command chains before requesting execution.                     |
| Local environment  | `compose.yaml`, `.env.example`, `infra/docker/`                                                 | Never read real environment files.                                      |

## Verified commands

These commands are defined in root `package.json`. Their script chains must be inspected and execution approved before running.

| Purpose           | Command                      | Network/side-effect note                          |
| ----------------- | ---------------------------- | ------------------------------------------------- |
| Format check      | `pnpm format:check`          | Read-only formatter check.                        |
| Lint              | `pnpm lint`                  | Turbo task; inspect configuration.                |
| Type check        | `pnpm typecheck`             | Turbo task.                                       |
| Unit tests        | `pnpm test:unit`             | Turbo task.                                       |
| Full tests        | `pnpm test`                  | Broader and potentially expensive.                |
| Integration tests | `pnpm test:integration`      | May require services.                             |
| Build             | `pnpm build`                 | Writes build output.                              |
| Secret scan       | `pnpm security:secrets`      | Inspect shell script first.                       |
| Dependency scan   | `pnpm security:dependencies` | May use network/public advisory service.          |
| Combined CI       | `pnpm ci:check`              | Inspect full shell chain before approval.         |
| Test migration    | `pnpm db:migrate:test`       | Only against a verified disposable test database. |

## Status rules

- Supported user-facing capability requires E1/E2 evidence.
- A `DONE`/`NO_CHANGE_REQUIRED` task is relevant evidence only when required run/review records support it.
- `IN_PROGRESS` is Partial/Experimental unless specific behavior independently reaches E1/E2.
- `NOT_STARTED` is Planned.
- Never hardcode task counts or phase progress without recalculating from the current state ledger.

## Writable documentation scope

- `README.md`
- `MANIFEST.md`
- `docs/**`
- root changelog/roadmap documents when present
- policy/template documents only after explicit approval

## Exclusions

Never edit `planning/**`, `.opencode/**`, `AGENTS.md`, `.github/workflows/**`, `api/**`, `db/**`, `apps/**`, `packages/**`, `scripts/**`, `infra/**`, dependency/lock files, generated outputs, secrets, or Git metadata.
