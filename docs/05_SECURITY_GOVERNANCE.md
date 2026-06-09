# Security, Privacy, and Governance Specification

## 1. Governing rule

The system may improve its knowledge and performance, but it may not independently expand its authority.

## 2. Trust model

Trusted only after verification:

- authenticated principal identity;
- server-side policy configuration;
- registered tool definitions;
- approved prompt/policy versions from source control;
- signed application deployments;
- database constraints and verified application state.

Untrusted by default:

- user text;
- uploaded files;
- webpages and search results;
- email and connector content;
- model output;
- tool output;
- filenames, MIME declarations, metadata, and embedded links;
- instructions found in retrieved content.

Untrusted content may provide facts but never authority.

## 3. Threat scenarios and controls

| Threat                                   | Required controls                                                                                                                         |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Cross-tenant object access               | Workspace key on records, server-side object authorization, negative tests, optional RLS defense in depth                                 |
| Prompt injection in documents/web        | Delimit retrieved content, immutable system policy, tool filtering outside model, injection tests, no instruction promotion from evidence |
| Approval bypass                          | Canonical request hash, exact-input binding, expiry, reauthorization at execution, transactional consume                                  |
| Duplicate external action                | Idempotency key, external reference capture, ambiguous-state reconciliation                                                               |
| Malicious upload                         | Signed bounded upload, checksum, MIME verification, malware scan, sandbox parsing, archive limits                                         |
| SSRF/unsafe egress                       | URL validation, DNS/IP controls, network allowlists, connector isolation, no arbitrary tool-created fetch authority                       |
| Secret leakage                           | Secret manager, redaction, structured logs, provider request minimization, no secrets in prompts                                          |
| Data exfiltration through model provider | Sensitivity policy, provider eligibility, redaction, private/local path for restricted data, auditable routing                            |
| Memory poisoning                         | Candidate state, provenance, confidence, approval for sensitive/consequential memory, correction and deletion                             |
| Knowledge poisoning                      | Source trust metadata, quarantine, versioning, conflicting-source disclosure, curator controls                                            |
| Audit tampering                          | Append-only storage, restricted writer, integrity/retention monitoring, export controls                                                   |
| Unsafe self-modification                 | Source-controlled prompts/policies, evaluations, human approval, feature flags, rollback                                                  |

## 4. Authorization model

### Roles

- Owner: full workspace administration and approval authority
- Admin: member/project/source administration subject to policy
- Curator: knowledge and memory curation
- Member: standard use and authorized project access
- Auditor: read-only audit/evaluation access

### Policy inputs

- principal and service identity
- workspace/project membership
- resource ownership and sensitivity
- operation
- tool risk class and requested scopes
- current environment
- approval state
- provider eligibility
- rate and budget constraints

Policy decisions return allow, deny, or approval-required plus a stable reason code. Model output cannot override the result.

## 5. Approval matrix

| Operation                                          | Default                                  |
| -------------------------------------------------- | ---------------------------------------- |
| Read authorized documents                          | Allow                                    |
| Search approved sources                            | Allow                                    |
| Analyze or summarize                               | Allow                                    |
| Create internal draft                              | Allow                                    |
| Create reversible internal organizational metadata | Allow or configurable                    |
| Send external message                              | Approval required                        |
| Create/update external calendar event              | Approval required                        |
| Delete data                                        | Approval required; show retention effect |
| Change permissions or connectors                   | Approval required                        |
| Purchase, payment, contract, legal submission      | Prohibited initially                     |
| Deploy or change production infrastructure         | Human-controlled outside agent           |

## 6. Prompt-injection controls

- System and policy instructions are assembled by trusted application code.
- Retrieved content is inserted in explicit evidence containers with source metadata.
- The model is told that evidence can contain malicious instructions and must be treated as quoted data.
- Tool availability is filtered before model invocation.
- Tool execution reauthorizes independently after model output.
- The system rejects attempts by evidence to request secrets, policy changes, new tools, or approval bypass.
- High-risk workflows use allowlisted sources and tools.
- Security evaluation cases include indirect injection, encoded injection, conflicting instructions, and malicious tool output.

## 7. File-processing controls

- Maximum file and expanded archive sizes
- Allowed type list with actual-content detection
- Cryptographic checksum
- Malware scanning before parsing/indexing
- Isolated parser process/container with CPU, memory, file, and network limits
- Macro and active-content disabling
- Path normalization and archive traversal prevention
- Timeout and recursion limits
- Quarantine state and curator release process

## 8. Sensitive data

### Minimum handling

- Collect only data required for the user workflow.
- Classify at source/document/conversation/memory level.
- Minimize provider payloads and logs.
- Encrypt stored content and backups.
- Use signed, short-lived access URLs.
- Support export, deletion, and access review.
- Separate production from development and test data.

### Prohibited storage

The application MUST NOT store plaintext passwords, API keys, OAuth refresh tokens, private keys, or equivalent secrets in ordinary database fields or logs.

## 9. Logging and audit

Log structured metadata, not raw content by default. Sensitive text may appear only in explicitly protected diagnostic storage with access and retention controls.

Audit events include:

- login and session events;
- membership and permission changes;
- document upload, quarantine, version, and deletion;
- provider routing decisions for sensitive data;
- memory approval, edit, supersession, and deletion;
- tool proposal, policy decision, approval, execution, and reconciliation;
- prompt/policy/configuration promotion;
- export, deletion, and administrative access.

## 10. Model and connector governance

Each model/embedding/connector adapter registers:

- owner and support status;
- permitted sensitivity classes;
- data retention configuration;
- regions/endpoints where relevant;
- timeout, retry, and fallback behavior;
- known limitations;
- contract and security tests.

Fallbacks MUST respect the same or stricter data policy. A provider outage must not reroute regulated data to an ineligible provider.

## 11. Secure development gates

Tasks affecting auth, tenancy, uploads, retrieval, memory, tools, approvals, connectors, or secrets require:

- threat review;
- negative authorization tests;
- input and output schema tests;
- abuse and injection cases;
- dependency/security scanning;
- reviewer evidence before completion.

## 12. Incident and rollback readiness

The system must support:

- disabling a provider, tool, connector, or feature flag;
- revoking connector credentials;
- invalidating sessions;
- pausing queues;
- removing a poisoned source from retrieval;
- disabling a prompt/policy version;
- restoring database/object data within declared objectives;
- identifying affected runs through trace and audit IDs.
