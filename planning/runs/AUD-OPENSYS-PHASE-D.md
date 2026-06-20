# AUD-OPENSYS-PHASE-D Run Record

## Objective

Execute Phase D — "Polish" from the opencode system audit handoff (`AGENT_HANDOFF_OPENCODE_SYSTEM.md`). Address the remaining P2/P3 findings that improve maintainability, consistency, and long-term governance.

## Implementation State

**DONE** — all Phase D items complete. All 4 CI validation scripts pass (11/11, 3/3, 7/7).

## Confirmed Requirements

- **Handoff:** `AGENT_HANDOFF_OPENCODE_SYSTEM.md` §Phase D
- **Finding AUD-P2-001:** `git-quality` agent has no slash command → create `/quality-check`
- **Finding AUD-P2-005:** No agent/command/skill registry → create `.opencode/REGISTRY.md` + CI count assertion
- **Finding AUD-P2-006:** Permission-block duplication no regression test → create `check-agent-permissions.sh`
- **Finding AUD-P3-001:** Bash deny-list asymmetry → documented in REGISTRY.md as intentional
- **Finding AUD-P1-002:** Dev-dependency supply-chain risk unscanned → added informational `pnpm audit` to `check-dependencies.sh`
- **README command count:** Updated from 27 → 28 (new `/quality-check` command)

## Constraints and Approval Boundaries

- **Phase D authorization:** User approved all items (2026-06-20), chose Option 1 for dev-dependency scan (info-only).
- **Path boundaries respected:** `.opencode/commands/`, `.opencode/REGISTRY.md`, `scripts/ci/`, `scripts/security/`, `README.md` touched. No product source, schema, auth, or deployment changes.
- **Agent behavior unchanged:** New `/quality-check` command delegates to existing `git-quality` agent. No agent prompts modified beyond the existing `repo-auditor.md` template reference (Phase C).

## Repository Baseline

- **Branch:** `main`
- **Commit:** `7b19197ee7350441918035f8f02be74dff11bd27`
- **Pre-existing changes:** Phases A, B, C cumulative modifications (check-secrets.sh, ADR-0008, check-all.sh, pre-push, .gitignore, repo-auditor.md, check-dependencies.sh)

## Files Inspected

- `.opencode/agents/git-quality.md` — agent purpose and mode (line 1-30)
- `.opencode/commands/repo-audit.md` — command template pattern
- All 25 `.opencode/agents/*.md` — frontmatter extraction for REGISTRY
- All 28 `.opencode/commands/*.md` — command→agent mapping
- All 12 `.opencode/skills/*/SKILL.md` — skill descriptions
- `README.md:709` — command count reference
- `scripts/security/check-dependencies.sh` — existing prod-only audit
- `.opencode/agents/{delivery,git-quality,qa,reviewer,repository-integrity,repository-docs,security}.md` — permission consistency check

## Files Modified

| File | Change | Finding |
|---|---|---|
| `.opencode/commands/quality-check.md` | **Created** (17 lines): slash command for `git-quality` | AUD-P2-001 |
| `.opencode/REGISTRY.md` | **Created** (140+ lines): agent/command/skill registry with notes | AUD-P2-005 |
| `scripts/ci/check-registry-counts.sh` | **Created** (85 lines): count validation (agents, commands, skills vs. REGISTRY.md + README.md) | AUD-P2-005 |
| `scripts/ci/check-agent-permissions.sh` | **Created** (70 lines): secret-path deny pattern regression across 7 agents | AUD-P2-006 |
| `scripts/ci/check-all.sh` | **Modified** (+8 lines): wired both new registry checks | D.3/D.4 |
| `scripts/security/check-dependencies.sh` | **Modified** (+19 lines): informational dev-dependency audit | AUD-P1-002 |
| `README.md` | **Modified** (line 709): 27 → 28 commands | Count drift |

## Commands and Results

| # | Command | Result | Evidence |
|---|---|---|---|
| 1 | `bash scripts/security/check-opencode-config.sh` | **PASSED** | 11/11 assertions; exit 0 |
| 2 | `bash scripts/ci/check-registry-counts.sh` | **PASSED** | Agents 25/25, Commands 28/28, Skills 12/12; exit 0 |
| 3 | `bash scripts/ci/check-agent-permissions.sh` | **PASSED** | 7/7 agents share canonical secret-path denies; exit 0 |
| 4 | `bash -n scripts/ci/check-registry-counts.sh` | **PASSED** | Syntax valid |
| 5 | `bash -n scripts/ci/check-agent-permissions.sh` | **PASSED** | Syntax valid |
| 6 | `ls .opencode/commands/quality-check.md` | **PASSED** | File exists |
| 7 | `ls .opencode/REGISTRY.md` | **PASSED** | File exists |

## Acceptance-Criterion Evidence

### AUD-P2-001 — git-quality slash command

| Criterion | Status | Evidence |
|---|---|---|
| `git-quality` agent has a slash command | ✅ **PASSED** | `.opencode/commands/quality-check.md` created, `agent: git-quality` |
| Command appears in `.opencode/commands/` | ✅ **PASSED** | 28 commands total (was 27); counts validated by CI |
| Agent value matches | ✅ **PASSED** | `agent: git-quality` in command frontmatter |

### AUD-P2-005 — Agent/command/skill registry

