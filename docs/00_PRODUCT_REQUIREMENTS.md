# Product Requirements Document

**Product:** Personal Intelligence and Action Engine  
**Status:** Approved baseline  
**Audience:** Product, architecture, engineering, security, QA, and coding agents  
**Normative language:** MUST, MUST NOT, SHOULD, SHOULD NOT, and MAY are requirements keywords.

## 1. Product statement

A private, evidence-grounded intelligence and action platform that retrieves trusted information, maintains explicitly governed memory, analyzes complex inputs, supports decisions, and performs authorized work through tools without independently expanding its authority.

## 2. Problem

General-purpose chat systems are useful but insufficient for durable high-value work because they typically lack one or more of the following:

- controlled access to private and current knowledge;
- durable, correctable, source-linked memory;
- reliable citation and version provenance;
- deterministic authorization around external actions;
- persistent workflow state and recovery;
- measurable evaluation and regression control;
- an auditable learning process.

The product closes these gaps while avoiding uncontrolled continual training and unrestricted autonomous action.

## 3. Initial user and future users

### 3.1 Initial persona: Owner-operator

A single primary owner who needs a private assistant for research, document intelligence, planning, decision support, and carefully authorized execution.

Needs:

- rapid answers grounded in personal and approved sources;
- transparent sources and assumptions;
- project-specific context;
- complete control over memory and connected systems;
- confidence that sensitive actions cannot occur silently.

### 3.2 Future personas

- Workspace administrator
- Knowledge curator
- Project contributor
- Security/compliance reviewer
- Read-only auditor

The MVP remains single-owner in product experience but the data and authorization model MUST be multi-tenant capable.

## 4. Goals

| ID    | Goal                                                    | Success signal                                                                      |
| ----- | ------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| G-001 | Produce source-grounded answers from approved documents | At least 90% citation validity on the curated MVP evaluation set                    |
| G-002 | Preserve workspace and project isolation                | Zero cross-tenant retrieval or object-access failures in security tests             |
| G-003 | Make uncertainty and evidence visible                   | Every retrieved factual answer exposes citations and answer confidence metadata     |
| G-004 | Capture corrections and feedback                        | Feedback is linked to the exact message, model run, retrieval trace, and source set |
| G-005 | Support controlled persistent memory                    | Every durable memory is typed, source-linked, visible, editable, and deletable      |
| G-006 | Execute tools only within policy                        | Consequential actions require explicit approval and are idempotent and audited      |
| G-007 | Improve without uncontrolled self-modification          | Every promoted change passes portable regression gates and can be rolled back       |
| G-008 | Remain provider-portable                                | Core domain logic depends on internal interfaces, not provider-specific SDK types   |

## 5. Non-goals

The initial program MUST NOT attempt:

- autonomous weight retraining from raw conversations;
- unrestricted browsing plus arbitrary form submission;
- unsupervised financial, legal, medical, employment, or contractual actions;
- broad multi-agent swarms without bounded responsibilities;
- automatic trust of retrieved instructions;
- fully offline operation;
- replacing primary systems of record;
- a general public multi-tenant SaaS launch before private deployment is stable.

## 6. Product principles

1. **Evidence before assertion.** Retrieve or state uncertainty when authoritative information should exist.
2. **Authority is explicit.** Learning, access, and action are separate capabilities.
3. **Retrieved content is data.** It never changes system policy or tool permissions.
4. **Memory is governed.** Conversation history does not automatically become durable truth.
5. **Inaction may be correct.** The system should not modify code, data, or external systems merely because it can.
6. **Every consequential operation is traceable.** Inputs, policies, approvals, tools, results, and errors are recorded.
7. **Behavior changes are software changes.** Prompts, policies, and evaluators are version-controlled and tested.
8. **Rollback is a feature.** Models, prompts, policies, schemas, indexes, and workflows are versioned.

## 7. Product modes

| Mode     | User intent                        | Minimum system behavior                                                                                                   |
| -------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Ask      | Direct question                    | Answer from current context and approved knowledge; identify uncertainty                                                  |
| Research | Multi-source investigation         | Search, compare, rank sources, and produce a cited synthesis                                                              |
| Analyze  | Evaluate supplied evidence or data | Separate observations, assumptions, methods, findings, and limitations                                                    |
| Plan     | Define work                        | Produce objectives, dependencies, steps, risks, and completion criteria                                                   |
| Execute  | Perform authorized work            | Apply policy, request approval where required, execute idempotently, and audit                                            |
| Learn    | Improve future performance         | Create candidate memory, evaluation, prompt, retrieval, or workflow changes; never silently promote consequential changes |

## 8. Core user journeys

### J-001: Upload and question a document

1. User selects a workspace/project and uploads a supported file.
2. System validates file type, size, malware status, and authorization.
3. System stores the original, extracts content, versions the document, segments it, indexes it, and reports processing status.
4. User asks a question.
5. System retrieves only authorized current-version chunks.
6. System answers with citations linked to the original source and location.
7. User can inspect the retrieval evidence and provide feedback.

### J-002: Research across private and web sources

