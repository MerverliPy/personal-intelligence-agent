# API Architecture and Contract Rules

## 1. API style

- External application API: REST over HTTPS, JSON payloads, OpenAPI 3.1.
- Streaming assistant responses: Server-Sent Events (SSE) for the initial web product.
- Asynchronous operations: resource plus job-status endpoints; optional signed webhooks later.
- Internal job/event schemas: versioned messages with stable event names.
- Base path: `/v1`.

## 2. Contract principles

1. API behavior is defined by `api/openapi.yaml` and contract tests.
2. Request and response schemas are generated or shared from one schema source.
3. Unknown request fields SHOULD be rejected on security-sensitive operations.
4. Timestamps are RFC 3339 UTC.
5. IDs are opaque UUID strings.
6. All errors use one envelope and stable error codes.
7. Tenant scope is derived from authenticated access and verified against path/body identifiers.
8. Resource existence is not disclosed to unauthorized users.
9. Writes that may be retried use `Idempotency-Key`.
10. Pagination uses opaque cursors, not mutable offsets, for growing collections.

## 3. Headers

### Request

- `Authorization: Bearer <token>` or secure session cookie
- `X-Request-ID` optional client request identifier
- `Idempotency-Key` required for designated write operations
- `If-Match` for optimistic concurrency on selected mutable resources

### Response

- `X-Request-ID` server correlation identifier
- `ETag` for versioned mutable representations
- `Retry-After` for throttling or temporary unavailability where appropriate

## 4. Error envelope

```json
{
  "error": {
    "code": "DOCUMENT_NOT_READY",
    "message": "The document has not completed ingestion.",
    "request_id": "uuid",
    "details": {
      "document_id": "uuid",
      "status": "INGESTING"
    }
  }
}
```

Rules:

- `message` is safe for the caller.
- Internal stack traces, provider payloads, SQL text, secrets, and unauthorized object metadata are never returned.
- `details` is schema-controlled per error code.

## 5. Endpoint groups

### Health and metadata

- `GET /health/live`
- `GET /health/ready`
- `GET /v1/me`

### Workspaces and projects

- `GET /v1/workspaces`
- `POST /v1/workspaces`
- `GET /v1/workspaces/{workspace_id}`
- `GET /v1/workspaces/{workspace_id}/projects`
- `POST /v1/workspaces/{workspace_id}/projects`

### Documents and ingestion

- `POST /v1/workspaces/{workspace_id}/uploads`
- `POST /v1/workspaces/{workspace_id}/uploads/{upload_id}/complete`
- `GET /v1/workspaces/{workspace_id}/documents`
- `GET /v1/workspaces/{workspace_id}/documents/{document_id}`
- `DELETE /v1/workspaces/{workspace_id}/documents/{document_id}`
- `POST /v1/workspaces/{workspace_id}/documents/{document_id}/ingestion-jobs`
- `GET /v1/workspaces/{workspace_id}/ingestion-jobs/{job_id}`

### Retrieval

- `POST /v1/workspaces/{workspace_id}/retrieval/query`
- `GET /v1/workspaces/{workspace_id}/retrieval/traces/{trace_id}`

The query operation accepts text, project/source/date filters, current/history mode, result budget, and optional debug detail gated by role.

### Conversations

- `POST /v1/workspaces/{workspace_id}/conversations`
- `GET /v1/workspaces/{workspace_id}/conversations`
- `GET /v1/workspaces/{workspace_id}/conversations/{conversation_id}`
- `POST /v1/workspaces/{workspace_id}/conversations/{conversation_id}/messages`
- `GET /v1/workspaces/{workspace_id}/conversations/{conversation_id}/events`
- `POST /v1/workspaces/{workspace_id}/messages/{message_id}/feedback`

`POST .../messages` may return `202 Accepted` with a run resource or establish an SSE stream depending on `Accept` and client capability. The server persists terminal state even if the client disconnects.

### Memory

