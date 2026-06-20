# opencode System Registry

**Generated:** 2026-06-20
**Counts:** 25 agents, 28 commands, 12 skills

> This registry enumerates every agent, command, and skill in the opencode system layer. Maintained alongside the source files; CI verifies counts match actual file counts.

## Agents (25)

| Agent                                 | Mode        | Hidden | Edit | Bash | Task  | Skill | Description                                                     |
| ------------------------------------- | ----------- | ------ | ---- | ---- | ----- | ----- | --------------------------------------------------------------- |
| `accessibility-performance-validator` | subagent    | yes    | deny | ask  | deny  | allow | Validates accessibility, performance, viewport, motion, density |
| `architect`                           | subagent    | —      | deny | ask  | deny  | deny  | Produces dependency-aware plans without editing                 |
| `backend-integration-engineer`        | subagent    | yes    | ask  | ask  | deny  | allow | Implements approved backend/API/integration changes             |
| `data-modeler`                        | subagent    | —      | deny | ask  | deny  | ask   | Reviews PostgreSQL schemas and migration plans                  |
| `delivery`                            | **primary** | —      | ask  | ask  | deny  | ask   | Implements one backlog task under task-execution contract       |
| `design-system-architect`             | subagent    | yes    | deny | ask  | deny  | allow | Defines approved visual system as tokens and contracts          |
| `evidence-regression-controller`      | subagent    | yes    | deny | ask  | deny  | allow | Controls feature parity, evidence, PR traceability              |
| `feature-advocate`                    | subagent    | yes    | deny | deny | deny  | —     | Identifies strengths and opportunities in features              |
| `feature-critic`                      | subagent    | yes    | deny | deny | deny  | —     | Identifies flaws, risks, edge cases in features                 |
| `feature-judge`                       | subagent    | yes    | deny | deny | deny  | —     | Synthesizes critic/advocate reports; final recommendation       |
| `frontend-implementer`                | subagent    | yes    | ask  | ask  | deny  | allow | Implements approved frontend portions of contracts              |
| `git-quality`                         | **primary** | —      | ask  | ask  | deny  | deny  | Runs quality checks; prepares reviewable Git actions            |
| `iphone-interaction-specialist`       | subagent    | yes    | deny | ask  | deny  | allow | iPhone safe-area, viewport, touch, PWA specialist               |
| `mobile-ui-orchestrator`              | **primary** | —      | ask  | ask  | allow | allow | Orchestrates iPhone 16 Pro-first web UI redesign                |
| `product-ux-analyst`                  | subagent    | yes    | deny | ask  | deny  | allow | Determines users, outcomes, flows from real evidence            |
| `qa`                                  | subagent    | —      | deny | ask  | deny  | deny  | Verifies phase exit gates; persists gate evidence               |
| `real-ui-product-tester`              | subagent    | yes    | deny | ask  | deny  | allow | Tests real running product; physical iPhone evidence            |
| `repo-auditor`                        | subagent    | —      | deny | ask  | deny  | deny  | Performs repository audits; writes AGENT_HANDOFF.md             |
| `repository-discovery`                | subagent    | yes    | deny | ask  | deny  | allow | Detects repo architecture, commands, runtime, data sources      |
| `repository-docs`                     | **all**     | —      | deny | ask  | deny  | ask   | Audits and maintains documentation from verified evidence       |
| `repository-integrity`                | **primary** | —      | ask  | ask  | deny  | ask   | Applies approved repair batches; validates state                |
| `reviewer`                            | subagent    | —      | deny | ask  | deny  | deny  | Verifies implemented tasks; finalizes task status               |
| `security`                            | subagent    | —      | deny | ask  | deny  | deny  | Read-only security review with machine-readable verdict         |
| `visual-concept-prototyper`           | subagent    | yes    | deny | ask  | deny  | allow | Creates isolated visual concepts; never modifies production     |
| `workflow-improvement-reviewer`       | subagent    | yes    | deny | ask  | deny  | allow | Reviews completed evidence; proposes adapter improvements       |

### Agent categories

| Category                                                | Agents                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Planning ledger (status-authoritative)                  | `qa`, `reviewer`                                                                                                                                                                                                                                                                                                                                                                   |
| Implementation (primary + specialists)                  | `delivery`, `frontend-implementer`, `backend-integration-engineer`                                                                                                                                                                                                                                                                                                                 |
| Repository hygiene                                      | `git-quality`, `repository-integrity`, `repo-auditor`                                                                                                                                                                                                                                                                                                                              |
| Documentation                                           | `repository-docs`                                                                                                                                                                                                                                                                                                                                                                  |
| Mobile UI orchestration (13 specialists + orchestrator) | `mobile-ui-orchestrator`, `accessibility-performance-validator`, `design-system-architect`, `evidence-regression-controller`, `frontend-implementer`, `iphone-interaction-specialist`, `product-ux-analyst`, `real-ui-product-tester`, `repository-discovery`, `visual-concept-prototyper`, `workflow-improvement-reviewer`, `feature-advocate`, `feature-critic`, `feature-judge` |
| Security/architecture (read-only)                       | `architect`, `data-modeler`, `security`                                                                                                                                                                                                                                                                                                                                            |

