# Phase B Execution Plan — Close the Structural Gap

**Status:** `PLANNED` — awaiting authorization to execute
**Source handoff:** `AGENT_HANDOFF_OPENCODE_SYSTEM.md` §Phase B
**Findings targeted:** AUD-P0-003, AUD-P1-001
**Date:** 2026-06-20

---

## Pre-execution discoveries

### AUD-P0-003 — Context-pack generator

**Generator identified (partial):**

| Generator                              | Location                                                                              | Status                                         |
| -------------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `gather-chatgpt-repo-context.sh 1.0.0` | `/home/calvin/personal-intelligence-agent-audit-tools/gather-chatgpt-repo-context.sh` | **External to workspace** — cannot read/modify |
| Copy 1                                 | `/home/calvin/test/gather-chatgpt-repo-context.sh`                                    | External                                       |
| Copy 2                                 | `/home/calvin/test/BenchDeck/gather-chatgpt-repo-context.sh`                          | External                                       |
| Unknown single-file generator          | Produces `calvin-opencode-system-context-pack.md`                                     | **NOT FOUND**                                  |

**What we know:**

- `.chatgpt-context-pack/` exists in the repo (gitignored, generated Jun 18)
- It contains a structured, multi-file, chunked export (00-start-here through 05-security)
- A `.generated-by-gather-chatgpt-repo-context` marker file confirms the tool
- The single-file generator that produced the audit's source artifact is still unknown
- **Critical:** Both generators are external to the workspace; the Delivery Agent cannot read or modify them directly

### AUD-P1-001 — ADR-0008 smoke test

**ADR-0008 located:** `docs/adr/0008-canonical-opencode-project-configuration.md` (Accepted 2026-06-17)

**ADR compliance check against live `opencode.jsonc`:**

| #   | ADR Requirement                     | Expected                                                             | Actual (`opencode.jsonc`)                              | Status          |
| --- | ----------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------ | --------------- |
| 1   | Exactly one root config             | `opencode.jsonc` only                                                | ✅ `opencode.jsonc` only; `opencode.json` removed      | ✅              |
| 2   | OpenCode version `1.17.7`           | Pinned in `package.json`                                             | ✅ `"opencode-ai": "1.17.7"` in root `package.json:32` | ✅              |
| 3   | Default agent `plan`                | `"default_agent": "plan"`                                            | ❌ `"default_agent": "delivery"`                       | **DISCREPANCY** |
| 4   | Sharing disabled                    | `"share": "disabled"`                                                | ✅ `"share": "disabled"`                               | ✅              |
| 5   | Required instruction files loaded   | AGENTS.md, REPOSITORY_ADAPTER.md, DECISION_LEDGER.md                 | ✅ All three in `instructions` array                   | ✅              |
| 6   | Task denied                         | `"task": "deny"`                                                     | ✅ `"task": "deny"`                                    | ✅              |
| 7   | Skill denied                        | `"skill": "deny"`                                                    | ✅ `"skill": "deny"`                                   | ✅              |
| 8   | External-directory denied           | `"external_directory": "deny"`                                       | ✅ `"external_directory": "deny"`                      | ✅              |
| 9   | Protected read/edit patterns denied | `*.env`, `*.pem`, `*.key`, `*credentials*`, `.git/**` denied         | ✅ All present in `read` and `edit` deny blocks        | ✅              |
| 10  | Destructive commands denied         | `git push/reset/clean/restore`, `rm -rf`, `sudo`, `npm/pnpm publish` | ✅ All present in `bash` deny block                    | ✅              |
| 11  | Read-only tools allowed             | `glob`, `grep`, `list`, `lsp`, `todowrite`, `question`               | ✅ All six present as `allow`                          | ✅              |

**Discrepancy:** ADR-0008 §Decision specifies `default_agent: "plan"`, but the live `opencode.jsonc` has `default_agent: "delivery"` (line 5). This must be resolved before the smoke test can be built:

- Either the ADR is outdated and `delivery` is the correct, post-decision value, OR
- The `opencode.jsonc` was modified after ADR acceptance without updating the ADR.

---

## Execution Steps

### Step B.1 — Resolve the `default_agent` discrepancy

**Owner:** User decision required
**Duration:** 5 min

The ADR says `plan`; the config says `delivery`. One of them is wrong. Options:

**(a) Update `opencode.jsonc` to match ADR:** Change `"default_agent": "delivery"` → `"default_agent": "plan"` (line 5). This makes the live config match the accepted ADR.

**(b) Update ADR-0008 to match config:** Change ADR §Decision to `default_agent: "delivery"`. This documents the actual implemented decision.

**(c) Both are intentionally different:** The ADR defined the consolidation; a separate decision later changed the default agent. If so, document the change with a date and reference in the ADR's Status section.

**Recommendation:** (a) — align config to ADR. The ADR was explicitly accepted and is the authoritative decision record.

### Step B.2 — Build the ADR-0008 smoke test script

**Owner:** Delivery Agent (ready to execute)
**Duration:** 30 min
**Prerequisite:** Step B.1 resolved

