# Data Model and Lifecycle Specification

## 1. Modeling principles

- UUID primary keys; timestamps are UTC `timestamptz`.
- Every tenant-owned table includes `workspace_id`; project-scoped tables include `project_id` when applicable.
- Immutable evidence and event records are appended rather than overwritten.
- Mutable business objects use explicit lifecycle states and optimistic concurrency where conflicting edits matter.
- External identifiers never replace internal primary keys.
- Soft deletion controls immediate application visibility; retention jobs control physical deletion.
- JSONB is reserved for versioned extension data, not core relations that require constraints or authorization.
- Sensitive provider credentials are not stored in ordinary application columns; store secret references and minimal metadata.

## 2. Entity groups

### Identity and tenancy

- `users`: internal principal profile and status
- `user_identities`: OIDC issuer/subject mappings
- `workspaces`: tenant boundary
- `workspace_members`: role and membership state
- `projects`: optional knowledge/work boundary
- `project_members`: optional project-specific role restriction

### Knowledge

- `sources`: origin connector or upload collection
- `documents`: logical document identity
- `document_versions`: immutable content version
- `stored_files`: object storage metadata and checksum
- `ingestion_jobs`: processing state and retry metadata
- `document_chunks`: text spans and locators
- `chunk_embeddings`: vector representation and model metadata
- `retrieval_configs`: versioned ranking settings
- `retrieval_traces`: query, filters, configuration, latency, and outcome
- `retrieval_results`: ordered chunk evidence for a trace

### Conversations and generation

- `conversations`: workspace/project-scoped thread
- `messages`: immutable user/assistant/system-visible messages
- `model_runs`: provider-neutral generation trace metadata
- `citations`: claim or response span linked to retrieved chunks
- `feedback`: user assessment and correction

### Memory

- `memories`: stable identity and current lifecycle state
- `memory_versions`: immutable statement and metadata history
- `memory_links`: entity/project/source relationships

### Tools and approvals

- `tool_definitions`: registered tool versions and policy metadata
- `tool_connections`: workspace-scoped connector references
- `tool_runs`: proposed and executed calls
- `approval_requests`: immutable canonical request hash, decision, and expiry
- `idempotency_records`: duplicate suppression and response replay

### Evaluation and improvement

- `evaluation_suites`: versioned test collections and thresholds
- `evaluation_cases`: typed inputs and expected properties
- `evaluation_runs`: execution metadata
- `evaluation_results`: scorer output and evidence
- `failure_records`: normalized production/evaluation failures
- `improvement_candidates`: proposed knowledge, prompt, policy, workflow, or training change
- `feature_flags`: controlled rollout state

### Audit and operations

- `audit_events`: append-only redacted security and governance events
- `outbox_events`: transactional event publication

## 3. Core cardinalities

```text
workspace 1---* workspace_member *---1 user
workspace 1---* project
project   1---* document
source    1---* document

document 1---* document_version
version  1---* document_chunk
chunk     1---* chunk_embedding

conversation 1---* message
message      1---0..1 model_run
model_run    1---* citation *---1 document_chunk
model_run    1---0..* retrieval_trace
retrieval_trace 1---* retrieval_result *---1 document_chunk

memory 1---* memory_version

tool_run 1---0..1 approval_request
approval_request 1---0..1 approving user

evaluation_suite 1---* evaluation_case
evaluation_run   1---* evaluation_result *---1 evaluation_case
```

## 4. State machines

### Document version

```text
PENDING_UPLOAD
  -> UPLOADED
  -> QUARANTINED | INGESTING
  -> READY | FAILED
READY -> SUPERSEDED | DELETED
FAILED -> INGESTING (explicit retry)
```

Rules:

- Only `READY` versions may become current.
- At most one current version exists per document.
- `SUPERSEDED`, `DELETED`, `FAILED`, or `QUARANTINED` versions are excluded from default retrieval.

### Ingestion job

```text
QUEUED -> RUNNING -> SUCCEEDED
                  -> RETRY_WAIT -> RUNNING
                  -> FAILED_FINAL
                  -> CANCELLED
```

A deterministic idempotency key is derived from document version, pipeline version, and operation.

