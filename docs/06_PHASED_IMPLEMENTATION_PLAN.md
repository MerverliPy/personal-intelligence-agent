# Phased Implementation Plan for OpenCode

## 1. Purpose

This plan is written for deterministic analysis and execution by an OpenCode coding agent. `planning/backlog.yaml` is the machine-readable source of task truth; this document explains sequencing, gates, and operating rules.

## 2. Agent execution protocol

### 2.1 Before a task

The agent MUST:

1. Read `AGENTS.md`.
2. Locate the exact task ID in `planning/backlog.yaml`.
3. Confirm every dependency is `DONE` or `NO_CHANGE_REQUIRED` in `planning/status.yaml`.
4. Read only the task's `spec_refs` plus directly relevant code.
5. Inspect current implementation and reproduce the missing capability.
6. Consider `NO_CHANGE_REQUIRED` as a valid outcome.
7. Declare anticipated files, tests, data migration impact, API impact, and security impact.

### 2.2 During a task

- Execute one task only unless the backlog explicitly defines a grouped atomic task.
- Keep changes within `allowed_paths`; expanding scope requires a documented reason.
- Do not modify `forbidden_paths`.
- Preserve backward compatibility unless the task explicitly authorizes a breaking change.
- Add tests with implementation, not afterward as optional work.
- Stop when a human decision, credential, destructive operation, or specification conflict is required.

### 2.3 At task completion

Create `planning/runs/<TASK-ID>.md` and record:

- final state;
- evidence that work was required or already satisfied;
- files changed;
- commands and outcomes;
- acceptance criteria and evidence;
- security/privacy review;
- API/schema compatibility;
- residual risk.

The independent reviewer runs `/task-review <TASK-ID>`. Only after PASS may status be set to `DONE` or `NO_CHANGE_REQUIRED`.

### 2.4 State rules

| State               | Meaning                                                         |
| ------------------- | --------------------------------------------------------------- |
| NOT_STARTED         | No implementation attempt                                       |
| IN_PROGRESS         | Active bounded implementation                                   |
| DONE                | Acceptance criteria and verification passed                     |
| NO_CHANGE_REQUIRED  | Criteria already passed; independent evidence recorded          |
| BLOCKED             | Safe progress requires external input or unavailable dependency |
| FAILED_VERIFICATION | Implementation exists but required checks fail                  |

## 3. Parallelism policy

Tasks may run in parallel only when:

- all dependencies are complete;
- `allowed_paths` do not overlap materially;
- they do not modify the same API contract, migration sequence, shared package public surface, or configuration file;
- their combined changes do not create an unreviewed integration boundary.

Parallel tasks are merged only after each passes its own review and the phase integration suite passes.

## 4. Program phases

## P0 — Repository, governance, and engineering foundation

### Objective

Create a reproducible, secure, observable development foundation without implementing product behavior prematurely.

### Deliverables

- TypeScript monorepo and pinned toolchain
- web, API, and worker application shells
- shared package boundaries
- typed environment validation
- Docker Compose dependencies
- CI quality gates
- observability baseline
- security/threat baseline

### Exit gate

- Clean checkout can install, build, lint, typecheck, and test.
- Local dependencies start through one documented command.
- API readiness/liveness and worker heartbeat operate.
- No committed secrets.
- Dependency and secret scanning are active.
- Architecture and security reviews have no unresolved BLOCKER/HIGH defects.

### OpenCode command sequence

```text
/project-analyze
/phase-plan P0
/task-run P0-T01
/task-review P0-T01
...
/phase-gate P0
```

## P1 — Identity, tenancy, storage, and core platform

### Objective

Establish the authorization and persistence boundary required before any private data is ingested.

### Deliverables

- database migrations and typed data access
- OIDC authentication
- workspace/project membership and policy service
- append-only audit subsystem
- object storage adapter
- job/outbox foundation
- API error/idempotency conventions
- authenticated web shell

### Exit gate

- Cross-workspace object access is denied and tested.
- Authentication and session lifecycle work in local/test environments.
- Object upload targets are scoped and time-limited.
- Audit and correlation IDs connect API and worker operations.
- Migration from empty database is repeatable.
- Backup/restore smoke procedure exists for local reference environment.

## P2 — Knowledge ingestion and hybrid retrieval

### Objective

Convert approved files into versioned, authorized, source-locatable knowledge and retrieve it measurably.

### Deliverables

- source/document/version/file model
- validated upload completion
- durable ingestion workflow
- parser and chunking pipeline
- embedding adapter and pgvector indexing
- lexical search and fusion
- ACL/lifecycle-aware retrieval API
- ingestion and retrieval UI
- retrieval evaluation dataset and runner

### Exit gate

- Supported files ingest end to end.
- A failed or quarantined version never appears in retrieval.
- Current-version retrieval excludes superseded content by default.
- Cross-tenant and cross-project retrieval tests pass.
- Every result exposes stable provenance and locators.
- Retrieval quality meets initial thresholds in `docs/07_TEST_EVALUATION_STRATEGY.md`.