- `GET /v1/workspaces/{workspace_id}/memories`
- `GET /v1/workspaces/{workspace_id}/memory-candidates`
- `POST /v1/workspaces/{workspace_id}/memory-candidates/{candidate_id}/approve`
- `POST /v1/workspaces/{workspace_id}/memory-candidates/{candidate_id}/reject`
- `PATCH /v1/workspaces/{workspace_id}/memories/{memory_id}`
- `DELETE /v1/workspaces/{workspace_id}/memories/{memory_id}`

### Tools and approvals

- `GET /v1/workspaces/{workspace_id}/tools`
- `POST /v1/workspaces/{workspace_id}/tool-runs`
- `GET /v1/workspaces/{workspace_id}/tool-runs/{tool_run_id}`
- `GET /v1/workspaces/{workspace_id}/approvals`
- `POST /v1/workspaces/{workspace_id}/approvals/{approval_id}/decisions`

Direct arbitrary tool invocation is not exposed. The server resolves a registered tool version and policy from a canonical request.

### Audit and evaluations

- `GET /v1/workspaces/{workspace_id}/audit-events`
- `POST /v1/workspaces/{workspace_id}/evaluation-runs`
- `GET /v1/workspaces/{workspace_id}/evaluation-runs/{run_id}`

## 6. SSE event contract

Suggested events:

```text
event: run.started
data: {"run_id":"...","message_id":"..."}

event: response.delta
data: {"sequence":1,"text":"..."}

event: citation.provisional
data: {"citation_id":"...","source":{...}}

event: approval.required
data: {"approval_id":"...","summary":"..."}

event: response.completed
data: {"message_id":"...","usage":{...},"citations":[...]}

event: run.failed
data: {"error":{"code":"MODEL_PROVIDER_UNAVAILABLE","request_id":"..."}}
```

Every event includes a monotonically increasing sequence and run ID. Reconnection SHOULD support `Last-Event-ID` or a run-events endpoint.

## 7. Idempotency

Required for:

- upload initialization/completion where duplicate resources are undesirable;
- ingestion job creation;
- message/run initiation when clients may retry;
- approval decisions;
- tool execution and any external side effect;
- deletion requests.

The idempotency record binds principal, workspace, operation, canonical request hash, status, and response reference. Reusing a key with different canonical input returns a conflict.

## 8. Concurrency

- Mutable settings, memories, and approval decisions use version/ETag checks.
- Message and audit records are append-only.
- A partial unique constraint or transaction ensures one current document version.
- Approval consumption and tool execution are serialized transactionally.

## 9. Authentication and authorization

OIDC handles authentication. Application authorization evaluates:

- principal status;
- workspace membership and role;
- optional project membership;
- resource sensitivity;
- requested operation;
- tool risk and scopes;
- provider eligibility for the data class.

The web UI is not a security boundary. Every API handler calls the policy service or a route-level authorization wrapper.

## 10. Contract evolution

- Additive fields are allowed within `/v1` when clients can ignore them.
- Renames, semantic changes, required-field additions, enum removals, and response shape changes require a versioned migration.
- Event schemas include a `schema_version`.
- Deprecations include telemetry, documentation, and a removal date.
- Generated clients are tested against the committed OpenAPI document.

## 11. Internal service interfaces

Key internal interfaces:

```ts
interface AuthorizationService {
  authorize(input: AuthorizationRequest): Promise<PolicyDecision>;
}

interface RetrievalService {
  query(input: RetrievalQuery): Promise<RetrievalTraceResult>;
}

interface ObjectStorage {
  createUpload(input: CreateUploadRequest): Promise<UploadTarget>;
  head(key: string): Promise<StoredObjectMetadata>;
  get(key: string): Promise<ReadableStream>;
  delete(key: string): Promise<void>;
}

interface JobDispatcher {
  enqueue<T>(name: string, payload: T, options: JobOptions): Promise<JobReference>;
}

interface ToolExecutor {
  execute(input: AuthorizedToolExecution): Promise<ToolExecutionResult>;
}
```

Interfaces use domain contracts and errors; adapters translate vendor details.
