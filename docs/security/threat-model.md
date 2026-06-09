# Threat Model

## 1. Scope and trust boundaries

This threat model covers the Personal Intelligence and Action Engine as defined in
`docs/02_ARCHITECTURE.md`. The analysis follows a structured STRIDE-aligned
approach across the system's trust boundaries.

### Trust boundaries

| ID   | Boundary                              | Description                                                                                                            |
| ---- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| TB-1 | Browser to Web/API                    | User-facing web application communicates with the API over HTTPS. Authenticated sessions and tokens flow across.       |
| TB-2 | API to data stores                    | API server interacts with PostgreSQL/pgvector, Redis, and object storage. Queries include tenant-scoped authorization. |
| TB-3 | Worker sandbox to untrusted files     | Ingestion worker processes user-uploaded files. Parsers run inside a resource-limited sandbox.                         |
| TB-4 | Model gateway to external provider    | AI model requests carry user/conversation context to third-party model providers.                                      |
| TB-5 | Connector executor to external system | Tool execution connects to external APIs and services.                                                                 |
| TB-6 | Approval boundary                     | Boundary between a proposed action and its consequential side effect. Every write/mutation must cross.                 |
| TB-7 | Workspace boundary                    | Tenant-isolation boundary in every query and operation that touches workspace-owned data.                              |

External content crossing any boundary is untrusted by default and may provide facts
but never authority (per `docs/05_SECURITY_GOVERNANCE.md#2`).

---

## 2. Threat inventory

### 2.1 Cross-tenant object access (TB-2, TB-7)

**Threat:** A user or service reads or mutates another workspace's data by
omitting or forging a workspace identifier in a request.

**Severity:** Critical. Violates the fundamental tenancy guarantee.

**Controls:**

- Every tenant-owned record includes a workspace key (foreign key constraint).
- Server-side authorization checks workspace membership before any data operation.
- Queries filter by workspace at the repository/data-access layer, not at the handler.
- Negative authorization tests prove that workspace-A requests cannot read workspace-B data.
- Defense in depth: optional row-level security (RLS) policies on PostgreSQL tables.

**References:** `docs/05_SECURITY_GOVERNANCE.md#3`, `docs/02_ARCHITECTURE.md#11`.

---

### 2.2 Prompt injection in documents/web (TB-3, TB-4)

**Threat:** A crafted document, webpage, or search result contains instructions
that the model interprets as system commands, altering behavior, policy, or
tool access.

**Severity:** High. Can subvert model behavior despite server-side controls.

**Controls:**

- Retrieved content is delimited in evidence containers with explicit source metadata.
- Immutable system safety policy occupies the top of context order (before evidence).
- Tool definitions are filtered _before_ model invocation, not determined by the model.
- Tool execution reauthorizes independently using the canonical policy engine.
- The model is explicitly instructed that evidence is untrusted quoted data.
- Injection-bearing fixtures are included in evaluation suites.
- No instruction found in evidence can promote itself to policy, request new tools,
  request secrets, or bypass approval.

**References:** `docs/05_SECURITY_GOVERNANCE.md#6`, `docs/02_ARCHITECTURE.md#9`.

---

### 2.3 Malicious upload (TB-3)

**Threat:** An attacker uploads a file that exploits a parser vulnerability
(path traversal, archive bomb, resource exhaustion, macro execution) or
bypasses content-type restrictions to deliver executable code.

**Severity:** High. Can compromise the ingestion worker or exfiltrate data.

**Controls:**

- Signed, bounded, short-lived upload URLs prevent arbitrary key selection.
- Cryptographic checksum verification at upload completion.
- MIME type detection via actual content inspection (magic bytes), not client-supplied headers.
- Malware scanning before parsing/indexing (pluggable adapter).
- Isolated parser execution with CPU, memory, file-system, and network limits.
- Macro and active-content disabling (e.g., Office documents).
- Path normalization and archive traversal prevention.
- Quarantine state and curator release process for unverified files.
- Timeout and recursion limits on parser execution.

**References:** `docs/05_SECURITY_GOVERNANCE.md#7`, `docs/05_SECURITY_GOVERNANCE.md#3`.

---

### 2.4 SSRF and unsafe egress (TB-5)

**Threat:** A tool or connector makes a maliciously-crafted outbound HTTP request
to internal services, metadata endpoints, or unauthorized external hosts.

**Severity:** High. Can expose internal infrastructure or exfiltrate data.

**Controls:**

- URL validation before every outbound request (scheme, host, port allowlist).
- DNS resolution controls and IP allowlisting.
- Network-level egress controls in the connector/tool executor.
- Connectors run in isolated execution contexts.
- Tool definitions cannot grant arbitrary fetch authority; destinations are
  pre-registered and reviewed.
- No tool is permitted to connect to private/loopback addresses by default.

**References:** `docs/05_SECURITY_GOVERNANCE.md#3`.

---

### 2.5 Approval bypass (TB-6)

**Threat:** An attacker replays, modifies, or forges an approval token to
execute a high-risk action without genuine human authorization.

**Severity:** Critical. Would allow unauthorized external actions.

**Controls:**

- Canonical request hash binds an approval to the exact proposed action.
- Approval expiry enforces time-bound validity (short-lived tokens).
- Reauthorization at execution time verifies the approval is still valid.
- Transactional consume prevents duplicate execution (idempotency key).
- Approval records are append-only and auditable.
- No model output can independently authorize an action — the policy engine
  is the sole authority.

**References:** `docs/05_SECURITY_GOVERNANCE.md#3`, `docs/05_SECURITY_GOVERNANCE.md#5`.

---

### 2.6 Data exfiltration through model provider (TB-4)

