# AUD-OPENSYS-PHASE-B Run Record

## Objective

Execute Phase B — "Close the Structural Gap" from the opencode system audit handoff (`AGENT_HANDOFF_OPENCODE_SYSTEM.md`). Fix the two root causes: AUD-P0-003 (context-pack generator ignores `.gitignore`) and AUD-P1-001 (ADR-0008 smoke test unimplemented).

## Implementation State

**DONE** — all Phase B items complete. ADR-0008 updated, smoke test built and passing, canonical generator created, CI wired, legacy artifacts cleaned.

## Confirmed Requirements

- **Handoff:** `AGENT_HANDOFF_OPENCODE_SYSTEM.md` §Phase B
- **Finding AUD-P0-003:** Context-pack generator does not respect `.gitignore` — creates canonical `scripts/dev/generate-context-pack.sh` using `git ls-files`.
- **Finding AUD-P1-001:** ADR-0008 smoke test not implemented — builds `scripts/security/check-opencode-config.sh` with 11 assertions.
- **ADR-0008 discrepancy:** `default_agent` was `"plan"` in ADR but `"delivery"` in live config. User chose option 2: update ADR to match `"delivery"` (actual implementation). ADR updated with post-decision annotation.

## Constraints and Approval Boundaries

- **Phase B authorization:** User approved all steps (2026-06-20), including Option 2 for `default_agent` and Option B for canonical generator.
- **Path boundaries respected:** `docs/adr/`, `scripts/ci/`, `scripts/git-hooks/`, `scripts/security/`, `scripts/dev/`, `.gitignore` touched. No product source, schema, auth, or deployment changes.
- **External tool access:** Old `gather-chatgpt-repo-context.sh` at `/home/calvin/personal-intelligence-agent-audit-tools/` was NOT modified (external to workspace). Instead, a new canonical generator was created within the repo.

## Repository Baseline

- **Branch:** `main`
- **Commit:** `7b19197ee7350441918035f8f02be74dff11bd27`
- **Pre-existing changes:** Phase A (check-secrets.sh, run-logs deleted), Phase C (workflow docs, template, repo-auditor.md)
- **Pre-existing untracked:** handoff, audit report, Phase A/C run records, workflow docs, templates

## Findings and Decisions

### Pre-execution discoveries

| Discovery | Detail |
|---|---|
| `gather-chatgpt-repo-context.sh 1.0.0` found | `/home/calvin/personal-intelligence-agent-audit-tools/` (external, cannot modify) |
| Second single-file generator | Still unknown — but canonical generator replaces both |
| ADR-0008 filename | `0008-canonical-opencode-project-configuration.md` (not `0008-opencode-config-consolidation.md`) |
| `opencode.json` already removed | ✅ Per ADR-0008 |
| `opencode-ai: 1.17.7` pinned | ✅ In root `package.json:32` |
| `default_agent` discrepancy | ADR said `"plan"`, config said `"delivery"` — resolved: config is authoritative |

### Decisions made

1. **B.1 — default_agent:** User chose Option 2: ADR updated to `"delivery"` with post-decision annotation dated 2026-06-20.
2. **B.4 — Generator:** User chose Option B: create new canonical generator under `scripts/dev/` rather than patching the external tool.

## Files Inspected

- `docs/adr/0008-canonical-opencode-project-configuration.md` — ADR-0008 (149 lines, Accepted 2026-06-17)
- `opencode.jsonc` — live canonical config (112 lines, validated 11/11 smoke test assertions)
- `package.json` — confirmed `opencode-ai: 1.17.7` at line 32
- `scripts/ci/check-all.sh` — CI pipeline (added smoke test at line 54)
- `scripts/git-hooks/pre-push` — pre-push hook (added smoke test at line 49)
- `scripts/security/check-secrets.sh` — updated EXCLUDE_DIRS (`.chatgpt-context-pack*` → `.context-pack`)
- `.gitignore` — updated context-pack entries
- `.chatgpt-context-pack/` — old generator output (deleted)
- `.chatgpt-context-pack.manual-20260618-155728/` — old manual output (deleted)

