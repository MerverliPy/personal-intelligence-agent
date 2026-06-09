# Target Architecture

## 1. Architectural style

A modular monolith with independently deployable web, API, and worker processes is the initial target. Domain packages remain internally separated so high-load or high-risk subsystems can later become services without beginning with distributed-system overhead.

## 2. Technology baseline

| Concern            | Decision                                                                                                                                              |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Language           | TypeScript, strict mode                                                                                                                               |
| Repository         | pnpm workspace monorepo with Turborepo                                                                                                                |
| Web                | Next.js App Router                                                                                                                                    |
| API                | Fastify with schema-first request/response validation                                                                                                 |
| Jobs               | Durable workflow/job adapter; local implementation may use a development queue, production implementation must support durable retries and visibility |
| Database           | PostgreSQL with pgvector and full-text search                                                                                                         |
| Cache/coordination | Redis                                                                                                                                                 |
| Object storage     | S3-compatible abstraction                                                                                                                             |
| Auth               | OIDC, server-side session or secure token exchange, application RBAC                                                                                  |
| AI                 | Provider-neutral gateway; OpenAI Responses API/Agents SDK first adapter                                                                               |
| Observability      | OpenTelemetry-compatible traces, metrics, logs                                                                                                        |
| Infrastructure     | Docker Compose local; Terraform-compatible deployment modules                                                                                         |
| API contract       | OpenAPI 3.1, generated client types, contract tests                                                                                                   |

Versions are pinned in Phase P0 after compatibility verification.

## 3. Logical components

```text
Browser / API Client
        |
        v
Web Application ---------
        |                 |
        v                 |
API Gateway / Fastify     |
        |                 |
        +--> Identity & Policy
        +--> Workspace / Project Domain
        +--> Conversation Domain
        +--> Knowledge Query Domain
        +--> Memory Domain
        +--> Tool & Approval Domain
        +--> Evaluation Domain
        +--> Audit Domain
        |
        +--> PostgreSQL + pgvector
        +--> Redis
        +--> Object Storage
        +--> Durable Job Adapter --> Worker
        +--> Model Gateway -------> Model Providers
        +--> Embedding Gateway ---> Embedding Providers
        +--> Connector Gateway ---> External Systems
        +--> Telemetry Exporter --> Observability Backend
```

## 4. Repository layout

```text
apps/
  web/                  # Next.js user interface
  api/                  # Fastify HTTP/SSE application
  worker/               # ingestion, indexing, evaluations, external actions
packages/
  auth/                 # identity, RBAC, policy context
  config/               # typed environment and application configuration
  contracts/            # OpenAPI-derived and internal schemas
  db/                   # ORM/query layer and migrations
  domain/               # shared value objects and domain errors
  audit/                # audit event API and redaction
  observability/        # tracing, metrics, logging
  storage/              # object-store abstraction
  jobs/                 # durable job abstraction
  knowledge/            # parsing, chunking, retrieval, citations
  ai/                   # model gateway, prompts, context compiler
  memory/               # candidate and approved memory lifecycle
  tools/                # registry, policy, approval, execution
  evals/                # datasets, scorers, runners, reports
infra/
  docker/               # local dependencies
  terraform/            # deployment modules and environments
docs/
planning/
api/
db/
```

Dependencies MUST point inward toward domain contracts. `apps/*` may compose packages; provider adapters depend on internal interfaces; core domain packages MUST NOT import UI, HTTP framework, or provider SDK modules.

## 5. Bounded contexts

### Identity and Policy

Owns principals, memberships, roles, permissions, policy decisions, and service identities. It does not own OAuth provider secrets.

### Knowledge

Owns source metadata, documents, immutable versions, files, extraction, chunks, embeddings, retrieval configuration, retrieval traces, and citations.

### Conversation

Owns conversations, immutable messages, model runs, streaming state, modes, and feedback references.

### Memory

Owns candidate and approved memories, versions, supersession, expiry, deletion, and retrieval policy.

### Tools and Approvals

Owns tool definitions, connections, canonical action requests, risk decisions, approvals, idempotent executions, and external references.

### Evaluation and Improvement

Owns datasets, suites, runs, scorers, thresholds, failure classifications, candidate improvements, promotion evidence, and rollout metadata.

### Audit

Consumes relevant events from all contexts and stores append-only, redacted records. Audit records do not become the source of domain state.

## 6. Primary request paths

### 6.1 Grounded answer

1. Authenticate request and construct policy context.
2. Load conversation and project scope.
3. Classify mode and determine retrieval requirements.
4. Execute authorized hybrid retrieval.
5. Compile system policy, prompt version, conversation state, approved memory, and evidence.
6. Invoke model gateway with structured response contract.
7. Verify citations and unsupported claims.
8. Stream/persist the final message and trace metadata.
9. Emit audit and telemetry events.