**Threat:** Sensitive data is accidentally or maliciously sent to a model
provider that is not authorized to receive that sensitivity class, or a provider
fallback routes regulated data to an ineligible provider.

**Severity:** High. Violates data governance and sensitivity policies.

**Controls:**

- Sensitivity classification at source/document/conversation/memory level.
- Provider eligibility registered per sensitivity class.
- Provider routing decisions are auditable and logged (redacted).
- Fallback provider must respect the same or stricter data policy.
- Private/local inference path for highly restricted data (no external provider).
- Provider payload is minimized (identifiers, not large blobs).
- Secrets are never included in provider requests.
- Configuration logging redacts sensitive fields.

**References:** `docs/05_SECURITY_GOVERNANCE.md#10`, `docs/05_SECURITY_GOVERNANCE.md#3`.

---

### 2.7 Secret leakage (all boundaries)

**Threat:** Secrets (API keys, database URLs, session secrets, credentials) are
exposed through logs, error messages, source code, or provider requests.

**Severity:** Critical. Direct credential compromise.

**Controls:**

- `Redacted` wrapper class prevents serialization of secret values.
- Structured logging redacts all configured sensitive field names.
- Secret scanning in CI prevents commits containing secret patterns.
- Provider SDK credentials are stored in environment variables, never in source.
- Error messages name missing keys but never print values.
- `.env` is gitignored; `.env.example` contains only placeholders.
- No plaintext credentials in database fields.

**References:** `docs/05_SECURITY_GOVERNANCE.md#8`, `docs/05_SECURITY_GOVERNANCE.md#9`.

---

### 2.8 Knowledge and memory poisoning (TB-2, TB-4)

**Threat:** An authorized user or ingested document introduces false, biased,
or malicious information into the knowledge base or approved memory, which is
then presented as authoritative in future responses.

**Severity:** Medium-High. Undermines trust in system output.

**Controls:**

- Source trust metadata tracks provenance and confidence.
- Quarantine state for knowledge pending curation.
- Versioning allows rollback and audit of knowledge changes.
- Conflicting-source disclosure when multiple sources disagree.
- Memory has candidate → approved lifecycle with human approval for
  sensitive/consequential memories.
- Correction and deletion capabilities for poisoned entries.

**References:** `docs/05_SECURITY_GOVERNANCE.md#3`.

---

### 2.9 Audit tampering (TB-2)

**Threat:** An attacker or compromised service modifies or deletes audit logs
to conceal malicious activity.

**Severity:** High. Destroys forensic evidence and compliance record.

**Controls:**

- Audit storage is append-only through application APIs.
- Restricted writer role (only the audit subsystem creates records).
- Integrity monitoring on audit tables.
- Retention policy with export controls.
- Audit query is read-only and workspace-scoped (no cross-workspace access).

**References:** `docs/05_SECURITY_GOVERNANCE.md#9`, `docs/05_SECURITY_GOVERNANCE.md#3`.

---

### 2.10 Unsafe self-modification (all boundaries)

**Threat:** The system automatically modifies its own prompts, policies, tool
definitions, or approval requirements without human review.

**Severity:** Critical. Could silently change safety boundaries.

**Controls:**

- Prompts and policies are source-controlled in the repository.
- Policy/prompt promotion requires explicit review and deployment.
- Feature flags gate any automatic behavior changes.
- Evaluations measure safety-critical behaviors before release.
- Rollback capability for prompt/policy versions.

**References:** `docs/05_SECURITY_GOVERNANCE.md#3`, `docs/05_SECURITY_GOVERNANCE.md#1`.

---

## 3. Threat-to-boundary mapping

| Threat                       | TB-1 | TB-2 | TB-3 | TB-4 | TB-5 | TB-6 | TB-7 |
| ---------------------------- | ---- | ---- | ---- | ---- | ---- | ---- | ---- |
| Cross-tenant access          |      | X    |      |      |      |      | X    |
| Prompt injection             |      |      | X    | X    |      |      |      |
| Malicious upload             |      |      | X    |      |      |      |      |
| SSRF / unsafe egress         |      |      |      |      | X    |      |      |
| Approval bypass              |      |      |      |      |      | X    |      |
| Data exfiltration (provider) |      |      |      | X    |      |      |      |
| Secret leakage               | X    | X    | X    | X    | X    |      |      |
| Knowledge/memory poisoning   |      | X    |      | X    |      |      |      |
| Audit tampering              |      | X    |      |      |      |      |      |
| Unsafe self-modification     | X    | X    | X    | X    | X    | X    | X    |

---

## 4. Assumptions and residual risks

### Assumptions

- The host operating system, container runtime, and network are maintained
  with security patches independently of this application.
- TLS is terminated at the ingress and internal service communication runs
  within a trusted network or with mutual TLS.
- OIDC provider is trusted to correctly authenticate principals.
- Database credentials are provisioned through a secure mechanism (secrets
  manager, sealed secrets, or equivalent) and not hardcoded.

### Residual risks accepted

- A compromised OIDC provider could impersonate users. Mitigation: the
  relatively low likelihood for self-hosted/enterprise providers.
- A compromised database superuser can bypass application authorization.
  Mitigation: defense in depth via RLS; restricted production access.
- An authorized user with curator privileges could approve poisoned knowledge.
  Mitigation: provenance, audit trail, rollback.
- Third-party model providers may log prompts despite contractual prohibitions.
  Mitigation: sensitivity-based routing, private/local inference for highly
  restricted data.

---

## 5. Review and maintenance

This threat model must be reviewed when:

- A new trust boundary is introduced (new infrastructure dependency, connector).
- Tenant isolation or authorization semantics change.
- A new provider or tool category is added.
- The approval model changes.
- A security-relevant architecture decision record (ADR) is created.

Updates are version-controlled alongside the implementation.
