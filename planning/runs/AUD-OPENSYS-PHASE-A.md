# AUD-OPENSYS-PHASE-A Run Record

## Objective

Execute Phase A — "Stop the Bleeding" from the opencode system audit handoff (`AGENT_HANDOFF_OPENCODE_SYSTEM.md`, handoff ID `AUD-OPENSYS-2026-06-20`). Remediate the two P0 findings: delete the exposed session cookie from disk (AUD-P0-001) and fix the secret scanner's blind spot (AUD-P0-002).

## Implementation State

**DONE** — both findings remediated. Run-logs cleared; scanner exclusion narrowed; scanner passes clean.

## Confirmed Requirements

- **Source audit:** `opencode-system-audit-2026-06-20.md`
- **Handoff:** `AGENT_HANDOFF_OPENCODE_SYSTEM.md` §Execution Plan Phase A
- **Finding AUD-P0-001:** `.opencode/run-logs/cookies.txt` (Netscape-format JWT session cookie), `api.pid` (process ID), `api.log` (121 KB API logs) — all gitignored per `.gitignore:48` but present on disk. Deletion is the remediation.
- **Finding AUD-P0-002:** `scripts/security/check-secrets.sh:30` blanket-excludes `.opencode` from `EXCLUDE_DIRS`, rendering the scanner blind to `.opencode/run-logs/`. Replace with targeted subpath excludes.
- **Acceptance criteria:** (1) `.opencode/run-logs/` is empty; (2) `EXCLUDE_DIRS` no longer contains bare `.opencode`; (3) `.opencode/run-logs/` is scannable; (4) `pnpm security:secrets` passes.

## Constraints and Approval Boundaries

- **Approval gates satisfied (3/3):**
  1. ✅ Delete `.opencode/run-logs/*` — approved by user (2026-06-20)
  2. ✅ Modify `scripts/security/check-secrets.sh` — approved by user (2026-06-20)
  3. ✅ Keycloak signing secret rotation: user confirmed localhost-only, deletion sufficient; no rotation needed.
- **Path boundaries respected:** Only `.opencode/run-logs/` (deletion) and `scripts/security/check-secrets.sh` (edit) touched. No product source, schema, auth, or CI changes.
- **Forbidden paths:** None touched. `planning/`, `apps/`, `packages/`, `db/`, `infra/`, `.ui-redesign/`, `.git/` untouched.

## Repository Baseline

- **Branch:** `main`
- **Commit:** `7b19197ee7350441918035f8f02be74dff11bd27`
- **Pre-existing untracked:** `opencode-system-audit-2026-06-20.md`, `AGENT_HANDOFF_OPENCODE_SYSTEM.md`
- **Worktree: clean** except for the above two untracked files and the intended change to `check-secrets.sh`.

## Findings and Decisions

### AUD-P0-001 — Confirmed
- `cookies.txt` (604 B, Netscape cookie format, JWT session) on disk, gitignored but present.
- `api.pid` (7 B) on disk, gitignored but present.
- `api.log` (121 KB) on disk, gitignored but present.
- **Action:** All three files deleted via `rm` (without `-rf` flag, per system deny rules).

### AUD-P0-002 — Confirmed
- `check-secrets.sh:30` had `".opencode"` in `EXCLUDE_DIRS`, blanket-excluding the entire directory.
- Scanner's JWT regex would have caught `cookies.txt` if it were scannable.
- **Action:** Replaced with targeted subpath excludes: `.opencode/agents`, `.opencode/commands`, `.opencode/skills`, `.opencode/documentation`, `.opencode/benchmarks`.
- **Decision:** These five subpaths are source-controlled config full of words like "secret," "token," "credential" by design — they would generate constant false positives. `.opencode/run-logs/` is now scannable.

## Files Inspected

- `.opencode/run-logs/` — directory listing; confirmed 3 files present before deletion, empty after.
- `scripts/security/check-secrets.sh` — full file (175 lines); confirmed EXCLUDE_DIRS on line 30.
- `.gitignore` — confirmed line 48: `/.opencode/run-logs/`.

## Files Modified

1. `.opencode/run-logs/cookies.txt` — **deleted** (untracked/gitignored)
2. `.opencode/run-logs/api.pid` — **deleted** (untracked/gitignored)
3. `.opencode/run-logs/api.log` — **deleted** (untracked/gitignored)
4. `scripts/security/check-secrets.sh` — **modified** (line 30: `".opencode"` → 5 targeted subpath excludes)

## Commands and Results

| # | Command | Result | Evidence |
|---|---|---|---|
| 1 | `rm .opencode/run-logs/cookies.txt .opencode/run-logs/api.pid .opencode/run-logs/api.log` | **PASSED** | No output; files removed silently |
| 2 | `ls -la .opencode/run-logs/` | **PASSED** | Directory empty (only `.` and `..`) |
| 3 | `pnpm security:secrets` | **PASSED** | Exit 0; `No secrets detected.` |
| 4 | `git status --short` | **PASSED** | Only `scripts/security/check-secrets.sh` modified; untracked audit artifacts as expected |
| 5 | `git diff --stat` | **PASSED** | `1 file changed, 5 insertions(+), 1 deletion(-)` |
| 6 | `git diff scripts/security/check-secrets.sh` | **PASSED** | Single hunk: `".opencode"` → 5 targeted excludes |

