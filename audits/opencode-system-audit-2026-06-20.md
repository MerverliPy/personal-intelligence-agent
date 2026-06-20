# Repository Audit Report — Calvin opencode System

**Repository:** `MerverliPy/personal-intelligence-agent` (root `/home/calvin/personal-intelligence-agent-blueprint`)
**Branch / commit:** `main` @ `7b19197`
**Source artifact:** `calvin-opencode-system-context-pack.md` (generated `2026-06-20T08:18:48Z`)
**Audit date:** 2026-06-20
**Scope:** the opencode _operating system_ layer — `.opencode/`, `AGENTS.md`, `docs/`, `scripts/`, `templates/` — not the PIA product source (`apps/`, `packages/`, `db/`, `infra/`, `planning/`), which the context pack intentionally excluded.

## 0. Methodology note

You asked me to audit this against `docs/workflows/repository-audit-workflow.md` and `templates/repo-audits/opencode-system-audit-template.md`. **Neither file exists in the context pack — not in the tree listing and not in the file contents.** I searched both the 22,211-line tree summary and the included-file list; they're absent. This isn't a size-exclusion artifact (other small docs/ files came through fine), so either the paths are wrong, the files haven't been created yet, or they exist outside what this particular generator captures.

Rather than guess at their contents, I used the 13-section structure you specified directly as the de facto template, and graded findings using the same vocabulary your own `.opencode/agents/repo-auditor.md` uses internally (`P0–P3` severity, `Confirmed / Suspected / Risk / Optional`, `High/Medium/Low` confidence) so this report is consistent with how your system already talks about itself. See §11 for a proposal to formalize this as the actual missing template.

**Every finding below is sourced from file content actually present in the upload.** Where I infer rather than observe, I say so explicitly.

---

## 1. Executive Summary

This is a mature, unusually disciplined opencode configuration — 25 agents, 27 commands, 12 skills, all internally consistent with the counts your own README claims (verified, see §4). The permission model (per-agent allow/ask/deny on read/edit/bash/task/skill/webfetch) is the strongest part of the system: secret-path denials, no-delegation defaults, and untrusted-input framing are repeated deliberately across nearly every agent file.

The audit surfaced one **P0 finding that needs your attention before you generate another context pack**: a live-format session cookie and a process ID were captured into this very document, from `.opencode/run-logs/`, despite your `.gitignore` explicitly excluding that path _because_ it can contain session cookies. The root cause is structural, not careless — your secret scanner (`check-secrets.sh`) also excludes the entire `.opencode/` directory from scanning, and whatever tool generated this Markdown pack doesn't appear to honor `.gitignore` at all. Both gaps compound the same blind spot. Details and a fix in §3 and §9.

