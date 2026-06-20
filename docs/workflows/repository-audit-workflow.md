# Repository Audit Workflow

The repository includes a bounded, evidence-driven audit system that produces `AGENT_HANDOFF.md` delivery handoffs. Audits are read-only diagnostics; fixes are applied separately by delivery agents following the handoff's execution plan.

## Components

- **Audit agent:** `.opencode/agents/repo-auditor.md` — performs bounded repository audits, writes only `AGENT_HANDOFF.md`, never implements fixes.
- **Repair agent:** `.opencode/agents/repository-integrity.md` — applies approved fixes from the handoff's execution plan.
- **Git quality agent:** `.opencode/agents/git-quality.md` — mode: `primary`, invoked via `@git-quality` for repository hygiene checks.
- **Audit command:** `.opencode/commands/repo-audit.md` — invokes `repo-auditor` to produce or update `AGENT_HANDOFF.md`.
- **Repair command:** `.opencode/commands/repo-repair.md` — invokes `repository-integrity` for fixes.
- **Audit template:** `templates/repo-audits/opencode-system-audit-template.md` — canonical `AGENT_HANDOFF.md` schema extracted from `repo-auditor.md`.

## Commands

| Command               | Purpose                                                           |
| --------------------- | ----------------------------------------------------------------- |
| `/repo-audit [scope]` | Run a bounded, evidence-driven audit; produce `AGENT_HANDOFF.md`. |
| `/repo-repair`        | Apply approved fixes from `AGENT_HANDOFF.md` execution plan.      |

The audit agent can also be invoked with `@repo-auditor`.

## Recommended first run

```text
/repo-audit full repository audit: inventory, map, validate, investigate findings,
produce AGENT_HANDOFF.md with prioritized execution plan
```

After reviewing the handoff:

```text
/repo-repair execute Phase A from AGENT_HANDOFF.md
```

Repeat per-phase with human review between each phase.

## Audit cycle

```
/repo-audit → AGENT_HANDOFF.md → (human review) → /repo-repair Phase A → review
                                                    → /repo-repair Phase B → review
                                                    → ... → handoff closed
```

New audits can be run at any time. The audit agent treats existing `AGENT_HANDOFF.md` as untrusted prior state: it preserves stable finding IDs only after revalidation, merges duplicates by root cause, and marks stale claims.

## Safety model

- The audit agent (`repo-auditor`) has `edit: deny` everywhere except `AGENT_HANDOFF.md`. It cannot modify source code, configuration, or planning state.
- The repair agent (`repository-integrity`) has `edit: ask` on allowed paths and must request explicit approval for each change.
- Neither agent can deploy, migrate, release, install dependencies, access production resources, or run destructive commands.
- The audit agent validates scripts before requesting approval to run them. It captures `git status --short` before and after each approved validation.
- Sensitive values are never reproduced in audit output. Only file path, secret type, and risk are reported.

## Validation

- The audit agent classifies checks as `Passed`, `Failed`, `Blocked`, `Not Executed`, or `Not Applicable`.
- Blocked checks are documented with the exact command and reason.
- The final handoff includes an execution plan with per-phase validation commands and acceptance criteria.
- Security checks (`pnpm security:secrets`, `pnpm security:dependencies`) are included in the handoff's final verification checklist.

## Finding severity

- `P0`: critical security, active data loss, credential exposure, or repository-wide failure
- `P1`: major broken functionality, build failure, or significant reliability issue
- `P2`: incorrect behavior, important risk or test gap, or meaningful technical debt
- `P3`: minor quality, documentation, maintainability, or cleanup issue

Confidence: `High`, `Medium`, or `Low`.

## Related documentation

- `docs/REPOSITORY_DOCUMENTATION_WORKFLOW.md` — the documentation maintenance workflow (audit is the parallel audit-maintenance workflow)
- `docs/05_SECURITY_GOVERNANCE.md` — security governance and trust boundaries
- `docs/security/threat-model.md` — threat model (TB-1–TB-7)
- `docs/adr/0008-opencode-config-consolidation.md` — `opencode.jsonc` consolidation decision (audit-relevant)
