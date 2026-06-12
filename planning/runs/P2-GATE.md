# Run Record: P2-GATE

## Phase Gate: Knowledge ingestion and hybrid retrieval

- **ID:** P2-GATE
- **Phase:** P2
- **Final State:** DONE
- **Completed:** 2026-06-12

---

## Repository State Inspected

- `planning/backlog.yaml`: P2 phase definition and all ten task definitions.
- `planning/status.yaml`: All ten P2 tasks marked `DONE`; `P2: IN_PROGRESS`, `P2-GATE: NOT_STARTED`.
- `planning/runs/P2-T01.md` through `planning/runs/P2-T10.md`: All ten run records present with acceptance evidence.
- `planning/reviews/P2-T01.md` through `planning/reviews/P2-T10.md`: All ten review records present.
- `audit-handoff.md`: Confirms all P2-related audit findings resolved (CQ-H5 tests, I-H2 IaC, S-M4 rate limiting, etc.).

## Gate Evaluation

### Task Completion Status

| Task   | State | Run Record                                                         | Deps Satisfied         |
| ------ | ----- | ------------------------------------------------------------------ | ---------------------- |
| P2-T01 | DONE  | `planning/runs/P2-T01.md` — source, document, version persistence  | P1-GATE                |
| P2-T02 | DONE  | `planning/runs/P2-T02.md` — upload completion + quarantine         | P2-T01, P1-T05, P1-T06 |
| P2-T03 | DONE  | `planning/runs/P2-T03.md` — idempotent ingestion workflow          | P2-T02                 |
| P2-T04 | DONE  | `planning/runs/P2-T04.md` — document parsers + extraction          | P2-T03                 |
| P2-T05 | DONE  | `planning/runs/P2-T05.md` — deterministic chunking + provenance    | P2-T04                 |
| P2-T06 | DONE  | `planning/runs/P2-T06.md` — embedding gateway + vector persistence | P2-T05                 |
| P2-T07 | DONE  | `planning/runs/P2-T07.md` — authorized hybrid retrieval            | P2-T05, P2-T06, P1-T03 |
| P2-T08 | DONE  | `planning/runs/P2-T08.md` — retrieval and ingestion APIs           | P2-T03, P2-T07, P1-T07 |
| P2-T09 | DONE  | `planning/runs/P2-T09.md` — document and retrieval UI              | P2-T08                 |
| P2-T10 | DONE  | `planning/runs/P2-T10.md` — portable retrieval evaluation harness  | P2-T07                 |

### Quality Gate Checks — All PASS

| Command                      | Result                                           |
| ---------------------------- | ------------------------------------------------ |
| `pnpm format:check`          | All matched files use Prettier code style — PASS |
| `pnpm lint`                  | 17/17 successful, 0 errors — PASS                |
| `pnpm typecheck`             | 28/28 successful — PASS                          |
| `pnpm test:unit`             | 34/34 tasks, 613 tests passing — PASS            |
| `pnpm build`                 | 17/17 successful — PASS                          |
| `pnpm security:secrets`      | No secrets detected — PASS                       |
| `pnpm security:dependencies` | No known vulnerabilities found — PASS            |

Test breakdown:

| Package       | Tests   | Result   |
| ------------- | ------- | -------- |
| contracts     | 21      | PASS     |
| config        | 14      | PASS     |
| domain        | 11      | PASS     |
| observability | 34      | PASS     |
| storage       | 34      | PASS     |
| auth          | 162     | PASS     |
| jobs          | 18      | PASS     |
| audit         | 36      | PASS     |
| knowledge     | 160     | PASS     |
| api           | 85      | PASS     |
| evals         | 38      | PASS     |
| **Total**     | **613** | **PASS** |

Additional validations:

- `docker compose config` — valid ✓
- Git status — clean, no uncommitted changes ✓
- Governance validation (`tsx scripts/ci/validate-status.ts`) — PASS (64 tasks, 8 phases checked) ✓

### Phase Objective Evidence