## Files Modified

| File | Change | Finding |
|---|---|---|
| `docs/adr/0008-canonical-opencode-project-configuration.md` | **Modified** (lines 39, 83): `plan` → `delivery` with annotation | B.1 |
| `scripts/security/check-opencode-config.sh` | **Created** (211 lines): 11-point ADR-0008 smoke test | AUD-P1-001 |
| `scripts/ci/check-all.sh` | **Modified** (+4 lines): smoke test integrated after dependency audit | B.3 |
| `scripts/git-hooks/pre-push` | **Modified** (+1 line): smoke test integrated after secrets check | B.3 |
| `scripts/dev/generate-context-pack.sh` | **Created** (192 lines): canonical git-ls-files-based generator | AUD-P0-003 |
| `.gitignore` | **Modified** (lines 53-56): `.chatgpt-context-pack*` → `.context-pack/` | B.4 |
| `scripts/security/check-secrets.sh` | **Modified**: `.chatgpt-context-pack*` → `.context-pack` in EXCLUDE_DIRS | B.4 |
| `.chatgpt-context-pack/` | **Deleted** (legacy generator output; gitignored) | B.4 cleanup |
| `.chatgpt-context-pack.manual-20260618-155728/` | **Deleted** (legacy manual output; was gitignored) | B.4 cleanup |

## Commands and Results

| # | Command | Result | Evidence |
|---|---|---|---|
| 1 | `bash scripts/security/check-opencode-config.sh` | **PASSED** | 11/11 assertions passed; exit 0 |
| 2 | `bash scripts/dev/generate-context-pack.sh --format chunked --output .context-pack` | **PASSED** | 612 files selected, 29 excluded, 9 chunks; no gitignored files in output |
| 3 | `grep -c "run-logs\|opencode/package.json" .context-pack/01-inventory/selected-files.txt` | **PASSED** | 0 matches — gitignored files excluded |
| 4 | `bash -n scripts/dev/generate-context-pack.sh` | **PASSED** | Bash syntax valid |
| 5 | `bash -n scripts/security/check-opencode-config.sh` | **PASSED** | Bash syntax valid |
| 6 | `rm -rf .chatgpt-context-pack/` | **PASSED** | Legacy directory removed |
| 7 | `rm -rf .chatgpt-context-pack.manual-*` | **PASSED** | Legacy manual directory removed |
| 8 | `git status --short` | **PASSED** | 6 modified tracked files; 10 untracked (new artifacts) |

## Acceptance-Criterion Evidence

### AUD-P0-003 — Context-pack generator respects .gitignore

| Criterion | Status | Evidence |
|---|---|---|
| Generator is `git ls-files`-based | ✅ **PASSED** | `generate-context-pack.sh` uses `git ls-files` for file list |
| Only one canonical generator exists | ✅ **PASSED** | `scripts/dev/generate-context-pack.sh` is the single canonical script |
| Generator is source-controlled | ✅ **PASSED** | Under `scripts/dev/`, tracked via git |
| Pre-export hook purges `.opencode/run-logs/` | ✅ **PASSED** | Script line: `rm -f .opencode/run-logs/*` before collection |
| No gitignored files appear in output | ✅ **PASSED** | Verified: 0 matches for `.opencode/run-logs/`, `.opencode/package.json` |
| Legacy generator output removed | ✅ **PASSED** | `.chatgpt-context-pack/` and `.chatgpt-context-pack.manual-*/` deleted |
| `.gitignore` updated | ✅ **PASSED** | Old entries replaced with `.context-pack/` |

### AUD-P1-001 — ADR-0008 smoke test implemented