### Message/model run

```text
CREATED -> STREAMING -> COMPLETED
                    -> CANCELLED
                    -> FAILED
                    -> INTERRUPTED
```

Partial model output may be retained for diagnostics only according to policy and must not be presented as a completed answer.

### Memory

```text
CANDIDATE -> APPROVED | REJECTED
APPROVED  -> SUPERSEDED | EXPIRED | DELETED
```

A memory correction creates a new `memory_version`; it does not overwrite provenance.

### Approval

```text
PENDING -> APPROVED | REJECTED | EXPIRED | CANCELLED
APPROVED -> CONSUMED | REVOKED
```

Execution is allowed only when:

- approval is `APPROVED` and unexpired;
- canonical tool name/version and canonical input hash match;
- current policy still permits execution;
- approval has not been consumed unless the action explicitly supports approved repetition.

### Tool run

```text
PROPOSED -> POLICY_DENIED
         -> APPROVAL_PENDING
         -> READY
READY    -> EXECUTING -> SUCCEEDED
                     -> FAILED_RETRYABLE -> READY
                     -> FAILED_FINAL
                     -> UNKNOWN_EXTERNAL_STATE
```

`UNKNOWN_EXTERNAL_STATE` prohibits blind retry until reconciliation determines whether the side effect occurred.

## 5. Provenance model

Every generated or learned artifact should be traceable:

- Citation -> chunk -> document version -> file/source
- Memory version -> originating message/source/user approval
- Improvement candidate -> feedback/failure/evaluation evidence
- Tool run -> requestor/model run -> policy decision -> approval -> external reference
- Model run -> prompt version -> retrieval traces -> model/provider configuration

## 6. Deletion semantics

### Immediate effects

- Set lifecycle state to deleted or revoked.
- Exclude object from retrieval, memory context, user lists, and new model calls.
- Revoke active signed links and connector access where applicable.
- Emit audit and deletion workflow events.

### Asynchronous effects

- Delete or tombstone object-store artifacts according to retention policy.
- Remove vectors and search indexes.
- Remove caches.
- Rebuild affected derived indexes if needed.
- Retain only legally or operationally required redacted audit metadata.

### Referential integrity

Citations to deleted content remain as historical audit references but their content preview becomes unavailable. Evaluation fixtures containing deleted sensitive content must be redacted or deleted.

## 7. Index strategy

Required composite indexes include:

- `(workspace_id, status)` on tenant-owned lifecycle tables
- `(workspace_id, project_id, created_at desc)` for conversations, documents, and audit views
- unique `(issuer, subject)` on external identities
- unique `(workspace_id, idempotency_key, operation)` on idempotency records
- unique current-version constraint per document through partial index
- GIN full-text index on chunk search vector
- HNSW or IVFFlat vector index after corpus and query behavior are measured
- `(workspace_id, document_version_id, ordinal)` on chunks
- `(workspace_id, expires_at, status)` on approvals

Vector index selection is an evaluated deployment decision. The schema reserves embedding model and dimension metadata so migrations can support a new embedding space without silently mixing vectors.

## 8. Row-level security

Application authorization is mandatory. PostgreSQL row-level security SHOULD additionally protect production tenant tables as defense in depth after a tested session-variable or database-role strategy is implemented. RLS must not be enabled without integration tests proving background workers, migrations, and administrative operations remain controlled.

## 9. Data classification fields

Sources, documents, conversations, memories, and tool connections carry a sensitivity class:

- `PUBLIC`
- `INTERNAL`
- `CONFIDENTIAL`
- `HIGHLY_CONFIDENTIAL`
- `REGULATED`
- `PROHIBITED`

Policy controls model-provider eligibility, connector eligibility, logging, retention, and export for each class.

## 10. Migration rules

- All schema changes are versioned.
- Expand-and-contract is preferred.
- Data backfills are observable jobs, not long opaque migration transactions when volume is material.
- New non-null requirements are introduced only after data is populated and validated.
- Destructive changes need a human-approved migration plan and restore test.
- Embedding model changes use parallel columns/tables or a new embedding version; never reinterpret existing vectors.