### 6.2 Document ingestion

1. Authorize upload and create pending file/document records.
2. Upload directly to object storage using a bounded signed request.
3. Verify checksum, MIME, scan result, quota, and ownership.
4. Enqueue idempotent ingestion workflow.
5. Extract structured content and locators.
6. Create immutable document version and chunks.
7. Generate embeddings and full-text indexes.
8. Atomically mark version ready and current.
9. Emit ingestion metrics, audit event, and user-visible state.

### 6.3 Consequential tool action

1. Model or user proposes a canonical tool request.
2. Tool policy independently evaluates principal, scope, risk, and inputs.
3. If approval is required, persist immutable request hash and pause.
4. Human approves or rejects before expiry.
5. Executor revalidates current policy and exact request hash.
6. Execute once using idempotency key.
7. Persist external result/reference and audit outcome.
8. Treat tool output as untrusted before further model use.

## 7. Model gateway

Internal interface example:

```ts
interface ModelGateway {
  generate(request: GenerationRequest, signal?: AbortSignal): Promise<GenerationResult>;
  stream(request: GenerationRequest, signal?: AbortSignal): AsyncIterable<GenerationEvent>;
}
```

`GenerationRequest` contains internal message, evidence, tool, output-schema, safety, and budget contracts. Provider-specific response objects are converted inside adapters.

The first adapter SHOULD use the current OpenAI Responses API rather than the deprecated Assistants API. Prompts remain in repository code, not hosted reusable prompt objects.

## 8. Retrieval architecture

### Candidate generation

- PostgreSQL full-text query using normalized text and language configuration
- pgvector nearest-neighbor query using the selected embedding space
- metadata filters: workspace, project, source, dates, sensitivity, tags
- lifecycle filters: ready, current, not deleted, not quarantined

### Fusion and reranking

- Normalize lexical and vector ranks
- Fuse through reciprocal-rank fusion or validated weighted score
- Remove duplicate/overlapping chunks
- Enforce source diversity where appropriate
- Optional model reranking only behind a budget and evaluation gate

### Result contract

Each result MUST contain:

- workspace/project IDs
- source, document, and document-version IDs
- chunk ID
- source locator
- text span
- lexical/vector/fused scores
- retrieval configuration version
- retrieval trace ID

Authorization is applied before results enter the model context.

## 9. Context compiler

Context order:

1. Immutable system safety and authorization rules
2. Product mode and output contract
3. Task-specific application prompt
4. Approved memory within scope
5. Retrieved evidence, explicitly delimited as untrusted
6. Conversation history or compacted state
7. User request
8. Tool definitions available after policy filtering

The compiler produces a manifest containing every included item, source, version, token estimate, and exclusion reason.

## 10. Event and job design

Domain writes and job publication SHOULD use a transactional outbox or equivalent mechanism. Worker handlers MUST be idempotent and store attempt state. Job payloads contain identifiers, not large sensitive blobs.

Recommended event examples:

- `document.upload.completed`
- `document.ingestion.requested`
- `document.version.ready`
- `conversation.response.completed`
- `feedback.recorded`
- `memory.candidate.created`
- `approval.requested`
- `tool.execution.completed`
- `evaluation.run.completed`

Event schemas are versioned. Consumers MUST tolerate additive fields.

## 11. Security boundaries

- Browser to web/API boundary
- API to data stores
- Worker sandbox to untrusted files
- Model gateway to external provider
- Connector executor to external system
- Approval boundary between proposal and consequential side effect
- Workspace boundary in every tenant-owned query

No external content may alter policy, allowed tools, approval requirements, or system prompts.

## 12. Reliability patterns

- Timeouts and cancellation for every external call
- Exponential backoff with jitter for known transient failures
- Circuit breaking or provider health gating
- Idempotency keys for uploads, jobs, model-run creation where appropriate, and all external writes
- Dead-letter handling with inspectable error categories
- Outbox/event reconciliation
- Backup, restore, and index rebuild procedures
- Graceful degradation when web search, model, embedding, or connector providers are unavailable

## 13. Architecture decision process

A change requires an ADR when it:

- introduces a new infrastructure dependency;
- changes a bounded-context ownership boundary;
- changes tenant isolation or authorization semantics;
- changes the primary persistence model;
- adds a model/provider dependency to core domain code;
- makes a destructive or difficult-to-reverse migration;
- changes the approval or risk model.

ADR proposals must include context, options, decision, consequences, security impact, migration, and rollback.
