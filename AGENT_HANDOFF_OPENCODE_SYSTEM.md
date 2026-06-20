# Repository Audit Agent Handoff — opencode System

**Handoff ID:** `AUD-OPENSYS-2026-06-20`
**Source audit:** `opencode-system-audit-2026-06-20.md` (already produced; this handoff is the delivery bridge from audit findings to implementation)
**Target:** Implement the prioritized execution plan from the opencode system audit.

## Audit Summary

- **Date:** 2026-06-20
- **Repository:** `personal-intelligence-agent-blueprint` (root `/home/calvin/personal-intelligence-agent-blueprint`)
- **Branch:** `main` @ `7b19197` — clean worktree (only untracked file: `opencode-system-audit-2026-06-20.md`)
- **Scope:** The opencode *operating system* layer — `.opencode/` (25 agents, 27 commands, 12 skills), `AGENTS.md`, `docs/`, `scripts/`, `templates/` — not the PIA product source (`apps/`, `packages/`, `db/`, `infra/`, `planning/`).
- **Source artifact:** `calvin-opencode-system-context-pack.md` (generated `2026-06-20T08:18:48Z`, not tracked in repo)
- **Overall health:** Mature, unusually disciplined opencode configuration — 25 agents, 27 commands, 12 skills all internally consistent with README claims. Permission model is the strongest part. One P0 finding (live session cookie and PID captured in context pack) drives three root-cause gaps.
- **Findings:** 3 P0, 2 P1, 6 P2, 4 P3 (see Findings Summary below)
- **Inspected:** All `.opencode/agents/*.md`, all `.opencode/commands/*.md`, all `.opencode/skills/**`, `AGENTS.md`, `README.md`, `docs/05_SECURITY_GOVERNANCE.md`, `docs/security/threat-model.md`, `docs/security/review-checklist.md`, `docs/adr/0007-*.md`, `docs/adr/0008-*.md`, `docs/REPOSITORY_DOCUMENTATION_WORKFLOW.md`, all scripts under `scripts/ci/`, `scripts/security/`, `scripts/dev/`, `scripts/git-hooks/`, and `templates/**/*.md`.
- **Not inspected:** `opencode.jsonc` content (excluded from context pack; only ADR-0008's description available), `.chatgpt-context-pack/` (excluded, untracked), the context-pack generator tool itself (not in repo). Individual agent/command/skill file contents beyond what was included in the context pack.
- **Commands executed:** None in this audit (the audit was a static analysis of the context pack, not a runtime validation). All validation commands are specified for the implementation phases below.
- **Limitations:** `opencode.jsonc` not directly inspected — its resolved state is assumed per ADR-0008 but unverified. Physical device (iPhone 16 Pro) availability not relevant to this opencode-system audit. No runtime checks were executed against the live repository; static analysis only.

## Repository Map — opencode System Layer

### Agents (25 — all confirmed present in `.opencode/agents/`)

| Category | Agents | Mode | Permission tier |
|---|---|---|---|
| Planning ledger (status-authoritative) | `qa`, `reviewer` | `subagent` | `planning/status.yaml: allow` edit; hash-checkpointed status writes |
| Implementation | `delivery` (primary), `frontend-implementer`, `backend-integration-engineer` | mixed | `edit: ask`; `task: deny` (no further delegation) |
| Repository hygiene | `git-quality` (primary), `repository-integrity`, `repo-auditor` | mixed | bash-heavy with explicit deny-lists |
| Documentation | `repository-docs` (`mode: all`) | all | only agent invocable directly, as subtask, or via 5 dedicated commands |
| Mobile UI orchestration | `mobile-ui-orchestrator` (primary) + 13 `hidden: true` specialists | mixed | orchestrator alone can `task:` into specialists |
| Feature Critique Panel | `feature-advocate`, `feature-critic`, `feature-judge` | `hidden: true` | `bash: deny` entirely (pure analysis) |
| Security/architecture (read-only) | `architect`, `data-modeler`, `security` | subagent | `edit: deny` outright |

### Commands (27 — all confirmed present in `.opencode/commands/`)

- **5 documentation commands** (`docs-audit/changed/release/update/verify`) → `repository-docs`
- **13 mobile-UI commands** (`mobile-ui-*`) → `mobile-ui-orchestrator`
- **9 governance/delivery commands** (`phase-gate`, `phase-plan`, `project-analyze`, `project-status`, `repo-audit`, `repo-repair`, `security-review`, `task-review`, `task-run`)

### Skills (12 — all confirmed present in `.opencode/skills/`)

| Skill | Loaded by |
|---|---|
| `approval-gated-redesign` | mobile-UI agents (implied) |
| `database-migration` | `delivery`, `data-modeler`, `repository-integrity`, `task-execution` |
| `design-contract` | `design-system-architect` |
| `evidence-bundle` | `evidence-regression-controller` |
| `iphone-16-pro-pwa` | iPhone specialists |
| `real-ui-validation` | testing specialists |
| `repository-adapter` | `repository-discovery` |
| `repository-docs-analysis/-update/-validation` | `repository-docs` only |
| `retrieval-quality` | `delivery` |
| `task-execution` | `delivery` |

### Scripts (security-critical paths)

| Path | Purpose |
|---|---|
| `scripts/security/check-secrets.sh` | Secret pattern scan with `EXCLUDE_DIRS` including `.opencode` (blanket) |
| `scripts/security/check-dependencies.sh` | `pnpm audit --prod` only (dev deps excluded) |
| `scripts/ci/check-all.sh` | Local CI simulation |
| `scripts/ci/validate-status.ts` | Governance validation |
| `scripts/git-hooks/pre-push` | Pre-push hook: format → lint → secrets → typecheck |

### Documentation

| Path | Purpose |
|---|---|
| `AGENTS.md` | Agent contract and engineering rules |
| `AGENT_HANDOFF.md` | Prior product audit handoff (2026-06-13, `efab8b7`) |
| `README.md` | 40KB repo README with agent/command counts |
| `docs/05_SECURITY_GOVERNANCE.md` | 7 trust boundaries, 10 threat scenarios, approval matrix |
| `docs/security/threat-model.md` | TB-1–TB-7, residual risk documentation |
| `docs/security/review-checklist.md` | Task-category → checklist mapping |
| `docs/adr/0007-path-boundary-precedent.md` | Formalized path-boundary precedents |
| `docs/adr/0008-opencode-config-consolidation.md` | `opencode.json`/`opencode.jsonc` dual-config resolution |
| `docs/REPOSITORY_DOCUMENTATION_WORKFLOW.md` | Documentation workflow (no equivalent for audit workflow) |
| `templates/` | 8 files — all mobile-UI-redesign-specific; no generic audit template |
| `.opencode/benchmarks/repository-docs/` | 16-case, 100-point-rubric regression benchmark |

### Excluded/Generated Areas

- `node_modules/`, `.turbo/`, `dist/`, `.next/`, `coverage/`, `ci-output/`, `test-results/`, `benchmark_out/`
- `.venv/`, `__pycache__/`
- `.git/`, `.opencode/run-logs/` (gitignored — contains `cookies.txt`, `api.pid`)
- `.opencode/package.json`, `.opencode/package-lock.json` (gitignored by `.opencode/.gitignore`)

## Validation Results

No runtime validation commands were executed in this audit. The audit was a static analysis of a context pack. Validation commands for each implementation phase are specified below in the Execution Plan.

| Check | Command | Result | Evidence |
|---|---|---|---|
| Agent count (25 claimed) | Direct count of `.opencode/agents/` entries in context pack | **Passed** | 25 files confirmed |
| Command count (27 claimed) | Direct count of `.opencode/commands/` entries in context pack | **Passed** | 27 files confirmed |
| Skill count (12 claimed) | Direct count of `.opencode/skills/` entries in context pack | **Passed** | 12 skills confirmed |
| Agent↔command referential integrity | Cross-reference every command's `agent:` value against agent filenames | **Passed** | All 27 commands target existing agents |
| Permission consistency (secret paths) | Cross-check deny lists across 7 agents | **Passed** | `*.env`/`*.pem`/`*.key`/`*credentials*`/`.git/**` consistent across all |
| Secret scan coverage gap | Inspect `check-secrets.sh` `EXCLUDE_DIRS` | **Failed** | `.opencode` blanket-excluded; `.opencode/run-logs/` unscanned (AUD-P0-002) |
| Context-pack gitignore respect | Check whether gitignored files appear in context pack | **Failed** | `.opencode/run-logs/cookies.txt`, `.opencode/run-logs/api.pid`, `.opencode/package.json`, `.opencode/package-lock.json` all gitignored yet present in context pack (AUD-P0-003) |
| `opencode.jsonc` smoke test | ADR-0008 10-point smoke test | **Not Executed** | `opencode.jsonc` excluded from context pack; smoke test script not found |
| Dev-dependency scanning | `check-dependencies.sh` coverage | **Confirmed gap** | Only `pnpm audit --prod`; dev deps unscanned |

## Findings Summary

| ID | Severity | Confidence | Finding | Location | Status |
|---|---|---|---|---|---|
| AUD-P0-001 | P0 | High | Live session cookie and PID captured in this context pack | `.opencode/run-logs/cookies.txt`, `.opencode/run-logs/api.pid` | **Open** |
| AUD-P0-002 | P0 | High | Secret scanner blanket-excludes `.opencode/` — root cause of AUD-P0-001's scanner-side gap | `scripts/security/check-secrets.sh` `EXCLUDE_DIRS` | **Open** |
| AUD-P0-003 | P0 | Medium | Context-pack generator does not respect `.gitignore` — root cause of AUD-P0-001's generator-side gap | Unknown context-pack generator (not in repo) | **Open** |
| AUD-P1-001 | P1 | High | ADR-0008 required smoke test not implemented | `scripts/` (expected but not found) | **Open** |
| AUD-P1-002 | P1 | Medium | Dev-dependency supply-chain risk unscanned | `scripts/security/check-dependencies.sh` | **Open** |
| AUD-P2-001 | P2 | High | `git-quality` agent has no associated slash command | `.opencode/agents/git-quality.md`, `.opencode/commands/` | **Open** |
| AUD-P2-002 | P2 | High | Two parallel context-pack generators exist and diverge | `.chatgpt-context-pack/`, unknown single-file generator (both untracked) | **Open** |
| AUD-P2-003 | P2 | Medium | No equivalent `docs/workflows/repository-audit-workflow.md` for audit workflow | `docs/` | **Open** |
| AUD-P2-004 | P2 | Medium | No generic `templates/repo-audits/opencode-system-audit-template.md` — audit schema inlined in `repo-auditor.md` | `templates/` (all 8 are mobile-UI-specific) | **Open** |
| AUD-P2-005 | P2 | Medium | No top-level system registry/index for agents/commands/skills | Root manifests | **Open** |
| AUD-P2-006 | P2 | Medium | Permission-block duplication across 7 agent files — no regression test | `.opencode/agents/{delivery,git-quality,qa,reviewer,repository-integrity,repository-docs,security}.md` | **Open** |
| AUD-P3-001 | P3 | Low | `repo-auditor` bash deny-list more exhaustive than higher-privilege agents' lists | `.opencode/agents/repo-auditor.md` vs `delivery.md`, `repository-integrity.md` | **Open** |
| AUD-P3-002 | P3 | Low | `approval-gated-redesign` skill not explicitly allowlisted in any agent frontmatter | `.opencode/agents/` (may be implicitly loaded by `mobile-ui-orchestrator`) | **Open** |
| AUD-P3-003 | P3 | Low | No `opencode.jsonc` content available to verify ADR-0008 claims | `opencode.jsonc` (excluded from context pack) | **Open** |
| AUD-P3-004 | P3 | Low | `templates/` is 100% mobile-UI-redesign-specific; no reusable templates for audit/run-record/review workflows | `templates/` | **Open** |

### Resolved Findings

None — this is the first opencode-system audit.

## Detailed Findings

### AUD-P0-001 — Live session cookie and PID captured in context pack

- **Severity:** P0 | **Confidence:** High | **Status:** Open
- **Affected paths:** `.opencode/run-logs/cookies.txt`, `.opencode/run-logs/api.pid`
- **Observed:** Netscape-format cookie file with `pia_session` JWT (issuer `http://localhost:8080/realms/pia`, subject `dev-user-1`, audience `pia-api`) and raw process ID were included in the context pack's file contents, despite both files being gitignored (`.gitignore` line: `# opencode local run logs (may contain session cookies in cookies.txt)` above `/.opencode/run-logs/`).
- **Expected:** Gitignored files should never appear in exported context packs handed to third-party LLMs.
- **Impact:** Active session cookie left the machine in a document sent to an external LLM. Blast radius low if realm is truly localhost-only, but the structural gap is critical.
- **Root cause:** Two independent gaps combine: (1) context-pack generator walks filesystem directly, not via `git ls-files` (AUD-P0-003); (2) secret scanner excludes entire `.opencode/` directory (AUD-P0-002), so even if the file were committed it would never be caught.
- **Remediation:** (1) Delete `.opencode/run-logs/*` from disk now. (2) If Keycloak realm could ever run non-localhost, rotate dev signing secret. (3) Fix AUD-P0-002 and AUD-P0-003 to prevent recurrence.
- **Required tests:** Verify `.opencode/run-logs/` is empty; verify context-pack generator filters gitignored files.
- **Acceptance criteria:** `.opencode/run-logs/` directory is empty or absent; no future context pack includes gitignored files; `check-secrets.sh` would detect a cookie file under `.opencode/run-logs/`.

### AUD-P0-002 — Secret scanner blanket-excludes `.opencode/`

- **Severity:** P0 | **Confidence:** High | **Status:** Open
- **Affected paths:** `scripts/security/check-secrets.sh` — `EXCLUDE_DIRS` array
- **Observed:** Line: `EXCLUDE_DIRS=( ".git" "node_modules" ".turbo" "dist" ".next" "coverage" ".opencode" ".venv" ... )`. The scanner's JWT regex (`eyJ[a-zA-Z0-9_\-]+\.[a-zA-Z0-9_\-]+\.[a-zA-Z0-9_\-]+`) would catch cookies in `.opencode/run-logs/` but the directory is fully excluded.
- **Expected:** Only source-controlled config paths (`.opencode/agents`, `.opencode/commands`, `.opencode/skills`, `.opencode/documentation`, `.opencode/benchmarks`) should be excluded; `.opencode/run-logs/` should be scannable.
- **Impact:** The one subdirectory most likely to contain real secrets (gitignored run-logs with session cookies) is completely invisible to the secret scanner.
- **Root cause:** Intent was to avoid false positives from agent/command files full of the words "secret," "token," "credential" by design, but the exclusion was applied directory-wide rather than targeted.
- **Remediation:** Replace blanket `.opencode` exclude with targeted subpath excludes: `EXCLUDE_DIRS+=( ".opencode/agents" ".opencode/commands" ".opencode/skills" ".opencode/documentation" ".opencode/benchmarks" )`. Also add a pre-export hook that purges `.opencode/run-logs/*` before any context-pack/audit/export action.
- **Required tests:** Run `check-secrets.sh` against a test environment with a known JWT in `.opencode/run-logs/`; verify it's detected. Run against source-controlled `.opencode/agents/` files; verify no false positives.
- **Acceptance criteria:** `EXCLUDE_DIRS` no longer contains bare `.opencode`; `.opencode/run-logs/` is scannable; scanner still passes clean on all source-controlled config.

### AUD-P0-003 — Context-pack generator does not respect `.gitignore`

- **Severity:** P0 | **Confidence:** Medium (inferred from AUD-P0-001; generator source not inspected) | **Status:** Open
- **Affected paths:** Unknown context-pack generator (produces `calvin-opencode-system-context-pack.md`); also `.chatgpt-context-pack/` generator.
- **Observed:** Four gitignored files appeared in the context pack: `.opencode/run-logs/cookies.txt`, `.opencode/run-logs/api.pid`, `.opencode/package.json`, `.opencode/package-lock.json`. A generator respecting `.gitignore` (or `.opencode/.gitignore`) would have skipped all four.
- **Expected:** Context-pack generator should filter candidates through `git check-ignore` or build from `git ls-files` plus an explicit allowlist.
- **Impact:** This is the highest-leverage fix — it would have prevented AUD-P0-001 regardless of the scanner gap.
- **Root cause:** Generator tool walks live filesystem directly rather than using `git ls-files --others --exclude-standard` or equivalent.
- **Remediation:** Make the generator `git ls-files`-based; add an explicit, audited allowlist for intentionally-untracked-but-wanted files (e.g., `.env.example`). Consolidate two parallel generators into one canonical, source-controlled script.
- **Required tests:** Generate a context pack and verify no gitignored files appear in output.
- **Acceptance criteria:** Context pack contains zero files listed in `.gitignore` or `.opencode/.gitignore`; only one canonical generator script exists, source-controlled under `scripts/`.

### AUD-P1-001 — ADR-0008 smoke test not implemented

- **Severity:** P1 | **Confidence:** High | **Status:** Open
- **Affected paths:** `scripts/` (expected: `scripts/security/check-opencode-config.sh` or equivalent)
- **Observed:** ADR-0008 (dated 2026-06-17, Accepted) specifies a 10-point "effective-configuration smoke test" as part of the decision, not as future work. No script implementing this test was found among `scripts/ci/`, `scripts/dev/`, `scripts/security/`, or `scripts/git-hooks/`.
- **Expected:** A script exists that verifies: exactly one config file, pinned version, resolved default agent, sharing disabled, etc.
- **Impact:** The `opencode.jsonc` consolidation state is unverified. ADR-0008 claims certain behaviors but they cannot be confirmed without the smoke test.
- **Remediation:** Create `scripts/security/check-opencode-config.sh` implementing ADR-0008's 10-point smoke test; wire into CI and pre-push hook.
- **Required tests:** Run the smoke test; verify all 10 points pass against current `opencode.jsonc`.
- **Acceptance criteria:** `scripts/security/check-opencode-config.sh` exists; run in CI and pre-push; all ADR-0008 points verified; integrated into `check-all.sh`.

### AUD-P1-002 — Dev-dependency supply-chain risk unscanned

- **Severity:** P1 | **Confidence:** Medium | **Status:** Open
- **Affected paths:** `scripts/security/check-dependencies.sh`
- **Observed:** Runs `pnpm audit --prod` only; dev dependencies explicitly excluded ("because they do not ship to production").
- **Expected:** Either dev dependencies are also scanned, or there is a documented, deliberate accept-the-risk note explaining the policy.
- **Impact:** Compromised build/lint/test packages (increasingly common attack vector) would not be detected.
- **Remediation:** Either (a) add `pnpm audit` (without `--prod`) as a separate CI check with a distinct pass/fail threshold, or (b) document the policy as a deliberate accept-the-risk decision in a security ADR.
- **Required tests:** `pnpm audit` runs and reports known vulnerabilities; policy documented.
- **Acceptance criteria:** Dev-dependency vulnerabilities are either scanned or documented as accepted risk.

### AUD-P2-001 — `git-quality` agent has no slash command

- **Severity:** P2 | **Confidence:** High | **Status:** Open
- **Affected paths:** `.opencode/agents/git-quality.md` (mode: `primary`), `.opencode/commands/` (27 commands, none targeting `git-quality`)
- **Observed:** `git-quality` is the only `mode: primary` agent besides `delivery`, `mobile-ui-orchestrator`, and `repository-integrity` without a dedicated slash command. Every other primary/all-mode agent has at least one command.
- **Expected:** Either a `/quality-check` command exists, or the agent's command-less status is documented as intentional.
- **Impact:** Agent is only invocable via `@git-quality` mention, not via slash command — inconsistent with other primary agents.
- **Remediation:** Add a `/quality-check` (or similarly named) command wired to `git-quality`, OR document in the agent file that it is intentionally command-less.
- **Required tests:** New command appears in `.opencode/commands/`; `agent:` value matches `git-quality`.
- **Acceptance criteria:** `git-quality` agent is either command-wired or documented as intentionally command-less.

### AUD-P2-002 — Two parallel context-pack generators diverge

- **Severity:** P2 | **Confidence:** High | **Status:** Open
- **Affected paths:** `.chatgpt-context-pack/` (structured, multi-file, chunked), unknown single-file generator (produced `calvin-opencode-system-context-pack.md`)
- **Observed:** Two separate generators exist, both untracked/gitignored, with no guarantee they apply the same exclusion logic — this is exactly how AUD-P0-001 happened.
- **Expected:** One canonical, source-controlled generator script under `scripts/` with `git ls-files`-based filtering. If multiple output formats are needed, use a `--format` flag.
- **Impact:** Divergence risk; exclusion bugs in one generator not caught by the other.
- **Remediation:** Pick one canonical generator, make it source-controlled and `git ls-files`-based, delete the other. Use `--format` flag for different output shapes.
- **Required tests:** Single generator produces correct output; no gitignored files appear; both formats (if needed) work.
- **Acceptance criteria:** Only one context-pack generator exists; source-controlled under `scripts/`; `git ls-files`-based filtering.

### AUD-P2-003 — No `docs/workflows/repository-audit-workflow.md`

- **Severity:** P2 | **Confidence:** Medium | **Status:** Open
- **Affected paths:** `docs/` (expected but not present)
- **Observed:** `docs/REPOSITORY_DOCUMENTATION_WORKFLOW.md` documents the documentation workflow thoroughly. No equivalent exists for the `repo-auditor` → `AGENT_HANDOFF.md` → (review) → `repo-repair` → `repository-integrity` cycle.
- **Expected:** Mirror the documentation workflow doc for the audit workflow.
- **Impact:** The audit workflow is operational but undocumented; new contributors cannot discover it.
- **Remediation:** Write `docs/workflows/repository-audit-workflow.md` following the same structure as the documentation workflow doc.
- **Required tests:** Document references accurate agent names, commands, and paths.
- **Acceptance criteria:** `docs/workflows/repository-audit-workflow.md` exists; covers components, commands table, recommended first run, safety model, validation.

### AUD-P2-004 — No generic audit template

- **Severity:** P2 | **Confidence:** Medium | **Status:** Open
- **Affected paths:** `templates/` (all 8 templates are mobile-UI-specific), `.opencode/agents/repo-auditor.md` (AGENT_HANDOFF.md schema inlined at lines 207-279)
- **Observed:** `repo-auditor.md` carries 200+ lines of inline AGENT_HANDOFF.md schema. `templates/audit-report.md` exists but is mobile-UI-specific. No generic, reusable template exists for the audit workflow.
- **Expected:** Extract the schema into `templates/repo-audits/opencode-system-audit-template.md`; reference it from `repo-auditor.md` instead of inlining.
- **Impact:** Schema changes are harder to diff; no reusable template for future audits.
- **Remediation:** Create `templates/repo-audits/opencode-system-audit-template.md` from `repo-auditor.md`'s embedded schema; update `repo-auditor.md` to reference it.
- **Required tests:** Template matches schema in `repo-auditor.md` lines 207-279; `repo-auditor.md` updated to reference template.
- **Acceptance criteria:** `templates/repo-audits/opencode-system-audit-template.md` exists; `repo-auditor.md` no longer inlines the full schema.

### AUD-P2-005 — No agent/command/skill registry

- **Severity:** P2 | **Confidence:** Medium | **Status:** Open
- **Affected paths:** Root manifests (no registry file exists)
- **Observed:** With 25 agents, 27 commands, and 12 skills, there is no single file enumerating name → mode → permission-tier → primary-vs-hidden → invoked-by. The map only exists implicitly — you'd have to grep every frontmatter block to reconstruct it.
- **Expected:** A registry file (e.g., `.opencode/REGISTRY.md` or a generated section in `MANIFEST.md`) that enumerates all agents, commands, and skills with their relationships.
- **Impact:** Onboarding friction; no automated check that manifests match reality.
- **Remediation:** Create `.opencode/REGISTRY.md` or generate a section in `MANIFEST.md`; add a CI assertion that claimed counts match actual file counts.
- **Required tests:** Registry counts match `ls .opencode/agents | wc -l` etc.
- **Acceptance criteria:** Registry exists; counts match reality; CI verifies on change.

### AUD-P2-006 — Permission-block duplication across 7 agents — no regression test

- **Severity:** P2 | **Confidence:** Medium | **Status:** Open
- **Affected paths:** `.opencode/agents/{delivery,git-quality,qa,reviewer,repository-integrity,repository-docs,security}.md`
- **Observed:** Identical `*.env`/`*.pem`/`*.key`/`*credentials*`/`.git/**` deny blocks across 7 agent files. Good defense-in-depth, but a future security fix patching one file and forgetting the other six would reintroduce gaps.
- **Expected:** A regression test that asserts all 7 agents share the same deny list for secret paths.
- **Impact:** Risk of silent security drift across agent files.
- **Remediation:** Add a CI test that extracts secret-path deny patterns from all agent frontmatter blocks and asserts they match.
- **Required tests:** Test fails if any agent's secret-path deny list diverges from canonical set.
- **Acceptance criteria:** Regression test in `scripts/ci/` or `.github/workflows/ci.yaml`; all 7 agents verified.

### AUD-P3-001 — Bash deny-list asymmetry

- **Severity:** P3 | **Confidence:** Low | **Status:** Open
- **Affected paths:** `.opencode/agents/repo-auditor.md` vs `delivery.md`, `repository-integrity.md`
- **Observed:** `repo-auditor`'s bash deny list (curl/wget/ssh/scp/rsync/docker/kubectl/terraform/every package manager — 32+ denials) is far more exhaustive than higher-privilege agents' lists, even though those agents have `edit: ask`.
- **Impact:** Low — `bash: '*': ask` is a catch-all in every agent. Asymmetry is cosmetic.
- **Remediation:** Optionally copy `repo-auditor`'s exhaustive deny list into `delivery.md` and `repository-integrity.md` for defense-in-depth consistency.
- **Required tests:** None required.
- **Acceptance criteria:** Either asymmetry is documented as intentional or deny lists are harmonized.

### AUD-P3-002 — `approval-gated-redesign` skill not explicitly allowlisted

- **Severity:** P3 | **Confidence:** Low | **Status:** Open
- **Affected paths:** `.opencode/agents/` (likely `mobile-ui-orchestrator.md`)
- **Observed:** Skill is described in documentation as the governing skill for design-affecting tasks, but no explicit `skill: allow` reference found in any agent frontmatter.
- **Impact:** Low — may be implicitly loaded via `mobile-ui-orchestrator`'s broad `skill: allow`.
- **Remediation:** Confirm in `mobile-ui-orchestrator.md` frontmatter whether `approval-gated-redesign: allow` exists; add if missing; document if intentional implicit load.
- **Required tests:** Skill loads correctly when mobile-UI agents are invoked.
- **Acceptance criteria:** Skill access is explicit and verifiable.

### AUD-P3-003 — `opencode.jsonc` content not verified

- **Severity:** P3 | **Confidence:** Low | **Status:** Open
- **Affected paths:** `opencode.jsonc`
- **Observed:** ADR-0008 claims specific behaviors (exactly one config file, pinned version, resolved default agent, sharing disabled, explicit read-only tool allowances for `glob`, `grep`, `list`, `lsp`, `todowrite`, `question`). The file's content was not included in the context pack and cannot be verified.
- **Impact:** Low — assumption that ADR-0008 accurately describes current state.
- **Remediation:** AUD-P1-001 (smoke test) will resolve this when implemented.
- **Required tests:** Covered by AUD-P1-001.
- **Acceptance criteria:** Covered by AUD-P1-001.

### AUD-P3-004 — `templates/` is mobile-UI-only

- **Severity:** P3 | **Confidence:** Low | **Status:** Open
- **Affected paths:** `templates/` (all 8 files)
- **Observed:** All 8 templates serve the `.ui-redesign/` workflow exclusively. No reusable templates for repository audit, task run records, review records, or gate records — those schemas are inlined in agent prompts.
- **Impact:** Low — schemas work fine inlined, just less diffable.
- **Remediation:** As audit/gate/run-record workflows are formalized, extract their schemas into `templates/`.
- **Required tests:** None required.
- **Acceptance criteria:** Templates exist for each major workflow (audit, run-record, review, gate) OR the inlining approach is documented as intentional.

## Suspected Issues and Risks

### Suspected Issues (require validation)

1. **`git-quality` command-less status may be intentional.** Agent has `mode: primary` but no command. Could be by design (invocation via `@git-quality` only). Needs confirmation: add command or document intent.

2. **`approval-gated-redesign` skill loading may be implicit.** Skill described in docs but no explicit `skill: allow` found. Likely loaded by `mobile-ui-orchestrator`'s broad skill block. Needs one-line confirmation.

3. **Context-pack generator location unknown.** Two generators exist (`.chatgpt-context-pack/` and an unknown single-file tool), both untracked. Neither is inspectable without locating them. AUD-P0-003 remediation depends on finding and patching the generator.

### Maintainability Risks

1. **README agent/command counts will drift.** No automated check enforces the "25 agents / 27 commands" claims. A 5-line CI script comparing `ls | wc -l` against README badge text would prevent drift.

2. **Permission-block duplication drift.** 7 agents share identical secret-path deny blocks. A security fix touching one could miss the other six. Regression test recommended (AUD-P2-006).

3. **ADR-0008 smoke test remains unimplemented 3 days post-decision.** The ADR specifies implementation as part of the decision, not as future work. Risk of config drift without verification.

### Security Risks

1. **`.opencode/run-logs/` is a persistent secret hazard.** The directory is gitignored but the context-pack generator ignores gitignore. Until AUD-P0-003 is fixed, any future run log with a session cookie could be exported again.

2. **Dev-dependency supply chain is unmonitored.** `pnpm audit --prod` excludes all dev dependencies. Compromised build/lint/test tooling would not be detected (AUD-P1-002).

## Execution Plan

### Phase A — Stop the Bleeding (today, ~30 min)

**Objective:** Close active exposure window from AUD-P0-001 and fix the scanner blind spot.

**Finding IDs:** AUD-P0-001, AUD-P0-002

**Expected paths:**
- `.opencode/run-logs/` (delete contents)
- `scripts/security/check-secrets.sh` (narrow `.opencode` exclude)

**Tasks:**
- [ ] Delete `.opencode/run-logs/*` from disk (`rm -rf .opencode/run-logs/*`). Verify directory is empty.
- [ ] If Keycloak realm could ever run non-localhost, rotate the dev signing secret and invalidate the session.
- [ ] Patch `scripts/security/check-secrets.sh`: replace blanket `.opencode` in `EXCLUDE_DIRS` with targeted subpath excludes for `.opencode/agents`, `.opencode/commands`, `.opencode/skills`, `.opencode/documentation`, `.opencode/benchmarks`.
- [ ] Run `pnpm security:secrets` to verify scanner still passes clean.
- [ ] Commit Phase A changes as a single atomic commit.

**Validation:**
```bash
ls .opencode/run-logs/              # Should be empty or directory absent
pnpm security:secrets               # Must pass (no secrets)
git status --short                  # Only intended changes
```

**Acceptance criteria:**
- `.opencode/run-logs/` is empty or absent.
- `check-secrets.sh` `EXCLUDE_DIRS` no longer contains bare `.opencode`.
- `.opencode/run-logs/` is scannable by the secret scanner (a JWT placed there for testing would be caught).
- `pnpm security:secrets` passes.

**Rollback:** `git revert <commit>` — restores original secret-scanner exclusion pattern and (if committed) the deleted run-logs directory (though the deleted sensitive files would not be restored, which is the point).

**Approval required:** Yes — deleting files under `.opencode/run-logs/` and modifying `scripts/security/check-secrets.sh`. The run-logs deletion is the explicit remediation for AUD-P0-001. The secret-scanner change modifies a security boundary.

---

### Phase B — Close the Structural Gap (this week)

**Objective:** Fix the context-pack generator to prevent future AUD-P0-001-class leaks, and build the ADR-0008 smoke test.

**Finding IDs:** AUD-P0-003, AUD-P1-001

**Expected paths:**
- Unknown context-pack generator (to be located/inspected/patched)
- `scripts/security/check-opencode-config.sh` (new file)

**Tasks:**
- [ ] Locate/inspect the tool that generates `calvin-opencode-system-context-pack.md` (and `.chatgpt-context-pack/`).
- [ ] Make it `git ls-files`-based or `git check-ignore`-filtered before reading file contents.
- [ ] Add an explicit, audited allowlist for intentionally-untracked-but-wanted files (e.g., `.env.example`).
- [ ] Add a pre-export hook that purges `.opencode/run-logs/` before any pack/audit/export action.
- [ ] Consolidate two parallel generators into one canonical, source-controlled script under `scripts/`.
- [ ] Create `scripts/security/check-opencode-config.sh` implementing ADR-0008's 10-point smoke test.
- [ ] Wire smoke test into CI (`scripts/ci/check-all.sh`) and pre-push hook (`scripts/git-hooks/pre-push`).
- [ ] Run smoke test; confirm `opencode.jsonc` is in the state ADR-0008 claims.

**Validation:**
```bash
# Verify context-pack generator excludes gitignored files (test by generating a pack and checking)
# Verify smoke test passes
bash scripts/security/check-opencode-config.sh   # Must exit 0
pnpm ci:check                                     # Must pass with new smoke test integrated
```

**Acceptance criteria:**
- Context-pack generator is `git ls-files`-based or `git check-ignore`-filtered.
- Only one canonical generator exists, source-controlled under `scripts/`.
- Pre-export hook purges `.opencode/run-logs/` before any export.
- `scripts/security/check-opencode-config.sh` exists, passes, and is wired into CI and pre-push.
- All 10 ADR-0008 points verified.

**Rollback:** Generator changes: revert the generator source change (if source-controlled). Smoke test: remove from CI integration (`git revert`). ADR-0008 remains Accepted.

**Approval required:** Yes — modifying the context-pack generator (external tool, may be outside repo). Creating new CI script. Modifying pre-push hook.

---

### Phase C — Fill the Documented Gap

**Objective:** Create the missing audit workflow documentation and template, bringing the audit system to parity with the documentation system.

**Finding IDs:** AUD-P2-003, AUD-P2-004, AUD-P3-004

**Expected paths:**
- `docs/workflows/repository-audit-workflow.md` (new file)
- `templates/repo-audits/opencode-system-audit-template.md` (new file)
- `.opencode/agents/repo-auditor.md` (update to reference template)

**Tasks:**
- [ ] Write `docs/workflows/repository-audit-workflow.md` — document the `repo-auditor` → `AGENT_HANDOFF.md` → (human review) → `repo-repair` → `repository-integrity` cycle. Follow the same structure as `docs/REPOSITORY_DOCUMENTATION_WORKFLOW.md`: components, commands table, recommended first run, safety model, validation.
- [ ] Extract `templates/repo-audits/opencode-system-audit-template.md` from `repo-auditor.md`'s embedded schema (lines 207-279).
- [ ] Update `repo-auditor.md` to reference the external template instead of inlining it (optional but cleaner).
- [ ] Optionally file this report (`opencode-system-audit-2026-06-20.md`) under a new `audits/` directory as the first worked example.

**Validation:**
```bash
ls docs/workflows/repository-audit-workflow.md      # Must exist
ls templates/repo-audits/opencode-system-audit-template.md  # Must exist
# Verify repo-auditor.md references the template (optional)
```

**Acceptance criteria:**
- `docs/workflows/repository-audit-workflow.md` exists and covers the full audit→repair cycle.
- `templates/repo-audits/opencode-system-audit-template.md` exists and matches `repo-auditor.md`'s schema.
- (Optional) `repo-auditor.md` references the external template.

**Rollback:** Delete the new files (`git revert`). No code changes affected.

**Approval required:** Only for documentation additions — low risk. Does not affect product code, builds, or CI.

---

### Phase D — Polish (Low Urgency)

**Objective:** Address the remaining P2/P3 findings that improve maintainability and consistency.

**Finding IDs:** AUD-P2-001, AUD-P2-005, AUD-P2-006, AUD-P3-001

**Expected paths:**
- `.opencode/commands/quality-check.md` (new) OR `.opencode/agents/git-quality.md` (update)
- `.opencode/REGISTRY.md` (new) OR `MANIFEST.md` (update)
- `scripts/ci/check-agent-permissions.sh` (new)

**Tasks:**
- [ ] AUD-P2-001: Add a `/quality-check` command wired to `git-quality`, OR document in `git-quality.md` that it is intentionally command-less.
- [ ] AUD-P2-005: Create `.opencode/REGISTRY.md` or generate a section in `MANIFEST.md` enumerating all 25 agents, 27 commands, and 12 skills with name → mode → permission-tier → primary-vs-hidden → invoked-by.
- [ ] AUD-P2-005: Add a CI assertion that README's stated agent/command counts match actual file counts (5-line script).
- [ ] AUD-P2-006: Add a CI test that extracts secret-path deny patterns from all 7 agent frontmatter blocks and asserts they match the canonical set.
- [ ] AUD-P3-001: Optionally copy `repo-auditor`'s exhaustive bash deny list into `delivery.md` and `repository-integrity.md`, OR document the asymmetry as intentional.
- [ ] AUD-P1-002: Decide and document whether dev-dependency supply-chain risk is accepted or should be scanned; implement or document accordingly.

**Validation:**
```bash
ls .opencode/commands/quality-check.md              # Must exist (if added)
ls .opencode/REGISTRY.md                             # Must exist (if added)
bash scripts/ci/check-agent-permissions.sh           # Must pass (if added)
pnpm ci:check                                        # Must pass with all new checks
```

**Acceptance criteria:**
- `git-quality` agent has a command or documented command-less status.
- Registry file exists with accurate counts; CI verifies on change.
- Permission-block regression test exists and passes.
- Dev-dependency risk is documented or scanned.

**Rollback:** Revert individual commits. No data migration required.

---

## Final Verification Checklist

After all phases complete, run:

```bash
# Security checks
pnpm security:secrets               # No secrets detected
pnpm security:dependencies          # No production vulnerabilities
bash scripts/security/check-opencode-config.sh  # ADR-0008 smoke test passes

# Quality gates
pnpm format:check                   # Prettier compliance
pnpm lint                           # 0 ESLint errors
pnpm typecheck                      # 29/29 tasks pass
pnpm test:unit                      # 921 tests pass
pnpm build                          # 17/17 packages compile

# CI simulation
pnpm ci:check                       # All checks pass

# Context-pack safety
# Verify: context pack contains no gitignored files
# Verify: .opencode/run-logs/ is empty before any export

# Git state
git status --short                  # Only intended changes
git diff --stat                     # Verify scope
```

## Deferred, Blocked, and Rejected Findings

| ID | Decision | Reason | Prerequisite |
|---|---|---|---|
| AUD-P3-002 (`approval-gated-redesign` skill) | Deferred | Low severity; needs one-line confirmation in `mobile-ui-orchestrator.md` | None |
| AUD-P3-003 (`opencode.jsonc` not verified) | Deferred | Resolved by AUD-P1-001 (smoke test) | Phase B completion |
| AUD-P3-001 (bash deny-list asymmetry) | Deferred | Cosmetic; `bash: '*': ask` catch-all mitigates | None |
| AUD-P3-004 (`templates/` mobile-UI-only) | Deferred | Schemas work inlined; extract when workflows formalized | Phase C completion |

## Open Questions and Limitations

1. **Context-pack generator location unknown:** The tool that produced `calvin-opencode-system-context-pack.md` is not in the repository and was not included in the context pack. Without locating it, Phase B cannot proceed. The user must identify this tool before AUD-P0-003 can be remediated.

2. **`opencode.jsonc` content not inspected:** The file was excluded from the context pack. ADR-0008's claims about its resolved state are unverified until Phase B's smoke test runs. The user should explicitly include `opencode.jsonc` in future context packs if config review is desired.

3. **No runtime validation executed:** This audit was static analysis only. No `pnpm` commands, no secret scans, no CI simulations were run against the live repository. All validation commands specified in this handoff must be executed during implementation.

4. **Secret rotation decision outstanding:** AUD-P0-001 captured a live session cookie. The user must decide whether the Keycloak dev realm is truly localhost-only and safe to simply delete, or whether the signing secret should be rotated. This is a user-facing decision, not an implementation decision.

5. **Physical device (iPhone 16 Pro):** Not relevant to this opencode-system audit. Refer to the product `AGENT_HANDOFF.md` for mobile UI concerns.

6. **Full source audit coverage:** The audit covered the opencode system layer only (`.opencode/`, `docs/`, `scripts/`, `templates/`, root manifests). The PIA product source (`apps/`, `packages/`, `db/`, `infra/`, `planning/`) was intentionally excluded from scope.

7. **Prior audit handoff still active:** The existing `AGENT_HANDOFF.md` (dated 2026-06-13) covers the PIA product audit and has its own execution phases. That handoff is NOT superseded by this one. Both handoffs are active for different scopes.

## Implementation Agent Starting Point

**Recommended first phase:** Phase A — Stop the Bleeding.

**First paths to modify (Phase A):**
1. `.opencode/run-logs/` — delete all contents (`rm -rf .opencode/run-logs/*`).
2. `scripts/security/check-secrets.sh` — replace blanket `.opencode` exclude with targeted subpath excludes.

**First validation commands:**
```bash
ls .opencode/run-logs/              # Verify empty
pnpm security:secrets               # Verify scanner passes
```

**Blockers for Phase A start:**
- **Approval required** for deleting `.opencode/run-logs/*` (destructive to untracked log files — but these files should not exist per `.gitignore`).
- **Approval required** for modifying `scripts/security/check-secrets.sh` (security boundary change).
- **Secret rotation decision** — user must confirm whether Keycloak signing secret needs rotation (AUD-P0-001).

**Blockers for Phase B start:**
- Context-pack generator location must be identified by the user before AUD-P0-003 can be fixed.

**Blockers for Phase C/D:** None — these are documentation and polish only.

**Repository state note:** Worktree is clean except for untracked `opencode-system-audit-2026-06-20.md`. Commit `7b19197` is HEAD on `main`.

**Changes that must remain separate:**
- Phase A (stop the bleeding) and Phase B (structural gap) are independent and can be committed separately or together.
- Phase C (documentation) is purely additive — no existing files modified.
- Phase D (polish) items are independent of each other — commit per finding.
- Do NOT modify `planning/status.yaml`, `planning/backlog.yaml`, any PIA product source, or the pre-existing `AGENT_HANDOFF.md` (which covers the product audit).
- This handoff and the source audit report (`opencode-system-audit-2026-06-20.md`) are documentation artifacts; they do not modify any existing repository files.
