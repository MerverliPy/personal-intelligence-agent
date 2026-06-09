# Test and Evaluation Strategy

## 1. Quality model

The platform requires both conventional software testing and probabilistic AI evaluation. A passing unit test suite does not establish retrieval or answer quality; a good model score does not establish authorization, idempotency, or operational safety.

## 2. Test layers

### Static and contract

- TypeScript strict typecheck
- lint and formatting
- OpenAPI validation and breaking-change detection
- environment schema validation
- migration lint/smoke checks
- dependency and secret scanning

### Unit

- value objects and domain state machines
- policy decisions
- canonical request hashing
- chunking and locator preservation
- rank fusion and deduplication
- citation boundary verification
- memory lifecycle
- error mapping and redaction

### Integration

- PostgreSQL queries and workspace filters
- pgvector/full-text retrieval
- object storage adapter
- job retries and idempotency
- OIDC/session adapter using test provider
- model and embedding adapters using recorded/fake providers
- connector policy and approval consumption

### End-to-end

- upload -> ingest -> retrieve -> answer -> inspect citation -> feedback
- memory candidate -> approve -> use -> supersede/delete
- proposed tool action -> approve -> execute once -> audit
- provider outage, client disconnect, retry, and recovery
- export and deletion

### Security

- broken object-level authorization
- cross-workspace/project retrieval
- malicious filename/MIME/archive
- direct and indirect prompt injection
- malicious tool output
- SSRF and egress attempts
- approval input mutation and replay
- secret/log scanning
- rate-limit and quota abuse

### Resilience

- database restart
- Redis/job interruption
- object-store transient failure
- model/embedding provider timeout and partial stream
- worker crash during each ingestion/action stage
- duplicate event delivery
- unknown external action state

## 3. AI evaluation suites

### Retrieval suite

Metrics:

- recall@5 and recall@10
- precision@5
- mean reciprocal rank or nDCG
- source diversity where expected
- current-version correctness
- authorization correctness
- P50/P95 latency

Initial gate targets for curated MVP corpus:

- recall@10 >= 0.90
- precision@5 >= 0.70
- current-version correctness = 1.00
- authorization correctness = 1.00
- citation locator validity = 1.00

Thresholds are baselines and must be recalibrated with representative data; security correctness is never traded for recall.

### Grounded-answer suite

Dimensions:

- answer correctness against reference or rubric
- claim support by retrieved evidence
- citation completeness and validity
- conflict disclosure
- uncertainty behavior when evidence is absent
- instruction adherence
- verbosity/style separately from factual quality

Initial gates:

- citation validity >= 0.98 overall and 1.00 for security/policy test cases
- groundedness >= 0.90 on curated set
- fabricated-source rate = 0
- explicit insufficient-evidence behavior >= 0.95

### Memory suite

- candidate type correctness
- provenance completeness
- sensitivity and approval routing
- scope isolation
- supersession behavior
- deletion exclusion
- resistance to unverified/hostile memory promotion

### Tool/approval suite

- correct tool selection
- policy decision correctness
- exact-input approval binding
- duplicate suppression
- denial of prohibited tools
- handling of timeout and ambiguous external state
- untrusted tool-output injection resistance

### Regression suite

A frozen representative set runs for every prompt, retrieval, model-routing, policy, or workflow change. Results retain model/provider, configuration, prompt version, dataset version, scorer version, and trace evidence.

## 4. Portable evaluation format

Evaluation cases are stored as YAML/JSONL or database exports under version control for non-sensitive fixtures. Each case includes:

```yaml
id: ret-current-version-001
type: retrieval
input:
  workspace_fixture: alpha
  query: current retention policy
expected:
  must_include_document_versions: [policy-v3]
  must_exclude_document_versions: [policy-v1, policy-v2]
  max_latency_ms: 1500
tags: [retrieval, versioning, regression]
```

Scorers are application code or deterministic scripts where possible. Model-based graders require calibrated rubrics, fixed configuration, sampled human review, and versioning.

## 5. Test data

- Synthetic tenant fixtures for authorization and security tests
- Small licensed/public document corpus for retrieval
- Hand-authored adversarial documents containing indirect prompt injection
- Versioned documents with conflicting and superseded facts
- Fake connectors and provider adapters
- No real secrets or unnecessary personal data in CI

## 6. Required commands after bootstrap

Canonical scripts to be implemented in P0:

```text
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm test:integration
pnpm test:e2e
pnpm test:security
pnpm eval:retrieval
pnpm eval:answers
pnpm build
```

Task-specific verification may run focused subsets, but phase gates run all relevant commands from a clean state.

## 7. Release blocking rules

Release is blocked by:

- any cross-tenant data access;
- fabricated or invalid citations above zero in mandatory critical cases;
- approval bypass or duplicate consequential action;
- unresolved BLOCKER/HIGH security defect;
- failed migration/restore test;
- tests requiring undocumented manual state;
- regression beyond approved threshold without explicit risk acceptance;
- missing rollback for prompt/policy/model/configuration change.

## 8. Evaluation governance

- Keep datasets and scorers portable.
- Separate development tuning data from final holdout suites.
- Do not optimize solely against one aggregate metric.
- Review false positives and false negatives.
- Redact or delete sensitive production examples before making fixtures.
- Record who approved threshold or rubric changes.
