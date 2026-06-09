# Security Review Checklist

For every task categorized as security-sensitive, the reviewing security
engineer must confirm each applicable item before completion. See
`docs/05_SECURITY_GOVERNANCE.md#11` for the governing policy.

Tasks affecting **auth, tenancy, uploads, retrieval, memory, tools,
approvals, connectors, or secrets** are security-sensitive and require
this review.

---

## 1. Threat review

- [ ] Relevant threats from `docs/security/threat-model.md` have been considered.
- [ ] New trust boundaries or threat surfaces have been added to the threat model.

## 2. Authorization

- [ ] Negative authorization tests prove denial for unauthorized actors.
- [ ] Object-level authorization is tested for every endpoint/operation (read and write).
- [ ] Cross-workspace access is denied (tenant isolation tests).
- [ ] Cross-project access is denied where restricted.
- [ ] Deny-by-default for unknown roles and actions.
- [ ] Error responses do not disclose object existence for unauthorized calls.

## 3. Input validation and schema

- [ ] Input schemas validate at the boundary (API/message/job ingress).
- [ ] Output schemas validate before delivery (API/message/job egress).
- [ ] Malformed, oversized, and unexpected inputs are rejected with safe errors.
- [ ] File uploads are bounded (size, type, archive limits).
- [ ] Path traversal and key injection are tested.

## 4. Abuse and injection

- [ ] Prompt injection fixtures are included in evaluation suites.
- [ ] Retrieved content is delimited and treated as untrusted data.
- [ ] No external content can alter policy, tools, or approval requirements.
- [ ] Tool execution reauthorizes independently of model output.
- [ ] SSRF protections are tested for any new outbound connectivity.

## 5. Secret and dependency scanning

- [ ] `pnpm security:secrets` passes (no secret patterns detected).
- [ ] `pnpm security:dependencies` reports no critical/high vulnerabilities.
- [ ] New dependencies have been reviewed for supply-chain risk.

## 6. Logging and redaction

- [ ] Structured logs redact configured sensitive fields.
- [ ] Secrets and raw credentials are absent from log output.
- [ ] Audit events are captured for relevant security events.
- [ ] Error messages name missing keys but never print secret values.

## 7. Configuration and deployment

- [ ] No secrets are committed to the repository.
- [ ] `.env.example` contains only placeholder references.
- [ ] Production defaults cannot be silently used in lower environments.
- [ ] Feature flags exist for any behavioral changes.

## 8. Reviewer evidence

- [ ] Independent reviewer has confirmed all of the above.
- [ ] Review evidence is recorded in the task run record.
- [ ] Any accepted residual risks are documented with rationale.

---

## Task categories requiring security review

Per `docs/05_SECURITY_GOVERNANCE.md#11`, the following task categories
trigger this checklist:

| Category            | Example tasks                  |
| ------------------- | ------------------------------ |
| Auth / identity     | P1-T02, P1-T03                 |
| Tenancy / workspace | P1-T01, P1-T03, P1-T07         |
| Uploads / ingestion | P1-T05, P2-T01, P2-T02, P2-T03 |
| Retrieval           | P2-T07, P2-T08                 |
| Memory              | P4-\*                          |
| Tools / connectors  | P5-\*                          |
| Approvals           | P5-\*                          |
| Secrets / config    | P0-T02, P0-T06                 |
