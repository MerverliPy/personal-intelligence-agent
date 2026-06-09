# System Requirements Specification

## 1. Scope

This specification translates the approved product baseline into testable system requirements. Each requirement has a stable ID for traceability to backlog tasks, tests, API operations, and release gates.

## 2. System context

External actors and systems:

- Human user through web UI or API client
- OIDC identity provider
- Model providers through the model gateway
- Embedding providers through the embedding gateway
- S3-compatible object store
- PostgreSQL/pgvector
- Redis
- Durable job/workflow engine
- Optional web search and approved connectors
- Observability backend

## 3. Functional requirements

### 3.1 Identity, tenancy, and authorization

- FR-AUTH-001: The system MUST authenticate interactive users through OIDC Authorization Code flow with PKCE.
- FR-AUTH-002: Every application request MUST resolve an authenticated principal, workspace scope, correlation ID, and policy context.
- FR-AUTH-003: Workspace membership MUST support owner, admin, member, curator, and auditor roles even if the initial UI exposes only owner.
- FR-AUTH-004: Project membership MAY further restrict workspace access.
- FR-AUTH-005: Every tenant-owned record MUST carry `workspace_id`; project-owned records MUST also carry `project_id` where applicable.
- FR-AUTH-006: Object authorization MUST be checked server-side for every read and write.
- FR-AUTH-007: Authorization denials MUST be audited without disclosing object existence across tenants.
- FR-AUTH-008: Service-to-service identities MUST use separate credentials and narrowly scoped permissions.

### 3.2 Files, sources, and ingestion

- FR-ING-001: Upload initiation MUST validate authorization, declared MIME type, size, and quota before issuing an upload target.
- FR-ING-002: Upload completion MUST verify object existence, checksum, actual MIME type, and malware-scan status.
- FR-ING-003: A source MUST represent an origin; a document MUST represent a logical item; a document version MUST represent immutable content at a point in time.
- FR-ING-004: Re-uploaded identical content SHOULD deduplicate by cryptographic checksum within the authorized scope.
- FR-ING-005: Ingestion MUST be asynchronous, retryable, observable, and idempotent.
- FR-ING-006: Parsing MUST retain page, section, heading, paragraph, table, and character locators when available.
- FR-ING-007: Chunking MUST preserve links to exact document version and source locators.
- FR-ING-008: Failed ingestion MUST not expose incomplete chunks to retrieval.
- FR-ING-009: Superseding a document version MUST atomically change the current-version pointer without deleting history.
- FR-ING-010: Deletion MUST immediately remove the document from retrieval and asynchronously apply retention/deletion policy to stored artifacts.

### 3.3 Retrieval

- FR-RET-001: Retrieval MUST apply authorization and lifecycle filters before results are returned to generation.
- FR-RET-002: Retrieval MUST support lexical search, semantic vector search, metadata filters, and score fusion.
- FR-RET-003: Retrieval MUST exclude non-current versions by default.
- FR-RET-004: Retrieval MUST return stable source identifiers, document-version identifiers, chunk locators, score components, and a trace identifier.
- FR-RET-005: Retrieval SHOULD deduplicate overlapping chunks and diversify sources.
- FR-RET-006: Retrieval configuration MUST be versioned.
- FR-RET-007: A no-result condition MUST be represented explicitly and MUST NOT be converted into fabricated evidence.
- FR-RET-008: Historical retrieval MUST require an explicit query option and preserve version timestamps.

### 3.4 Conversations and model execution

- FR-CONV-001: A conversation MUST belong to one workspace and MAY belong to one project.
- FR-CONV-002: Messages MUST be immutable after creation; corrections create new messages or annotations.
- FR-CONV-003: Model execution MUST use a provider-neutral request contract.
- FR-CONV-004: Production prompts MUST be stored and versioned in source code.
- FR-CONV-005: The context compiler MUST combine system policy, task mode, approved memory, authorized evidence, conversation state, and tool definitions in a deterministic order.
- FR-CONV-006: Model output MUST be parsed through a typed schema where machine action or structured metadata is required.
- FR-CONV-007: Streaming MUST support cancellation and persist a terminal state of completed, cancelled, failed, or interrupted.
- FR-CONV-008: Every run MUST capture model/provider identifier, request configuration, prompt version, input references, output, usage, latency, and error category.
- FR-CONV-009: The system MUST NOT persist hidden chain-of-thought; it MAY persist concise decision summaries, tool traces, and evaluation-relevant metadata.