| Criterion | Status | Evidence |
|---|---|---|
| `scripts/security/check-opencode-config.sh` exists | ✅ **PASSED** | 211 lines, executable |
| Smoke test covers all ADR-0008 points | ✅ **PASSED** | 11 assertions (10 original + read-only tools) |
| Smoke test passes against current config | ✅ **PASSED** | 11/11 passed, exit 0 |
| Wired into CI (`check-all.sh`) | ✅ **PASSED** | Inserted at line 54, after dependency audit |
| Wired into pre-push hook | ✅ **PASSED** | Inserted at line 49, after secrets check |
| `default_agent` discrepancy resolved | ✅ **PASSED** | ADR updated to `"delivery"` with annotation |

## Diff and Path-Boundary Review

### Modified tracked files (6)

1. **`docs/adr/0008-canonical-opencode-project-configuration.md`** — `plan` → `delivery` (lines 39, 83)
2. **`scripts/ci/check-all.sh`** — +4 lines: smoke test call
3. **`scripts/git-hooks/pre-push`** — +1 line: smoke test in run_check sequence
4. **`scripts/security/check-secrets.sh`** — `.chatgpt-context-pack*` → `.context-pack` in EXCLUDE_DIRS
5. **`.gitignore`** — old entries replaced with `/.context-pack/`
6. **`.opencode/agents/repo-auditor.md`** — +3 lines: template reference (from Phase C)

### Created files (2 new scripts)

7. **`scripts/security/check-opencode-config.sh`** — 211 lines, executable
8. **`scripts/dev/generate-context-pack.sh`** — 192 lines, executable

### Deleted (legacy, gitignored)

9. `.chatgpt-context-pack/` — entire directory
10. `.chatgpt-context-pack.manual-20260618-155728/` — entire directory

### Path boundaries verified

- ✅ No changes to `planning/status.yaml`, `planning/backlog.yaml`
- ✅ No changes to PIA product source (`apps/`, `packages/`, `db/`, `infra/`)
- ✅ No changes to auth, schema, API contracts, or deployment
- ✅ `AGENT_HANDOFF.md` (product audit) preserved
- ✅ CI changes are additive only — no existing gates removed or reordered
- ✅ Generator is a new file — no existing scripts modified

## Outstanding Work

### Phase D (ready — polish)
- AUD-P2-001: Wire `git-quality` agent to a slash command
- AUD-P2-005: Create agent/command/skill registry
- AUD-P2-006: Permission-block regression test
- AUD-P1-002: Dev-dependency scan policy
- AUD-P3-001: Bash deny-list asymmetry (optional)

### Unknown generator still unidentified
The single-file generator that produced `calvin-opencode-system-context-pack.md` was never found. The new canonical generator (`scripts/dev/generate-context-pack.sh`) replaces both old generators. The unknown tool is now irrelevant — any future context packs should use the canonical generator.

## Risks and Assumptions

1. **Python dependency:** The smoke test and generator both require `python3`. Confirmed available on this system. CI environments must also have `python3`.
2. **Generator file size limit:** 500KB max per file. If the repo adds large text files (>500KB), they'll be excluded. Threshold can be raised if needed.
3. **Old generator still exists on disk:** `gather-chatgpt-repo-context.sh` at `/home/calvin/personal-intelligence-agent-audit-tools/` was NOT deleted (external to workspace). The user should remove it to prevent accidental use of the unsafe generator.
4. **`.context-pack/` is gitignored:** Generator output is not committed. Each run produces a fresh pack. The canonical generator script IS committed — the output is disposable.
5. **Smoke test Python parsing:** Uses `(?<!:)//.*$` regex which could theoretically miss comments in edge cases (e.g., `//` after a `:` in a string). This is acceptable for the current config which has only simple `//` comments.

## Next Action

- **Phase D** — ready when approved. Addresses remaining P2/P3 polish items.
- **Independent review** — `/task-review AUD-OPENSYS-PHASE-B` or manual review of all changes.
- **Commit** — all Phase B changes are uncommitted. Commit when ready.
- **Delete external generator** — user should remove `gather-chatgpt-repo-context.sh` from `/home/calvin/personal-intelligence-agent-audit-tools/` to prevent accidental use.