| Pillar                    | Evidence                                                                                                                                                                                                                                                                                            |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Knowledge Persistence** | Immutable provenance model with sources, documents, versions, files, and ingestion state. State machine enforces valid transitions (e.g., one current ready version per document). Checksum and source provenance persisted. 52 state machine tests.                                                |
| **Upload & Security**     | Workspace-scoped signed uploads with size/type/time limits; completion verifies checksum, MIME type, size, quota, and scan status. Quarantine for failed/pending scan. Idempotent duplicate completion. 17 upload workflow tests.                                                                   |
| **Ingestion Pipeline**    | Durable staged workflow (extraction → chunking → embedding → indexing → publishing) with resumable checkpoints, retry categories, and telemetry. Repeated delivery does not duplicate chunks or embeddings. Final current-version switch is atomic. 18 ingestion workflow tests.                    |
| **Parsing**               | Deterministic extraction for plain text, PDF, and DOCX with structural locators (page/section/paragraph). Unsupported, encrypted, malformed, or resource-exhausting inputs fail safely. 28 parsing tests.                                                                                           |
| **Chunking**              | Deterministic chunking with configurable overlap and maximum size; every chunk maps to exact document-version locator; duplicate chunks detectable via content hashes. 19 chunking tests.                                                                                                           |
| **Embeddings**            | Provider-neutral interface with fake adapter; embeddings stored with model, dimension, and pipeline version. Mixed dimensions/models rejected by version. 18 embedding tests.                                                                                                                       |
| **Hybrid Retrieval**      | Lexical + vector candidates with lifecycle/ACL filtering, score fusion, and deduplication. Authorization filters applied before results leave the service. Excludes superseded/deleted/quarantined/failed versions. Each result carries source/version/chunk/locator and score. 25 retrieval tests. |
| **API Endpoints**         | Contract-compliant endpoints for documents, ingestion jobs, retrieval queries, and trace inspection. Cursor handling, idempotency, role-gated debug detail, historical retrieval gating, safe error codes. 29 contract tests.                                                                       |
| **User Interface**        | Upload UI, job status, document list/detail, search, and evidence inspection. Keyboard navigation and accessible status announcements. 21 web UI tests.                                                                                                                                             |
| **Evaluation Harness**    | Versioned dataset schema, retrieval runner, deterministic scorers (recall, precision, rank metric, version correctness, authorization correctness, latency). Security correctness failures always fail regardless of aggregate. 38 eval tests.                                                      |

---

## Observations (Non-Blocking)

1. **App build stubs**: `apps/api`, `apps/web`, and `apps/worker` still use `echo` build stubs from P0. Real build tooling is deferred — the API shell uses Fastify at runtime via `tsx`, web uses plain TypeScript, worker uses Node.js directly. No production impact at this stage.
2. **Integration tests require PostgreSQL**: `@pia/db` and `@pia/knowledge` integration tests require a running PostgreSQL instance. Unit test suite uses in-memory fakes for all packages.
3. **Dev-only dependency vulnerabilities** (carried from P0): vitest 2.1.9 (critical GHSA-5xrq-8626-4rwp), esbuild/vite (moderate). No production impact — `pnpm audit --prod` is clean.
4. **Provider-neutral gateway deferred**: The embedding gateway currently uses a fake provider. The real provider-neutral model gateway arrives in P3-T01.
5. **Memory and tools packages**: `@pia/memory` and `@pia/tools` are scaffolded shells with no implementation — their targets are in P4 and P5 respectively.

---

## Commands Run and Results

```bash
pnpm format:check               # PASS
pnpm lint                        # PASS (17/17, 0 errors)
pnpm typecheck                   # PASS (28/28)
pnpm test:unit                   # PASS (34 tasks, 613 tests)
pnpm build                       # PASS (17/17)
pnpm security:secrets            # PASS (no secrets)
pnpm security:dependencies       # PASS (no known vulnerabilities)
```

## Security/Privacy Impact

- No new secrets, credentials, or data handling introduced by the gate evaluation itself.
- The phase implements defense-in-depth: workspace-scoped upload keys, MIME/checksum verification, quarantine for unscanned content, ACL-filtered retrieval, cross-workspace authorization tests on all endpoints.
- Parsing has no unrestricted network access; untrusted content cannot alter retrieval policy.
- Embedding provider payload respects sensitivity policy hooks.

## Database/API Compatibility Impact

- None — this is a gate evaluation, not a code change.
- Forward compatibility: Knowledge entity tables (sources, documents, versions, files, chunks, embeddings) are fully migrated. Retrieval traces and ingestion jobs are workspace-scoped.

## Remaining Risks or Follow-up Tasks

- P3 tasks are unblocked. Next task: **P3-T01** (provider-neutral model gateway).
- Real embedding providers require P3-T01 gateway infrastructure.
- File scanning (malware detection) currently uses a stub — real scanning requires integration with external scanner (deferred to P7 production hardening).

## Verdict: PASS

The P2 phase has delivered its stated objective: knowledge ingestion and hybrid retrieval. All ten tasks are DONE with verified run records and reviewer sign-off. Quality gates pass from a clean state. The next phase (P3) may begin.