Create `scripts/security/check-opencode-config.sh` implementing the 10-point (now 11-point) smoke test. The script will:

1. Assert exactly one root OpenCode config exists (`opencode.jsonc` only; no `opencode.json`)
2. Assert `opencode-ai` is pinned to `1.17.7` in `package.json`
3. Assert `default_agent` is the resolved value (from Step B.1)
4. Assert `share` is `disabled`
5. Assert all required instruction files are loaded
6. Assert `task` is `deny`
7. Assert `skill` is `deny`
8. Assert `external_directory` is `deny`
9. Assert protected read/edit patterns are denied (`.env`, `.pem`, `.key`, `*credentials*`, `.git/**`)
10. Assert destructive/publishing commands are denied in bash block
11. Assert expected read-only tools (`glob`, `grep`, `list`, `lsp`, `todowrite`, `question`) are `allow`

**Implementation approach:** Bash script using `jq` to parse `opencode.jsonc` (strip comments first). Each assertion exits non-zero on failure with a clear message.

### Step B.3 — Wire smoke test into CI

**Owner:** Delivery Agent (ready to execute)
**Duration:** 10 min
**Prerequisite:** Step B.2 complete

- Add `bash scripts/security/check-opencode-config.sh` to `scripts/ci/check-all.sh` (between secrets and dependencies checks)
- Add to `scripts/git-hooks/pre-push` (after secrets check)
- Run `pnpm ci:check` to verify integration

### Step B.4 — Fix context-pack generator (AUD-P0-003)

**Owner:** User + Delivery Agent
**Duration:** Variable
**Prerequisite:** User must provide the single-file generator location OR authorize creating a new canonical generator

**Option A — Patch the existing generator (if user provides location):**

1. Read the generator script (requires external_directory exemption or user copy into repo)
2. Add `git ls-files`-based filtering before reading file contents
3. Add an explicit allowlist for intentionally-untracked files (`.env.example`)
4. Add a pre-export hook: `rm -rf .opencode/run-logs/*` before any export

**Option B — Create a new canonical generator under `scripts/`:**

1. Write `scripts/dev/generate-context-pack.sh` — a new, source-controlled script
2. Build file list from `git ls-files` plus explicit allowlist
3. Purge `.opencode/run-logs/*` before collecting files
4. Support `--format` flag for single-file vs. chunked output
5. Delete `.chatgpt-context-pack/` after successful migration
6. Update `.gitignore` to remove `.chatgpt-context-pack*` entries (generator output now source-controlled)

**Recommendation:** Option B — a source-controlled, `git ls-files`-based generator is the permanent fix. The external `gather-chatgpt-repo-context.sh` cannot be trusted because it lives outside version control and ignores gitignore.

### Step B.5 — Add pre-export safety hook

**Owner:** Delivery Agent (ready to execute)
**Duration:** 5 min
**Prerequisite:** Step B.4 complete

Add to the generator script (or as a standalone pre-export hook):

```bash
# Purge run-logs before any context-pack export
if [ -d ".opencode/run-logs" ]; then
  rm -f .opencode/run-logs/*
fi
```

### Step B.6 — Validate and commit

**Owner:** Delivery Agent
**Duration:** 15 min

Validation:

```bash
# Smoke test
bash scripts/security/check-opencode-config.sh   # Exit 0

# Verify context-pack generator excludes gitignored files
# (generate a pack and grep for known gitignored paths)

# CI simulation
pnpm ci:check                                     # All checks pass

# Standard quality gates
pnpm format:check
pnpm lint
```

---

## Approval gates for Phase B

| Step | Requires approval                                  | Why                                          |
| ---- | -------------------------------------------------- | -------------------------------------------- |
| B.1  | **User decision**                                  | `default_agent` discrepancy is architectural |
| B.2  | Yes                                                | New CI script creation                       |
| B.3  | Yes                                                | Modifying CI pipeline and pre-push hook      |
| B.4  | **User provides generator OR authorizes Option B** | External tool access or new script creation  |
| B.5  | Yes (bundled with B.4)                             | Safety hook is part of generator fix         |
| B.6  | No (validation only)                               | Read-only checks                             |

---

## Rollback

- **Smoke test script (B.2/B.3):** Remove from `check-all.sh` and `pre-push`; delete `check-opencode-config.sh`. Revert `opencode.jsonc` change (if any from B.1).
- **Generator (B.4/B.5):** If Option A — revert the generator patch. If Option B — delete `scripts/dev/generate-context-pack.sh`; restore `.chatgpt-context-pack/` from backup (it was gitignored, so git can't restore it; user may need to regenerate).
- **All Phase B changes are independent of Phase A/C — no cross-phase rollback required.**

---

## Open question

**Where is the single-file context-pack generator?** The audit's source artifact (`calvin-opencode-system-context-pack.md`) was produced by a tool that is NOT `gather-chatgpt-repo-context.sh` (which produces the `.chatgpt-context-pack/` structured format). The user must identify this second generator before AUD-P0-003 can be fully closed. Until then, the structural gap (generator ignores gitignore) persists for that tool.