## Commands (28)

| Command                       | Agent                    | Description                                        |
| ----------------------------- | ------------------------ | -------------------------------------------------- |
| `/docs-audit`                 | `repository-docs`        | Read-only evidence-backed documentation audit      |
| `/docs-changed`               | `repository-docs`        | Diff-aware documentation maintenance               |
| `/docs-release`               | `repository-docs`        | Maintain Unreleased changelog or draft notes       |
| `/docs-update`                | `repository-docs`        | Audit, apply low-risk docs edits, validate, report |
| `/docs-verify`                | `repository-docs`        | Read-only factual/structural verification          |
| `/mobile-ui-approve`          | `mobile-ui-orchestrator` | Approve a single decision packet                   |
| `/mobile-ui-approve-batch`    | `mobile-ui-orchestrator` | Batch-approve up to 5 decision packets             |
| `/mobile-ui-audit`            | `mobile-ui-orchestrator` | Audit current repository for redesign baseline     |
| `/mobile-ui-concepts`         | `mobile-ui-orchestrator` | Generate design concepts from product model        |
| `/mobile-ui-critique`         | `mobile-ui-orchestrator` | Run 3-agent Feature Critique Panel                 |
| `/mobile-ui-design-contract`  | `mobile-ui-orchestrator` | Produce machine-readable design contract           |
| `/mobile-ui-device-test`      | `mobile-ui-orchestrator` | Run device validation against physical iPhone      |
| `/mobile-ui-handoff`          | `mobile-ui-orchestrator` | Produce final handoff and evidence bundle          |
| `/mobile-ui-implement`        | `mobile-ui-orchestrator` | Execute implementation contract                    |
| `/mobile-ui-improve-workflow` | `mobile-ui-orchestrator` | Review and propose workflow improvements           |
| `/mobile-ui-start`            | `mobile-ui-orchestrator` | Initialize mobile UI redesign workflow             |
| `/mobile-ui-status`           | `mobile-ui-orchestrator` | Report redesign workflow status                    |
| `/mobile-ui-validate`         | `mobile-ui-orchestrator` | Validate against design contract                   |
| `/phase-gate`                 | `qa`                     | Verify one phase exit gate                         |
| `/phase-plan`                 | `architect`              | Produce phase-level implementation plan            |
| `/project-analyze`            | `architect`              | Analyze project structure and dependencies         |
| `/project-status`             | `architect`              | Report project-wide status                         |
| `/quality-check`              | `git-quality`            | Run bounded repository quality checks              |
| `/repo-audit`                 | `repo-auditor`           | Run repository audit; produce AGENT_HANDOFF.md     |
| `/repo-repair`                | `repository-integrity`   | Apply approved fixes from handoff                  |
| `/security-review`            | `security`               | Focused security and privacy review                |
| `/task-review`                | `reviewer`               | Verify one implemented backlog task                |
| `/task-run`                   | `delivery`               | Execute one backlog task                           |

## Skills (12)

| Skill                        | Description                                                                                     |
| ---------------------------- | ----------------------------------------------------------------------------------------------- |
| `approval-gated-redesign`    | Enforce decision packets, explicit approvals, contract boundaries, decision-ledger traceability |
| `database-migration`         | Design and verify PostgreSQL migrations with tenant isolation and forward compatibility         |
| `design-contract`            | Convert approved concepts into human-readable and machine-readable design system                |
| `evidence-bundle`            | Build redacted, traceable evidence package from baseline through delivery                       |
| `iphone-16-pro-pwa`          | iPhone 16 Pro portrait-first, network-required PWA design and validation                        |
| `real-ui-validation`         | Validate real running application without mock-only evidence                                    |
| `repository-adapter`         | Detect and document repository architecture, commands, runtime, and protected areas             |
| `repository-docs-analysis`   | Map repository evidence, detect stale documentation, identify contradictions                    |
| `repository-docs-update`     | Apply evidence-backed documentation edits with approval gates                                   |
| `repository-docs-validation` | Validate documentation structure, links, commands, factual claims, and secrets                  |
| `retrieval-quality`          | Implement hybrid retrieval, ACL filtering, version-aware citations, and ranking                 |
| `task-execution`             | Execute one machine-readable backlog task with dependency and validation controls               |

## CI Assertions

The following CI checks verify registry accuracy:

- `bash scripts/ci/check-registry-counts.sh` — verifies agent/command/skill counts match actual files and README claims
- `bash scripts/ci/check-agent-permissions.sh` — verifies secret-path deny patterns are consistent across all agents

Both are wired into `scripts/ci/check-all.sh`.

## Notes

### Bash deny-list asymmetry (AUD-P3-001)

`repo-auditor` has a significantly more exhaustive bash deny list (~95 denials, including all package managers, cloud CLIs, and network tools) than `delivery` (~48 denials) and `repository-integrity` (~46 denials). This is **intentional**: `repo-auditor` is a read-only audit agent that must never install dependencies or touch external services. `delivery` and `repository-integrity` may need to install dependencies or interact with services under the `bash: '*': ask` catch-all with explicit user approval. Both patterns provide defense-in-depth appropriate to each agent's role.