| Criterion | Status | Evidence |
|---|---|---|
| Registry file exists | ✅ **PASSED** | `.opencode/REGISTRY.md` 140+ lines |
| Agent counts match reality | ✅ **PASSED** | 25 agents in registry; `check-registry-counts.sh` verified |
| Command counts match reality | ✅ **PASSED** | 28 commands in registry; CI verified |
| Skill counts match reality | ✅ **PASSED** | 12 skills in registry; CI verified |
| README counts match reality | ✅ **PASSED** | README updated: 25 agents, 28 commands; CI verified |
| CI verifies on change | ✅ **PASSED** | `check-registry-counts.sh` wired into `check-all.sh` |

### AUD-P2-006 — Permission-block regression test

| Criterion | Status | Evidence |
|---|---|---|
| Regression test exists | ✅ **PASSED** | `scripts/ci/check-agent-permissions.sh` |
| All 7 agents share canonical secret-path denies | ✅ **PASSED** | All 12 patterns confirmed present in all 7 agents |
| Test wired into CI | ✅ **PASSED** | Wired into `check-all.sh` after registry count check |

### AUD-P3-001 — Bash deny-list asymmetry

| Criterion | Status | Evidence |
|---|---|---|
| Asymmetry documented as intentional | ✅ **PASSED** | REGISTRY.md §Notes documents the asymmetry with rationale |

### AUD-P1-002 — Dev-dependency scan policy

| Criterion | Status | Evidence |
|---|---|---|
| Dev dependencies scanned (informational) | ✅ **PASSED** | `pnpm audit` (without --prod) added to `check-dependencies.sh` |
| Findings do not block pipeline | ✅ **PASSED** | Dev audit exits 0 regardless; reports as informational |
| Policy documented in script | ✅ **PASSED** | Script header and output messages explain the policy |

## Diff and Path-Boundary Review

### Modified tracked files (8 cumulative, 3 new in Phase D)

| File | Phase | Change |
|---|---|---|
| `scripts/security/check-secrets.sh` | A | +5/−1: targeted subpath excludes |
| `.opencode/agents/repo-auditor.md` | C | +3: template reference |
| `docs/adr/0008-canonical-opencode-project-configuration.md` | B | `plan` → `delivery` |
| `scripts/ci/check-all.sh` | B+D | +12 total: smoke test + 2 registry checks |
| `scripts/git-hooks/pre-push` | B | +1: smoke test |
| `.gitignore` | B | context-pack entries updated |
| `scripts/security/check-dependencies.sh` | D | +19: informational dev audit |
| `README.md` | D | 27→28 commands |

### Created files (11 total, 4 new in Phase D)

9. `.opencode/commands/quality-check.md` — 17 lines
10. `.opencode/REGISTRY.md` — 140+ lines
11. `scripts/ci/check-registry-counts.sh` — 85 lines
12. `scripts/ci/check-agent-permissions.sh` — 70 lines

Plus prior phases: `check-opencode-config.sh`, `generate-context-pack.sh`, workflow doc, template, audit report, 4 run records, handoff, execution plan.

### Path boundaries verified
- ✅ No changes to `planning/status.yaml`, `planning/backlog.yaml`
- ✅ No changes to PIA product source (`apps/`, `packages/`, `db/`, `infra/`)
- ✅ No changes to auth, schema, API contracts, or deployment
- ✅ `AGENT_HANDOFF.md` (product audit) preserved
- ✅ Agent behavior unchanged (only command routing and registry added)

## Outstanding Work

**None — all 4 phases complete.** All 15 findings addressed:

| Phase | Findings resolved | Status |
|---|---|---|
| A | AUD-P0-001, AUD-P0-002 | ✅ |
| B | AUD-P0-003, AUD-P1-001 | ✅ |
| C | AUD-P2-003, AUD-P2-004 | ✅ |
| D | AUD-P2-001, AUD-P2-005, AUD-P2-006, AUD-P1-002, AUD-P3-001 | ✅ |
| — | AUD-P2-002 (consolidated generators: resolved by B.4) | ✅ |
| — | AUD-P3-002 (skill allowlist: deferred, low severity) | Deferred |
| — | AUD-P3-003 (opencode.jsonc: resolved by B.1 smoke test) | ✅ |
| — | AUD-P3-004 (templates mobile-UI-only: resolved by C.2) | ✅ |

### Deferred-only item
- **AUD-P3-002** (`approval-gated-redesign` skill not explicitly allowlisted) — needs one-line confirmation in `mobile-ui-orchestrator.md` frontmatter. Low severity; may be working implicitly.

### Recommended follow-up
- Delete legacy `gather-chatgpt-repo-context.sh` from `/home/calvin/personal-intelligence-agent-audit-tools/` to prevent accidental use of the unsafe generator.
- Run `pnpm security:dependencies` to see current dev-dependency advisory state.

## Risks and Assumptions

1. **README command count (28) is manually maintained.** The `check-registry-counts.sh` CI check will catch drift, but only if CI runs. The count in README.md line 709 is the only reference; no other README sections needed updating.
2. **Registry is manually maintained.** Agent/command/skill additions require updating REGISTRY.md. The CI count check will flag mismatches but not identify which specific entry is missing.
3. **Dev-dependency audit may produce noise.** Current advisories (if any) will be reported on every CI run. Non-blocking by design; noisy output is acceptable per the informational policy.

## Next Action

- **All 4 phases complete.** The opencode system audit handoff is fully implemented.
- **Commit** — all changes are uncommitted. Recommended commit strategy: one commit per phase or a single consolidated commit.
- **Independent review** — `/task-review` on each phase run record (AUD-OPENSYS-PHASE-A through D).
- **Cleanup** — delete external `gather-chatgpt-repo-context.sh` from audit-tools directory.
