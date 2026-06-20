# Repository Audit Agent Handoff

> **Template ID:** `opencode-system-audit-template`
> **Source:** extracted from `.opencode/agents/repo-auditor.md` §Required AGENT_HANDOFF.md (canonical schema version)
> **Purpose:** This is the canonical output schema for `repo-auditor` audits. Use this template for new audit handoffs.

---

**Handoff ID:** `AUD-<SYSTEM>-<YYYY-MM-DD>`
**Source audit:** (path or link to audit report if separate)
**Target:** Implement the prioritized execution plan from the audit.

## Audit Summary

Purpose and stack; architecture; branch and commit; pre-existing changes; inspected/uninspected areas; commands executed; overall health; severity counts; limitations.

## Repository Map

Applications, services, packages, libraries, entry points, tests, build/CI configuration, deployment configuration, and excluded/generated areas.

## Validation Results

Table: `Check | Command | Result | Evidence`

Allowed results: `Passed`, `Failed`, `Blocked`, `Not Executed`, `Not Applicable`.

## Findings Summary

Table: `ID | Severity | Confidence | Finding | Location | Status`

### Resolved Findings

(Findings carried forward from prior audits that are now resolved, with evidence.)

## Detailed Findings

For every material finding include:

- **Severity:** P0/P1/P2/P3 | **Confidence:** High/Medium/Low | **Status:** Open/Resolved/Deferred
- **Affected paths:** exact file paths and line numbers
- **Observed:** what was found (specific, reproducible)
- **Expected:** what should have been found
- **Impact:** real-world consequence of the finding
- **Root cause:** verified or explicitly stated as inferred
- **Remediation:** smallest safe change to resolve the finding
- **Required tests:** tests that must pass to verify the fix
- **Acceptance criteria:** observable conditions that confirm the finding is closed

## Suspected Issues and Risks

Separate suspected issues (require validation), maintainability/security risks, and optional improvements. Include evidence, missing validation, impact, and exact next action.

## Execution Plan

Order phases by P0/P1, shared root causes, dependency order, then P2/P3. Keep unrelated changes separate.

For each phase include:

- **Objective:** what this phase achieves
- **Finding IDs:** which findings this phase addresses
- **Expected paths:** files that will be created or modified
- **Tasks:** checkbox task list
- **Validation:** exact commands to run after implementation
- **Acceptance criteria:** checkbox acceptance criteria
- **Rollback:** how to undo this phase
- **Approval required:** whether explicit approval is needed and for what

## Final Verification Checklist

Include exact applicable commands for dependency checks, formatting, linting, static analysis, type checking, build, unit/integration tests, security, documentation, CI-equivalent checks, Git status, unintended changes, and secret exposure.

## Deferred, Blocked, and Rejected Findings

For each item include ID, decision, reason, risk, prerequisite, and recommended next action.

## Open Questions and Limitations

State every material coverage, environment, dependency, service, credential, context, and validation limitation.

## Implementation Agent Starting Point

State the first phase, first paths, first validation command, blockers, repository-state considerations, and changes that must remain separate.

---

## Completion checks

Before finishing a handoff, verify that:

- only `AGENT_HANDOFF.md` was intentionally edited;
- actual Git changes are reported accurately;
- findings are evidenced, unique, and deduplicated;
- suspected issues are not presented as confirmed;
- failed and blocked checks are documented;
- each phase has validation commands and acceptance criteria;
- limitations are explicit;
- no sensitive value is exposed;
- no execution-plan item was implemented.

Final response must contain only:

1. **Handoff file:** exact path
2. **Findings:** P0/P1/P2/P3 counts
3. **Failed validations:** commands or `None`
4. **Blocked validations:** commands and concise reasons or `None`
5. **Highest-priority phase:** phase number and title
6. **Material limitations:** concise summary
7. **Repository changes:** all changed paths, explicitly noting whether only `AGENT_HANDOFF.md` changed