## Acceptance-Criterion Evidence

| Criterion | Status | Evidence |
|---|---|---|
| `.opencode/run-logs/` is empty | ✅ **PASSED** | `ls -la` shows only `.` and `..` |
| `EXCLUDE_DIRS` no longer contains bare `.opencode` | ✅ **PASSED** | `git diff` confirms 5 targeted subpaths |
| `.opencode/run-logs/` is scannable | ✅ **PASSED** | Directory no longer in EXCLUDE_DIRS; scanner passes clean on empty directory |
| `pnpm security:secrets` passes | ✅ **PASSED** | Exit 0; `No secrets detected.` |

### Scanner scannability verification note

The `.opencode/run-logs/` directory is now scannable (not excluded). Because it's empty, there are no files to match. The JWT regex (`eyJ[a-zA-Z0-9_\-]+\.[a-zA-Z0-9_\-]+\.[a-zA-Z0-9_\-]+`) would catch a cookie file if one were present. Full end-to-end validation (placing a synthetic JWT in `.opencode/run-logs/test.txt` and confirming detection) is deferred to a controlled test environment per the handoff's recommendation — not appropriate for the live repo.

## Diff and Path-Boundary Review

**Single changed file:** `scripts/security/check-secrets.sh`

```diff
-  ".opencode"
+  ".opencode/agents"
+  ".opencode/commands"
+  ".opencode/skills"
+  ".opencode/documentation"
+  ".opencode/benchmarks"
```

**Path boundaries verified:**
- ✅ No changes to `planning/`, `apps/`, `packages/`, `db/`, `infra/`, `.ui-redesign/`, `.git/`
- ✅ No changes to `AGENT_HANDOFF.md` (product audit handoff preserved)
- ✅ Deleted files were gitignored per `.gitignore:48` — no tracked file was removed
- ✅ Scanner modification is within the security scripts boundary and matches the handoff's exact specification

## Required Reviewers

Per the handoff's execution plan, Phase A changes should be reviewed before proceeding to Phase B (which requires user identification of the context-pack generator location). Independent review via `/task-review AUD-OPENSYS-PHASE-A` or equivalent.

## Outstanding Work

### Phase B (deferred — requires user input)
- AUD-P0-003: Fix context-pack generator (generator location unknown — needs user identification)
- AUD-P1-001: Build ADR-0008 smoke test (`scripts/security/check-opencode-config.sh`)

### Phase C (deferred — documentation only)
- AUD-P2-003: Create `docs/workflows/repository-audit-workflow.md`
- AUD-P2-004: Extract `templates/repo-audits/opencode-system-audit-template.md`

### Phase D (deferred — polish)
- AUD-P2-001: Wire `git-quality` agent to a slash command
- AUD-P2-005: Create agent/command/skill registry
- AUD-P2-006: Permission-block regression test
- AUD-P1-002: Dev-dependency scan policy

### Run-logs directory cleanup
- The `.opencode/run-logs/` directory itself still exists (empty). This preserves the gitignore expectation and prevents future processes from failing on missing directory. If the directory should also be removed, separate approval is needed.

## Risks and Assumptions

1. **Cookie exposure window closed but residual risk remains:** The cookie was already included in `calvin-opencode-system-context-pack.md` sent to a third-party LLM. The Keycloak realm is confirmed localhost-only (`localhost:8080/realms/pia`), so blast radius is low. No rotation performed per user decision.
2. **Scanner now covers `.opencode/run-logs/`:** The directory is scannable. Future run-logs with cookies will be detected. However, the pre-export hook recommended in the handoff (purge `.opencode/run-logs/` before any export) is not yet implemented — that's a Phase B item.
3. **Context-pack generator still unchanged:** AUD-P0-003 (the root cause) is not yet fixed. Until the generator is made `git ls-files`-based, a new context pack could still export `.opencode/run-logs/` contents. The scanner would now catch them, but the generator-side gap remains.
4. **`.opencode/package.json` and `.opencode/package-lock.json`:** These are gitignored by `.opencode/.gitignore` and now fall within the scanner's scope (no longer blanket-excluded). They were not inspected for content; if they trigger false positives, a targeted exclusion can be added in a follow-up.

## Next Action

- **Phase B** — blocked pending user identification of the context-pack generator tool location (see `AGENT_HANDOFF_OPENCODE_SYSTEM.md` §Open Questions #1).
- **Independent review** — `/task-review AUD-OPENSYS-PHASE-A` or manual review of the `check-secrets.sh` diff and run-logs deletion.
- **Commit** — the `check-secrets.sh` change is uncommitted. Commit when ready with message: `fix(security): narrow secret-scanner .opencode exclude to targeted subpaths (AUD-P0-002)`.