### 3.5 Citations and verification

- FR-CIT-001: Each citation MUST link a generated claim to one or more retrieved chunk spans.
- FR-CIT-002: The citation verifier MUST confirm the cited source was in the generation evidence set.
- FR-CIT-003: The verifier MUST reject locators that exceed source boundaries or reference superseded/deleted content for a current answer.
- FR-CIT-004: User interfaces MUST expose source title, version, locator, and access-controlled preview.
- FR-CIT-005: Unsupported claims SHOULD be removed, qualified, or marked as inference before final presentation.

### 3.6 Feedback and failure classification

- FR-FBK-001: Feedback MUST support positive, negative, incorrect, incomplete, citation issue, style issue, unsafe, and free-text correction categories.
- FR-FBK-002: Feedback MUST reference the exact message and model run.
- FR-FBK-003: Failure classification MUST support knowledge missing, stale knowledge, retrieval, ranking, reasoning, citation, tool selection, tool execution, memory, permission, instruction, safety, UI, model limitation, and integration.
- FR-FBK-004: Feedback MAY create candidate evaluation cases but MUST NOT automatically change production behavior.

### 3.7 Memory

- FR-MEM-001: Memory MUST support candidate, approved, rejected, superseded, expired, and deleted states.
- FR-MEM-002: Memory types MUST include preference, profile fact, project fact, relationship, decision, commitment, terminology, procedure, correction, temporary state, and hypothesis.
- FR-MEM-003: Every memory MUST retain provenance and version history.
- FR-MEM-004: Approved memory retrieval MUST enforce workspace/project/user scope and sensitivity.
- FR-MEM-005: Candidate extraction MUST be schema-constrained and produce confidence and rationale metadata.
- FR-MEM-006: A correction MUST supersede rather than silently mutate a prior approved value.
- FR-MEM-007: Memory deletion MUST prevent future context inclusion and trigger configured deletion handling.

### 3.8 Tool registry, approvals, and execution

- FR-TOOL-001: Each tool MUST declare name, version, owner, risk class, schemas, side effects, required scopes, timeout, retry policy, and idempotency mode.
- FR-TOOL-002: Tool calls MUST be authorized independently from model selection.
- FR-TOOL-003: Risk classes MUST include read-only, reversible write, consequential write, and prohibited.
- FR-TOOL-004: Consequential writes MUST create an approval record bound to canonicalized inputs and an expiration time.
- FR-TOOL-005: Any change to approved inputs MUST invalidate the approval.
- FR-TOOL-006: Execution MUST use an idempotency key and record the external reference.
- FR-TOOL-007: Retries MUST distinguish transient transport failure from ambiguous external completion.
- FR-TOOL-008: Tool outputs MUST be treated as untrusted content before being fed back to a model.
- FR-TOOL-009: Tool connections MUST store secrets outside the application database or store only encrypted references.

### 3.9 Evaluation and improvement

- FR-EVAL-001: Evaluation cases MUST be portable files or database records independent of a single hosted evaluation product.
- FR-EVAL-002: Evaluation suites MUST version datasets, scorers, thresholds, and runtime configuration.
- FR-EVAL-003: Required suites MUST cover retrieval, answer groundedness, citation validity, authorization, prompt injection, memory, tool policy, and regression.
- FR-EVAL-004: A candidate improvement MUST reference the failure evidence that motivated it.
- FR-EVAL-005: Promotion MUST require passing thresholds and recorded approval proportional to risk.
- FR-EVAL-006: Feature flags or equivalent controls MUST support limited rollout and rollback.

### 3.10 Audit and operations