1. User enters a research objective and scope.
2. System identifies private and external sources permitted for the request.
3. System retrieves, compares authority and freshness, records conflicts, and produces a report.
4. Claims link to evidence; assumptions and unresolved conflicts are explicit.

### J-003: Approve a memory

1. A conversation produces a reusable fact, preference, decision, or procedure.
2. System creates a candidate memory with type, source, confidence, scope, and sensitivity.
3. User approves, edits, or rejects it.
4. Approved memory becomes retrievable only in its authorized scope.
5. User can later supersede or delete it with an audit trail.

### J-004: Controlled external action

1. User requests an action such as preparing an email or calendar change.
2. System plans the action and checks tool policy.
3. Read-only or draft creation proceeds if allowed.
4. Sending, deletion, purchase, permission change, or other consequential action creates an approval request.
5. Approved execution uses an idempotency key, captures the external result, and records the audit event.

### J-005: Correct a poor answer

1. User marks an answer incorrect or supplies a correction.
2. System records feedback against the exact response, source set, prompt/model versions, and trace.
3. System classifies the failure: knowledge, retrieval, ranking, reasoning, citation, instruction, memory, tool, or policy.
4. The correction becomes a candidate test and, where appropriate, a candidate memory or knowledge update.
5. Promotion requires evaluation and approval according to risk.

## 9. MVP scope

The MVP comprises Phases P0 through P3:

- authenticated private workspace and projects;
- RBAC-ready tenant model;
- file upload and object storage;
- document versioning and ingestion jobs;
- text extraction for initial supported formats;
- semantic and keyword retrieval with ACL filtering;
- conversation and streaming responses;
- source-grounded answer generation;
- citations, retrieval inspection, and feedback;
- audit events and telemetry;
- portable retrieval and answer evaluation harness.

Memory, external actions, and automated improvement are not required for the first production release but their schema and boundaries are reserved.

## 10. Product requirements

### Knowledge and retrieval

- PR-001: The user MUST be able to upload approved files into a workspace/project.
- PR-002: The user MUST see processing status and actionable failure reasons.
- PR-003: The system MUST preserve the original file, extracted representation, source metadata, and document-version lineage.
- PR-004: Retrieval MUST combine semantic, lexical, metadata, and authorization constraints.
- PR-005: Answers based on retrieved knowledge MUST cite exact source spans.
- PR-006: Superseded or deleted versions MUST NOT be used unless the user explicitly requests historical analysis.
- PR-007: Conflicting sources MUST be surfaced rather than silently reconciled.

### Conversations and answers

- PR-010: The user MUST be able to create conversations scoped to a workspace and optionally a project.
- PR-011: Responses SHOULD stream incrementally.
- PR-012: The system MUST distinguish sourced claims, inference, assumptions, estimates, and recommendations.
- PR-013: The user MUST be able to inspect citations and retrieval evidence.
- PR-014: The system MUST report insufficient evidence rather than fabricate support.
- PR-015: The system MUST preserve message, model, prompt, tool, and retrieval trace identifiers.

### Memory

- PR-020: Durable memory MUST be separate from raw conversation history.
- PR-021: Candidate memories MUST include type, source, confidence, sensitivity, access scope, and lifecycle state.
- PR-022: Sensitive, inferred, or consequential memories MUST require approval.
- PR-023: Users MUST be able to view, edit, reject, supersede, and delete memories.
- PR-024: Deleted memories MUST stop affecting future responses and follow retention policy.

### Tools and actions

- PR-030: Tools MUST be registered with declared risk, input schema, output schema, permissions, and idempotency behavior.
- PR-031: Consequential actions MUST pause for explicit approval.
- PR-032: External writes MUST be idempotent or protected against duplicate execution.
- PR-033: Tool inputs, outputs, approvals, and external references MUST be audited.
- PR-034: Retrieved text MUST NOT grant tool authority.

### Improvement

- PR-040: Feedback MUST be attributable to exact system versions and traces.
- PR-041: Failures MUST use a stable classification taxonomy.
- PR-042: Candidate improvements MUST be evaluated before production promotion.
- PR-043: Prompt and policy changes MUST be version-controlled application changes.
- PR-044: Production releases MUST be reversible.

## 11. Product metrics

### Quality

- Citation validity
- Retrieval recall@k and precision@k
- Answer groundedness
- User correction rate
- Unresolved-conflict disclosure rate
- Memory approval and correction rate
- Tool action success and duplicate-action rate

### Safety and governance

- Cross-tenant access failures
- Approval bypass attempts and successes
- Prompt-injection test pass rate
- Sensitive-data logging violations
- Unauthorized memory promotion rate
- Rollback success rate

### Operations

- P50/P95 retrieval and response latency
- Ingestion throughput and failure rate
- Cost per completed user task
- Queue age
- Model/provider error rate
- Recovery time objective achievement

## 12. Release criteria

A phase may be released only when:

- all mandatory tasks are `DONE` or independently evidenced `NO_CHANGE_REQUIRED`;
- its phase gate passes;
- no unresolved BLOCKER or HIGH security defect remains;
- migrations and restore procedures are tested;
- relevant SLOs and alerts exist;
- operational and user documentation is current;
- rollback is demonstrated.