## P3 — Source-grounded conversational assistant

### Objective

Deliver the first production-capable private assistant over approved knowledge.

### Deliverables

- provider-neutral model gateway
- code-managed prompt registry
- deterministic context compiler
- conversation/message/model-run persistence
- SSE streaming and cancellation
- grounded answer generation
- citation verification and source previews
- feedback and failure classification
- assistant user interface
- answer/citation evaluation suites

### Exit gate

- User can ask a question and receive a streamed, source-grounded answer.
- Citations link only to evidence used in the run.
- Unsupported claims are qualified or rejected.
- Model/provider failure produces a safe terminal state.
- Feedback is linked to the exact message, model run, prompt, and retrieval trace.
- MVP security, quality, recovery, and operational criteria pass.

**Initial production release boundary:** P0–P3.

## P4 — Governed persistent memory

### Objective

Add durable personalization and project memory without converting conversation history into unreviewed truth.

### Deliverables

- typed memory schema and lifecycle
- candidate extraction
- approval/rejection workflow
- scoped retrieval and context inclusion
- supersession, correction, expiry, and deletion
- memory management UI
- privacy and poisoning evaluations

### Exit gate

- Sensitive or consequential memory cannot become approved without authorization.
- Every memory is visible, source-linked, correctable, and deletable.
- Deleted/superseded memories stop affecting new runs.
- Cross-workspace/project/user memory isolation passes.

## P5 — Tool gateway, approvals, and controlled actions

### Objective

Enable useful actions while keeping authority, policy, and execution independent from model output.

### Deliverables

- versioned tool registry
- risk and policy engine
- approval state machine
- draft-only initial connectors
- idempotent executor and reconciliation
- tool and approval audit UI
- prompt-injection and tool-output defenses

### Exit gate

- Consequential writes cannot execute without valid exact-input approval.
- Replayed requests do not duplicate side effects.
- Changed inputs invalidate approval.
- Tool output cannot alter authority.
- External ambiguous-state handling is tested.

## P6 — Portable evaluation and controlled improvement

### Objective

Turn traces and feedback into testable candidate improvements without uncontrolled production self-modification.

### Deliverables

- portable dataset and scorer format
- trace export and redaction
- failure classifier
- candidate-improvement workflow
- prompt/retrieval experiment runner
- regression reporting
- feature flags, canary, and rollback controls

### Exit gate

- Every promoted behavior change has motivating evidence and before/after scores.
- Regression suites run independently of any deprecated hosted evaluation product.
- Rollback is demonstrated.
- No automatic promotion exists for consequential changes.

## P7 — Production hardening and operational readiness

### Objective

Prepare for sustained private or organizational deployment.

### Deliverables

- infrastructure as code
- managed secrets and keys
- backup/restore and disaster recovery
- load, soak, and failure testing
- security validation
- lifecycle/export/deletion operations
- SLOs, alerts, and runbooks
- release readiness evidence

### Exit gate

- Declared recovery objectives are demonstrated.
- No unresolved BLOCKER/HIGH security finding.
- P95 latency and error budgets meet target load profile.
- On-call and incident procedures are actionable.
- Release and rollback are repeatable.

## 5. Mandatory task anatomy

Each YAML task includes:

```yaml
id: P2-T07
title: Implement authorized hybrid retrieval
objective: One measurable outcome.
depends_on: [P2-T05, P2-T06]
requirements: [FR-RET-001, FR-RET-002]
spec_refs: [docs/02_ARCHITECTURE.md#8-retrieval-architecture]
allowed_paths: [packages/knowledge/**, packages/db/**, apps/api/**]
forbidden_paths: [infra/terraform/prod/**]
inputs: [existing schema, retrieval configuration]
outputs: [service, endpoint, tests, metrics]
implementation_notes: [non-prescriptive constraints]
verification: [commands]
acceptance: [observable criteria]
security_checks: [negative authorization cases]
rollback: [revert and data compatibility approach]
stop_conditions: [conditions requiring BLOCKED]
```

The agent MUST not reinterpret a broad objective as permission to modify unrelated subsystems.

## 6. Phase gate evidence package

Every phase gate produces:

- completed-task matrix;
- unresolved defect list;
- architecture and security review results;
- commands and environment used;
- test and evaluation reports;
- migration/restore evidence where relevant;
- API compatibility result;
- known limitations and risk acceptances;
- recommendation to proceed or stop.

## 7. Human decision points

Human approval is required before:

- selecting production cloud/vendor accounts;
- entering real credentials;
- changing the core stack or bounded-context ownership;
- destructive database changes;
- external sending or write-capable connectors;
- production deployment;
- enabling a new model/provider for confidential or regulated data;
- accepting a HIGH residual security risk;
- promoting a fine-tuned model or autonomous improvement mechanism.

## 8. Definition of done

A task is done only when:

- required behavior exists;
- tests prove success and relevant failure/denial paths;
- typecheck/lint pass;
- contract/schema docs are updated;
- telemetry and audit behavior exist where required;
- no acceptance criterion is waived;
- run evidence exists;
- independent review passes.