- FR-AUD-001: Security- and behavior-relevant events MUST produce append-only audit records.
- FR-AUD-002: Audit records MUST include actor, action, resource, workspace, timestamp, correlation ID, outcome, and policy decision.
- FR-AUD-003: Audit payloads MUST avoid raw secrets and minimize sensitive content.
- FR-AUD-004: Operational traces MUST correlate HTTP requests, jobs, retrieval, model runs, tool runs, approvals, and errors.
- FR-AUD-005: Administrative changes to prompts, policies, connectors, and feature flags MUST be audited.

## 4. Nonfunctional requirements

### 4.1 Security and privacy

- NFR-SEC-001: All network traffic MUST use authenticated TLS outside local development.
- NFR-SEC-002: Sensitive data MUST be encrypted at rest using managed or equivalent key controls.
- NFR-SEC-003: Secrets MUST be loaded from a secret manager or local development secret mechanism and MUST NOT be committed.
- NFR-SEC-004: File upload processing MUST defend against path traversal, archive bombs, malicious active content, and MIME spoofing.
- NFR-SEC-005: Outbound network access from workers and tool executors SHOULD be allowlisted.
- NFR-SEC-006: The system MUST include rate limits and abuse controls at user, workspace, and integration boundaries.
- NFR-SEC-007: Security logs MUST support tamper detection and defined retention.
- NFR-SEC-008: Data export and deletion MUST be supported by workspace and user scope.

### 4.2 Reliability

- NFR-REL-001: All asynchronous jobs MUST be resumable or safely retryable.
- NFR-REL-002: External side effects MUST not duplicate after client, worker, or network retries.
- NFR-REL-003: The API MUST expose readiness and liveness independently.
- NFR-REL-004: Database backups and object-store versioning MUST support the declared recovery objectives.
- NFR-REL-005: A provider outage MUST degrade with an explicit error or configured fallback, not silent data loss.

### 4.3 Performance targets for initial private deployment

- NFR-PERF-001: P95 authenticated non-model API latency SHOULD be below 500 ms under the defined MVP load profile.
- NFR-PERF-002: P95 retrieval latency SHOULD be below 1.5 seconds for the MVP corpus.
- NFR-PERF-003: Initial streamed response SHOULD begin within 3 seconds when the provider is healthy, excluding deep research.
- NFR-PERF-004: Ingestion SHOULD process at least 100 average office-document pages per minute per worker under the reference environment.
- NFR-PERF-005: The system MUST expose token, storage, retrieval, and tool cost attribution by workspace and run.

### 4.4 Maintainability and portability

- NFR-MNT-001: The repository MUST use strict static typing and boundary schema validation.
- NFR-MNT-002: Provider-specific SDK objects MUST not cross the model/embedding/tool adapter boundary.
- NFR-MNT-003: API changes MUST update the OpenAPI contract and contract tests.
- NFR-MNT-004: Schema changes MUST use versioned migrations.
- NFR-MNT-005: Prompts, policies, and retrieval configurations MUST be versioned and reviewable.
- NFR-MNT-006: Local development MUST be reproducible through documented commands and containerized dependencies.

### 4.5 Accessibility and usability

- NFR-UX-001: Core web workflows SHOULD meet WCAG 2.2 AA.
- NFR-UX-002: Long-running operations MUST expose state and failure recovery.
- NFR-UX-003: Citation previews and approval screens MUST be keyboard accessible.
- NFR-UX-004: Destructive actions MUST communicate scope, reversibility, and retention effect.

## 5. Data retention classes

| Class                 | Examples                                    | Default behavior                                |
| --------------------- | ------------------------------------------- | ----------------------------------------------- |
| Operational transient | queues, caches, partial streams             | Short TTL; no durable truth                     |
| User content          | documents, conversations, approved memories | Retain until deletion or configured policy      |
| Security audit        | auth, approvals, policy decisions           | Append-only retention per policy                |
| Evaluation data       | curated cases and scores                    | Versioned; redact unnecessary sensitive content |
| Secrets               | provider credentials, OAuth tokens          | External secret store; references only          |

## 6. Traceability rule

Every backlog task MUST list the requirements it implements. Every release gate MUST identify the automated or documented evidence proving those requirements. A requirement is not considered delivered solely because code exists.