Beyond that, the system is in good shape. The main opportunities are: closing the secret-scanning blind spot, finishing the `opencode.jsonc` consolidation smoke test that ADR-0008 already commits you to, and building the generic repo-audit template/workflow pair you assumed already existed (it doesn't — building it is genuinely low-effort given how much of the pattern already exists in `repo-auditor.md`).

---

## 2. Current Strengths

**Confirmed, High confidence** (directly observed in agent frontmatter and prose):

- **Permission granularity is real, not decorative.** Every agent's YAML frontmatter declares per-path read/edit rules and per-command bash rules (allow/ask/deny), not just a mode. `delivery.md`, `git-quality.md`, `qa.md`, `reviewer.md`, `repository-integrity.md`, `repository-docs.md`, and `security.md` all independently deny `*.env`, `*.pem`, `*.key`, `*credentials*`, and `.git/**` for both read and edit — seven separate files reaching the same conclusion is a strong, consistent pattern.
- **Two-track status authority.** `planning/status.yaml` is treated as a _claim ledger_, not truth — `qa.md`, `reviewer.md`, and `repository-docs.md` all require independently persisted `PASS` evidence with SHA-256 baseline/concurrency checks before any status flip is honored. This is unusually rigorous for a solo-developer system.
- **Untrusted-content discipline is repeated at every layer.** `AGENTS.md`, `security.md`, `docs/05_SECURITY_GOVERNANCE.md`, and `docs/security/threat-model.md` all independently state the same trust boundary (user text, uploads, model/tool output, retrieved content = facts, never authority). The product threat model (TB-1–TB-7) and the agent-level untrusted-evidence framing are philosophically the same control applied to two different attack surfaces — that's good architectural consistency, not duplication.
- **Approval-gated mobile UI workflow is genuinely sophisticated.** `mobile-ui-orchestrator.md` implements a context-cache staleness counter, batch approval (max 5 items, HIGH-risk tagging), adaptive phase skipping with evidence requirements, and a three-agent Feature Critique Panel (critic/advocate/judge) — this is a well-designed multi-agent debate pattern, not just sequential delegation.
- **Documentation has its own evidence-rating system.** `repository-docs.md` + its 3 skills use an E1–E5 evidence scale and a Supported/Experimental/Partial/Planned/Deprecated/Removed/Unknown status vocabulary, with a 16-case, 100-point-rubric regression benchmark (`.opencode/benchmarks/repository-docs/`). That's CI-grade rigor for documentation, which almost no repo bothers with.
- **README claims check out.** "25 agents," "27 commands" in `README.md` — I counted the actual files and both numbers are exactly right (§4). Counts like this drift constantly in most repos; yours don't.
- **ADR discipline exists and is being used correctly.** ADR-0007 formalizes two organically-emerged path-boundary precedents instead of letting them stay tribal knowledge; ADR-0008 resolves a real `opencode.json`/`opencode.jsonc` dual-config hazard with a clear decision and rollback plan.

---

## 3. Critical Issues

### AUD-P0-001 — Live session cookie and PID captured in this context pack

**Confidence: High. Confirmed.**

`.opencode/run-logs/cookies.txt` was included in this upload's file contents and contains a Netscape-format cookie file with a `pia_session` value in JWT format (header `eyJhbGciOiJIUzI1NiJ9...`), plus `.opencode/run-logs/api.pid` containing a raw process ID. **I have not reproduced the token value anywhere in this report and will not.**

Decoding the JWT header/payload structure (without printing the value) shows it's a local dev token — issuer `http://localhost:8080/realms/pia`, subject `dev-user-1`, audience `pia-api` — so real-world blast radius is likely low _if_ this only ever runs against `localhost:8080`. But the structural problem is what matters:

1. Your `.gitignore` has the line `# opencode local run logs (may contain session cookies in cookies.txt)` immediately above `/.opencode/run-logs/` — you've already identified this exact risk and gitignored it.
2. Despite that, this file ended up in a Markdown document handed to a third-party LLM. That means the tool that generated this pack walks the filesystem directly rather than `git ls-files` / respecting `.gitignore`.
3. Separately and independently, `scripts/security/check-secrets.sh` has `.opencode` in its `EXCLUDE_DIRS` array — so even your own CI-facing secret scanner would never catch this file if it were ever committed, because it never looks inside `.opencode/` at all (see AUD-P0-002).

**Recommended action:** Treat this as a live secret until you've confirmed the realm only ever serves `localhost`/dev. Then: delete `.opencode/run-logs/*` from disk now, and fix the two root causes below before generating another context pack of any kind.

### AUD-P0-002 — Secret scanner blanket-excludes the one directory most likely to contain a secret

**Confidence: High. Confirmed, root cause of AUD-P0-001's scanner-side gap.**

`scripts/security/check-secrets.sh` excludes `.opencode` entirely:

```
EXCLUDE_DIRS=( ".git" "node_modules" ".turbo" "dist" ".next" "coverage" ".opencode" ".venv" ... )
```

This is presumably meant to skip `.opencode/agents/*.md` and similar source-controlled config (reasonable — those files are full of the words "secret," "token," "credential" by design, and would generate constant false positives). But the exclusion is directory-wide, so it also blinds the scanner to `.opencode/run-logs/`, which is the _one_ subdirectory under `.opencode/` your own `.gitignore` comment says can contain real session cookies. The scanner's pattern list already includes a generic JWT regex (`eyJ[a-zA-Z0-9_\-]+\.[a-zA-Z0-9_\-]+\.[a-zA-Z0-9_\-]+`) that would have caught this file — it's just never reached.

**Recommended fix:** Replace the blanket `.opencode` exclude with targeted excludes for the genuinely noisy subpaths only:

```
EXCLUDE_DIRS+=( ".opencode/agents" ".opencode/commands" ".opencode/skills" ".opencode/documentation" ".opencode/benchmarks" )
```

…and leave `.opencode/run-logs/` and `.opencode/package-lock.json` scannable. Better still, since `.gitignore` already excludes `run-logs/` from version control, add a pre-flight step (git hook or `package.json` script) that deletes `.opencode/run-logs/*` before any export/context-pack/audit action runs, so the directory simply doesn't exist at snapshot time.

### AUD-P0-003 — Context-pack generator does not appear to respect `.gitignore`

**Confidence: Medium. Inferred from AUD-P0-001, not directly observed (the generator's own source wasn't included in this pack).**

Two independent pieces of evidence point the same direction: (a) `.opencode/run-logs/cookies.txt` and `api.pid` are both gitignored yet both appear in this document's content section; (b) `.opencode/.gitignore` separately ignores `package.json` and `package-lock.json` within `.opencode/`, yet both also appear in full in this document. A generator that respected either gitignore file would have skipped all four. This strongly suggests the tool walks the live filesystem rather than `git ls-files --others --exclude-standard` or equivalent.

**Recommended fix:** Whatever script produces `calvin-opencode-system-context-pack.md`, make it filter through `git check-ignore` (or build its candidate list from `git ls-files` plus an explicit, audited allowlist for intentionally-untracked-but-wanted files like `.env.example`) before reading file contents. This is the single highest-leverage fix in this report — it would have prevented AUD-P0-001 regardless of the scanner gap.

---

## 4. Quick Wins

These are small, mechanical, and high-value:

1. **Delete `.opencode/run-logs/*` now.** Zero risk, closes the active exposure window. (Pairs with AUD-P0-001.)
2. **Narrow `check-secrets.sh`'s `.opencode` exclude** to the four source-controlled subpaths, per AUD-P0-002. One-line diff.
3. **Verify counts stay accurate going forward.** README's "25 agents / 27 commands" claims are correct today (confirmed by direct count against the Included File List). There's no automated check enforcing this — a 5-line CI script (`ls .opencode/agents | wc -l` compared against a grep of the README badge text) would catch drift the next time an agent file is added or removed. Cheap insurance given how much you clearly care about documentation accuracy elsewhere.
4. **`opencode.jsonc` content wasn't in this pack.** I can't audit your actual model/provider routing, default agent enforcement, or the permission merge state ADR-0008 describes, because the file itself was excluded from this context pack (it's referenced only in the tree and in ADR-0008's prose). If you want that reviewed, include it explicitly next time — see §13.
5. **`git-quality.md` has no associated slash command.** It's a `mode: primary` agent (the only one besides `delivery`, `mobile-ui-orchestrator`, and `repository-integrity`) but none of the 27 commands target it — every other primary/all-mode agent has at least one. Either that's intentional (invoke via `@git-quality` only) or it's a missing `/quality-check` command. Five-minute fix either way.
6. **ADR-0008's required smoke test doesn't appear to exist yet.** The ADR specifies a 10-point "effective-configuration smoke test" (exactly one config file, pinned version, resolved default agent, sharing disabled, etc.) as part of the _decision_, not as future work. It wasn't among the included scripts (`scripts/ci/`, `scripts/dev/`, `scripts/security/`, `scripts/git-hooks/` were all fully captured). If it exists elsewhere, point me at it; if not, it's a confirmed gap between an Accepted ADR and its implementation.

---

## 5. Structural Recommendations

- **Two parallel context-pack generators exist and appear to diverge.** The tree shows both `.chatgpt-context-pack/` (a structured, multi-file, chunked export specifically aimed at ChatGPT, with its own inventory/evidence/prompts/content layout) and whatever single-file generator produced _this_ document. Both are gitignored (untracked), so neither is reviewable, versioned, or testable, and nothing guarantees they apply the same exclusion logic — which is exactly how AUD-P0-001 happened. **Recommendation:** pick one canonical, source-controlled generator script (even a short Python/Node script under `scripts/`), make it `git ls-files`-based, and delete the other. If you genuinely need two output shapes (chunked vs. single-file) for different LLM front ends, make that a `--format` flag on one script, not two independently-maintained tools.
- **`templates/` is 100% mobile-UI-redesign-specific.** All 8 files (`approval-packet.md`, `audit-report.md`, `concept-brief.md`, `decision-ledger.md`, `device-test-report.md`, `feature-parity-matrix.md`, `handoff.md`, `implementation-contract.md`) serve the `.ui-redesign/` workflow only. There is no generic, reusable template for the _other_ major workflows your system already runs — repository audits, task run records, review records, gate records. Those currently live as embedded Markdown schemas inside the agent prompts themselves (`repo-auditor.md`'s `AGENT_HANDOFF.md` schema, `reviewer.md`'s review-record schema, `qa.md`'s gate-record schema). That works, but it means the canonical schema is buried 200+ lines into an agent's system prompt instead of being a reviewable, diffable, standalone file. See §11.
- **No top-level system registry/index.** With 25 agents, 27 commands, and 12 skills, there's no single file enumerating name → mode → permission-tier → primary-vs-hidden → invoked-by. Today that map only exists implicitly (you'd have to grep every frontmatter block to reconstruct it, which is what I did for this audit). `README.md`'s tables only cover the mobile-UI command subset, not the full system.
- **Permission-block duplication across 7 agent files.** The identical `*.env`/`*.pem`/`*.key`/`*credentials*`/`.git/**` deny block appears nearly verbatim in `delivery.md`, `git-quality.md`, `qa.md`, `reviewer.md`, `repository-integrity.md`, `repository-docs.md`, and `security.md`. This is good defense-in-depth (each agent is independently safe even if another file gets corrupted), but it's also a place where a future edit could silently drift — if you patch the deny list in one file during a security fix and forget the other six, you've reintroduced the exact class of gap found in §3. Worth a regression test (see §8) even if you keep the duplication intentionally.

---

## 6. opencode Agent Review

**Confirmed inventory: 25 agents** (matches `README.md`'s claim exactly).

| Category                                 | Agents                                                             | Mode pattern                                                                                                                                                                             |
| ---------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Planning ledger (status-authoritative)   | `qa`, `reviewer`                                                   | `subagent`, strict hash-checkpointed status writes, the only two agents with `planning/status.yaml: allow` edit scope                                                                    |
| Implementation                           | `delivery`, `frontend-implementer`, `backend-integration-engineer` | edit `ask`, `task: deny` (no further delegation)                                                                                                                                         |
| Repository hygiene                       | `git-quality`, `repository-integrity`, `repo-auditor`              | bash-heavy with explicit deny-lists; `repo-auditor` has by far the most exhaustive bash deny list of any agent (32+ explicit denials covering every major package manager and cloud CLI) |
| Documentation                            | `repository-docs` (`mode: all`)                                    | only agent invocable directly, as subtask, or via 5 dedicated commands                                                                                                                   |
| Mobile UI redesign orchestration         | `mobile-ui-orchestrator` (primary) + 13 `hidden: true` specialists | orchestrator alone can `task:` into named specialists; specialists themselves all deny `task`                                                                                            |
| Feature Critique Panel                   | `feature-advocate`, `feature-critic`, `feature-judge`              | all `hidden: true`, `bash: deny` entirely (pure analysis agents, no shell at all — notably stricter than every other agent)                                                              |
| Security/architecture review (read-only) | `architect`, `data-modeler`, `security`                            | `edit: deny` outright, not just `ask`                                                                                                                                                    |

**Confirmed pattern strength:** every `hidden: true` mobile-UI specialist (`accessibility-performance-validator`, `design-system-architect`, `evidence-regression-controller`, `iphone-interaction-specialist`, `product-ux-analyst`, `real-ui-product-tester`, `repository-discovery`, `visual-concept-prototyper`, `workflow-improvement-reviewer`, plus the panel three) opens with the identical 5-step "Context loading" preamble referencing `.ui-redesign/state/CONTEXT_CACHE.md` staleness rules. That's 10+ files independently agreeing on the same caching contract — strong consistency, low risk of drift because it's short and copy-pasted identically rather than paraphrased.

**Suspected gap (Medium confidence):** `git-quality` (mode: `primary`) has no command wired to it (§4, item 5) and isn't in `mobile-ui-orchestrator`'s allowed `task` list either — it appears to be a standalone entry point only, which may be intentional but isn't documented anywhere as such.

**Inconsistency (Low severity, P3):** `repo-auditor`'s bash deny-list (curl/wget/ssh/scp/rsync/docker/kubectl/terraform/every package manager) is far more exhaustive than the equivalent lists in `delivery.md` or `repository-integrity.md`, even though those two agents have _more_ privilege (`edit: ask` vs. `repo-auditor`'s `edit: deny` everywhere except `AGENT_HANDOFF.md`). The asymmetry is mitigated by `bash: '*': ask` as a catch-all in every agent, but the higher-privilege agents would benefit from the same explicit belt-and-suspenders list `repo-auditor` already proved out.

---

## 7. opencode Command Review

**Confirmed inventory: 27 commands** (matches README exactly), cleanly split:

- **5 documentation commands** (`docs-audit/changed/release/update/verify`) — all route to `repository-docs`, mode names map 1:1 to the agent's internal AUDIT/CHANGED/RELEASE/UPDATE/VERIFY modes. Clean, minimal-surface design — each command file is under 25 lines and just sets the mode + passes `$ARGUMENTS`.
- **13 mobile-UI commands** — all route to `mobile-ui-orchestrator`. `mobile-ui-approve-batch.md` and `mobile-ui-critique.md` are the most procedurally detailed (explicit step lists), appropriately so since they coordinate multi-agent flows (batch approval, the 3-agent panel).
- **9 governance/delivery commands** (`phase-gate`, `phase-plan`, `project-analyze`, `project-status`, `repo-audit`, `repo-repair`, `security-review`, `task-review`, `task-run`) — every one that takes a task/phase ID enforces the ID pattern (`P[0-7]` or `P[0-7]-T[0-9][0-9]`) and explicitly states "do not auto-include the full backlog," a deliberate, repeated token-discipline pattern.

**Confirmed strength:** every command-to-agent mapping I checked is referentially correct — no command points at a nonexistent agent name, and every `agent:` value in frontmatter matches an actual file under `.opencode/agents/`. There's no automated test enforcing this today (see §8), but it's currently accurate.

**Confirmed gap:** `repo-audit.md` invokes `repo-auditor` to maintain `AGENT_HANDOFF.md` only — there is no equivalent slash command for _applying_ a generic, non-mobile-UI fix once `AGENT_HANDOFF.md` exists, other than `repo-repair.md` → `repository-integrity`, which does cover that. So the audit→repair pair is actually complete; what's missing is purely the **template** for the audit output itself (§5, §11), not a workflow gap.

---

## 8. opencode Skill Review

**Confirmed inventory: 12 skills.**

| Skill                                                  | Loaded by                                                                  | Purpose                                    |
| ------------------------------------------------------ | -------------------------------------------------------------------------- | ------------------------------------------ |
| `approval-gated-redesign`                              | implied via mobile-UI agents                                               | enforces decision-packet/approval contract |
| `database-migration`                                   | `delivery`, `data-modeler`, `repository-integrity` (ask), `task-execution` | additive-migration discipline              |
| `design-contract`                                      | `design-system-architect`                                                  | token/component/state schema               |
| `evidence-bundle`                                      | evidence-regression-controller path                                        | redacted evidence manifest assembly        |
| `iphone-16-pro-pwa`                                    | iPhone specialists                                                         | device-specific design rules               |
| `real-ui-validation`                                   | testing specialists                                                        | bans mock-only acceptance evidence         |
| `repository-adapter`                                   | `repository-discovery`                                                     | repo-detection schema                      |
| `repository-docs-analysis` / `-update` / `-validation` | `repository-docs` only                                                     | the 3-stage documentation pipeline         |
| `retrieval-quality`                                    | `delivery` (ask)                                                           | product-level RAG quality rules            |
| `task-execution`                                       | `delivery`                                                                 | the canonical single-task contract         |

**Confirmed strength:** skill access is tightly scoped — most agents `deny` all skills except an explicit allowlist (`delivery.md`: `task-execution: allow, database-migration: ask, retrieval-quality: ask`, everything else implicitly denied via the `'*': deny` default). This is the same allowlist-over-blocklist discipline seen in the permission model generally.

**Suspected gap (Medium confidence):** `approval-gated-redesign` is described in `documentation` as the governing skill for any design-affecting task, but I could not find an explicit `skill: allow` reference to it in any single agent's frontmatter in the content I reviewed (it may be loaded implicitly by `mobile-ui-orchestrator`'s broad `skill: allow`, which is plausible given the orchestrator's permissive skill block — flagging as worth a one-line confirmation rather than a defect).

**Opportunity:** there's no skill analogous to `repository-docs-analysis/-update/-validation` for the _audit_ workflow — i.e., a `repository-audit-analysis` / `repository-audit-execution` skill pair that `repo-auditor` and `repository-integrity` could load, the way `repository-docs` loads its three skills. Right now `repo-auditor.md`'s entire audit methodology (inventory → map → inspect → validate → investigate → plan, evidence classification, AGENT_HANDOFF.md schema) is inlined in the agent file itself rather than factored into a reusable skill. Factoring it out would let other agents (e.g., a future `repository-integrity` self-check, or `repository-docs`'s own audit mode) reuse the same evidence-classification vocabulary without re-deriving it.

---

## 9. Security and Hygiene Review

**Critical (P0):** AUD-P0-001, AUD-P0-002, AUD-P0-003 — see §3. These are the headline findings of this audit.

**Confirmed strengths:**

- `docs/05_SECURITY_GOVERNANCE.md` and `docs/security/threat-model.md` are unusually thorough for a solo/private repo — 7 trust boundaries (TB-1–TB-7), 10 threat scenarios each with explicit controls and severity, an approval matrix distinguishing Allow/Approval-required/Prohibited by operation type, and a documented residual-risk section (compromised OIDC provider, compromised DB superuser, provider prompt-logging) rather than pretending residual risk is zero.
- `security.md` enforces a machine-readable verdict contract (`SECURITY_VERDICT: PASS|FAIL|UNAVAILABLE` as the mandatory first line) — this is exactly the kind of structured-output discipline that makes an agent's output programmatically checkable rather than relying on prose parsing.
- `docs/security/review-checklist.md` maps security-sensitive task categories (auth/tenancy/uploads/retrieval/memory/tools/approvals/secrets) to specific task IDs and an 8-section checklist — concrete and auditable, not aspirational.
- `check-secrets.sh`'s pattern list is reasonably comprehensive (AWS keys, private key headers, generic API-key/secret/password/token assignment patterns, JWTs, GitHub tokens, Stripe keys, DB URLs with embedded credentials) and its false-positive filter list is well-reasoned (it specifically excludes things like `Redacted`-wrapper usage and `SECRET_FIELD_NAMES` constant declarations, which is exactly the right kind of targeted suppression — contrast with the directory-wide `.opencode` exclusion, which is the wrong kind).
- `pre-push` git hook runs format/lint/secrets/typecheck before every push to `main`, fast-failing in the right order (cheapest checks first).

**Confirmed gap:** the dependency scanner (`check-dependencies.sh`) runs `pnpm audit --prod` only — dev dependencies are explicitly excluded "because they do not ship to production." That's a defensible policy for _runtime_ supply-chain risk, but it leaves dev-tooling supply-chain risk (e.g., a compromised build/lint/test package, which is a real and increasingly common attack vector) entirely unscanned. Worth a documented, deliberate accept-the-risk note if that's the intent, since right now it reads as an oversight rather than a decision.

**Unable to verify (flagged, not assumed):** I cannot confirm the current resolved state of `opencode.jsonc` (default agent, secret-path protections, task/skill denial) because the file's content wasn't included in this pack — only ADR-0008's _description_ of it was. Given ADR-0008 is dated `2026-06-17` (3 days before this pack was generated) and its own required smoke test doesn't appear to exist in the scripts I reviewed, I'd treat the consolidation as **plausibly complete but not independently verified** rather than confirmed.

---

## 10. Documentation Review

**Confirmed strength, High confidence:** This is the best-documented part of the system. `AGENTS.md` is concise (under 6KB) and covers workflow, completion states, engineering rules, verification order, prohibited actions, and documentation-maintenance delegation in one readable pass. `README.md` is long (40KB) but well-organized with collapsible sections, and — critically — its specific, checkable claims (agent/command counts, phase progress, script names) all matched what's actually in the repository wherever I could verify them.

The **evidence-rating system** (E1 Verified → E5 Contradicted/Unknown) paired with the **feature-status vocabulary** (Supported/Experimental/Partial/Planned/Deprecated/Removed/Unknown) in `repository-docs.md` and its skills is genuinely sophisticated — it's the kind of system that prevents the single most common form of repo rot (README claims a feature works because someone started building it, not because it's actually verified). The fact that it's backed by a 16-case, scored regression benchmark (`.opencode/benchmarks/repository-docs/`) with named release-blocker cases (2–6, 10–14) means this isn't just policy prose, it's testable policy.

**Confirmed gap:** `docs/REPOSITORY_DOCUMENTATION_WORKFLOW.md` documents the `repository-docs` system thoroughly but there is no equivalent `docs/REPOSITORY_AUDIT_WORKFLOW.md` documenting the `repo-auditor` / `repository-integrity` / `git-quality` triad the same way — which is very likely the actual source of the `docs/workflows/repository-audit-workflow.md` reference in your original request. It's a natural, half-built gap: the pattern exists for documentation maintenance and not (yet) for repository auditing, even though the underlying agents already exist.

**Minor inconsistency (P3):** ADR-0008 states the canonical config "will preserve... explicit read-only tool allowances for: `glob`, `grep`, `list`, `lsp`, `todowrite`, `question`" — but I can't cross-check this against `opencode.jsonc` itself since it wasn't included. Flagging only so it's not silently assumed correct.

---

## 11. Recommended New Files

In priority order:

1. **`docs/workflows/repository-audit-workflow.md`** — document the `repo-auditor` → `AGENT_HANDOFF.md` → (human review) → `repo-repair` → `repository-integrity` cycle the same way `REPOSITORY_DOCUMENTATION_WORKFLOW.md` documents the docs cycle: components, commands table, recommended first run, safety model, validation. This closes the exact gap your original request assumed was already closed.
2. **`templates/repo-audits/opencode-system-audit-template.md`** — extract `repo-auditor.md`'s embedded `AGENT_HANDOFF.md` schema (Audit Summary / Repository Map / Validation Results / Findings Summary / Detailed Findings / Suspected Issues and Risks / Execution Plan / Final Verification Checklist / Deferred-Blocked-Rejected / Open Questions / Implementation Agent Starting Point) into a standalone file, the same way `templates/audit-report.md` already exists for the mobile-UI track. This report follows that shape loosely already — formalizing it would make `repo-auditor` reference an external template instead of carrying 200+ lines of schema inline, and would make future schema changes diffable.
3. **A repository-level agent/command/skill registry** (e.g., `.opencode/REGISTRY.md` or a generated `MANIFEST.md` section) — name, mode, hidden/visible, permission tier, primary invoker(s). Could be hand-maintained like everything else here, or generated by a short script run as part of `repository-docs`' own audit (it already has the file-walking infrastructure).
4. **`scripts/security/check-opencode-config.sh`** — implements ADR-0008's 10-point smoke test, run in CI and pre-push, closing the Accepted-but-unimplemented gap in §4/§9.
5. **A single, source-controlled, `.gitignore`-aware context-pack generator** replacing whatever currently produces both this document and `.chatgpt-context-pack/` — see §5.
6. **`.opencode/skills/repository-audit-analysis/SKILL.md`** (and optionally `-execution`) — factor `repo-auditor`'s methodology out of the agent prompt into a reusable skill, mirroring the `repository-docs-*` pattern (§8).

---

## 12. Prioritized Execution Plan

**Phase A — Stop the bleeding (today, ~30 min):**

- Delete `.opencode/run-logs/*` from disk.
- If there's any chance that Keycloak realm ever runs against anything other than localhost, rotate the dev signing secret / invalidate the session.
- Patch `check-secrets.sh`'s `.opencode` exclusion to the four source-controlled subpaths only (AUD-P0-002).

**Phase B — Close the structural gap (this week):**

- Identify/inspect whatever currently generates context packs; make it `git ls-files`-based or `git check-ignore`-filtered (AUD-P0-003).
- Add a pre-export hook that purges `.opencode/run-logs/` before any pack/audit/export action.
- Build and run ADR-0008's smoke test script; confirm `opencode.jsonc` is actually in the state the ADR claims.

**Phase C — Fill the documented gap (next session with this assistant or with opencode itself):**

- Write `docs/workflows/repository-audit-workflow.md`.
- Extract `templates/repo-audits/opencode-system-audit-template.md` from `repo-auditor.md`'s embedded schema.
- Wire `repo-auditor.md` to reference the new template instead of inlining it (optional but cleaner).

**Phase D — Polish (low urgency):**

- Add a `/quality-check` (or similar) command wired to `git-quality`, or document why it's intentionally command-less.
- Add a registry/manifest file or section enumerating all 25/27/12 agents/commands/skills.
- Add a CI assertion that README's stated agent/command counts match the actual file counts.
- Decide and document whether dev-dependency supply-chain risk is accepted or should be scanned.

---

## 13. Clarification Defaults

**1. Should I draft the missing `docs/workflows/repository-audit-workflow.md` and `templates/repo-audits/opencode-system-audit-template.md` right now, in this conversation?**

- (a) **Yes, draft both now, based on §11's outline** — fastest path to closing the gap that triggered this audit. _(recommended)_
- (b) No — you'll write them yourself using §11 as a spec.
- (c) Draft only the template; the workflow doc can wait.

**2. Should I treat `.opencode/run-logs/cookies.txt`'s token as compromised and walk through rotation steps, or is this confirmed localhost-only and safe to just delete?**

- (a) **Treat it as compromised, rotate, then delete** — safest default for anything that left your machine. _(recommended)_
- (b) It's confirmed dev-only/localhost-only — just delete, no rotation needed.

**3. For Phase B, do you want me to inspect/write the actual context-pack generator script (if you can point me at it or paste it), or just hand off the requirements from §5/§9 for you to implement?**

- (a) **Paste or point me at the generator script next — I'll patch it directly.** _(recommended, since this is the highest-leverage fix in the whole report)_
- (b) I'll handle the generator myself; just give me the requirements (already in §5/§9).

**4. Want this report itself committed into the repo as the first real audit artifact (e.g., under a new `audits/` directory), once the template/workflow pair exists?**

- (a) **Yes — once Phase C exists, file this report as the first example under it.** _(recommended — gives the new template an immediate worked example)_
- (b) No, keep it out-of-band.
