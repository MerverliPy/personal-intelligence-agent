# Repository Audit F-003: Enforce default-branch merge governance

**Task ID:** REPO-AUDIT-F-003
**Source Finding:** External repository audit `F-003`
**Final State:** DONE
**Date:** 2026-06-17
**Base Commit:** `39f0d5097c71ddb41961bec95bf5e5d9bcd5b415`
**Branch:** `audit/F-003-enforce-main-governance`

---

## Repository State Inspected

- Updated `main` after merge of F-002 at
  `39f0d5097c71ddb41961bec95bf5e5d9bcd5b415`
- Authoritative audit finding:
  `F-003 — Default branch has no branch protection, ruleset, or required status checks`
- `.github/workflows/ci.yaml`
- Hosted repository rulesets, branch protection, collaborators, permissions,
  commit check runs, and Actions policy
- Existing repository governance files and issue templates
- Namespace check: the repository-local `audit-findings.log.md` already uses
  bare `F-003` for the logout revocation defect, so this run uses the
  namespaced ID `REPO-AUDIT-F-003` while preserving the external audit finding
  identifier.

---

## Missing Capability Reproduced

Before remediation:

- `main` had no classic branch protection.
- The repository had no active rulesets.
- No status checks or reviews were required before merging.
- Force pushes and branch deletion were not restricted by a branch rule.
- `.github/CODEOWNERS` did not exist.
- The repository had only one collaborator, `MerverliPy`, with administrator
  access.

This allowed a maintainer credential to update `main` without an independently
validated pull request.

---

## Files Changed

### New Files

| File                                | Description                                          |
| ----------------------------------- | ---------------------------------------------------- |
| `.github/CODEOWNERS`                | Defines default and sensitive-path review ownership  |
| `planning/runs/REPO-AUDIT-F-003.md` | Records repository and hosted-governance remediation |

No application, workflow, dependency, database, or API files were changed.

---

## Hosted Repository Configuration

A repository ruleset was created with these properties:

| Property                         | Value               |
| -------------------------------- | ------------------- |
| Ruleset name                     | `main-merge-safety` |
| Ruleset ID                       | `17802842`          |
| Target                           | Branch              |
| Ref condition                    | Default branch      |
| Enforcement                      | Active              |
| Required pull request            | Yes                 |
| Required approving reviews       | 1                   |
| Dismiss stale approvals          | Yes                 |
| Require code-owner review        | Yes                 |
| Require review-thread resolution | Yes                 |
| Require last-push approval       | No                  |
| Required status check            | `Quality Gates`     |
| Required status check            | `Security Checks`   |
| Require branch to be current     | Yes                 |
| Block deletion                   | Yes                 |
| Block non-fast-forward updates   | Yes                 |

The only current collaborator is the repository owner. To avoid permanently
deadlocking this single-maintainer repository, that user has a narrowly scoped
`pull_request` bypass actor entry. This permits bypass only through a pull
request; it does not authorize direct pushes to `main`.

A JSON export of the disabled pre-activation ruleset was stored outside the
repository for rollback.

---

## CODEOWNERS Policy

`.github/CODEOWNERS` assigns the repository owner as the default reviewer and
explicitly identifies security-, automation-, authentication-, data-, and
release-sensitive paths, including:

- `.github/`
- `apps/api/`
- `packages/auth/`
- `packages/config/`
- `packages/knowledge/`
- `infra/`
- `compose.yaml`
- root OpenCode configuration
- `.opencode/`

GitHub reads `CODEOWNERS` from the pull request base branch. Code-owner matching
becomes fully effective after this change reaches `main`.

---

## Design Decisions and Assumptions

1. **Use a repository ruleset rather than classic branch protection**

   Rulesets provide one auditable configuration for PR requirements, required
   checks, deletion protection, non-fast-forward protection, and scoped bypass
   actors.

2. **Require the exact existing CI check names**

   The current successful GitHub Actions check runs are:

   - `Quality Gates`
   - `Security Checks`

   The ruleset uses those exact contexts.

3. **Use a PR-only owner bypass**

   A one-approval rule cannot normally be satisfied by the author in a
   single-collaborator repository. The owner bypass is therefore restricted to
   `pull_request` mode, preserving the prohibition on direct pushes.

4. **Require code-owner review**

   Sensitive paths receive explicit ownership, while the wildcard entry ensures
   every repository path has an owner.

5. **Keep F-003 narrowly scoped**

   General contribution, conduct, vulnerability-reporting, and issue-template
   files are governed by other audit findings and were not added here.

---

## Commands Run and Results

| Validation                        | Result                                                           | Status     |
| --------------------------------- | ---------------------------------------------------------------- | ---------- |
| Inspect classic branch protection | GitHub returned `404 Branch not protected` before remediation    | REPRODUCED |
| Inspect repository rulesets       | No rulesets existed before remediation                           | REPRODUCED |
| Inspect active rules on `main`    | No active rules existed before remediation                       | REPRODUCED |
| Inspect repository collaborators  | Only `MerverliPy` with admin access                              | PASS       |
| Verify CODEOWNERS account         | `MerverliPy` resolves to an active GitHub user                   | PASS       |
| Inspect current check runs        | `Quality Gates` and `Security Checks` completed successfully     | PASS       |
| Create ruleset disabled           | Ruleset ID `17802842` stored with intended configuration         | PASS       |
| Export rollback configuration     | Disabled ruleset JSON preserved outside repository               | PASS       |
| Activate ruleset                  | Enforcement changed to `active`                                  | PASS       |
| Inspect active rules on `main`    | PR, review, check, deletion, and non-fast-forward rules returned | PASS       |
| `git diff --check`                | No whitespace errors                                             | PASS       |

---

## Acceptance-Criterion Evidence

### AC1: Changes to `main` require pull requests

The active `pull_request` rule applies to the default branch.

### AC2: Review is required on the non-bypass path

The default path requires one approving review, dismisses stale approvals,
requires code-owner review, and requires all review threads to be resolved.
The repository owner may bypass these requirements only while merging through
a pull request; direct pushes remain outside the bypass scope.

### AC3: CI checks are required

The ruleset requires successful completion of:

- `Quality Gates`
- `Security Checks`

Strict status-check policy requires the pull request branch to be current with
the target branch.

### AC4: Destructive branch operations are restricted

The active ruleset contains:

- `deletion`
- `non_fast_forward`

These rules protect against branch deletion and force-push history rewrites.

### AC5: Sensitive paths have explicit owners

`.github/CODEOWNERS` provides default ownership and explicit ownership for
security- and release-sensitive paths.

---

## Security and Privacy Impact

| Area                      | Impact                                                       |
| ------------------------- | ------------------------------------------------------------ |
| Direct updates to `main`  | Blocked by active PR governance                              |
| Independent validation    | Default path requires review and CI; owner bypass is PR-only |
| Sensitive paths           | Explicit CODEOWNERS coverage added                           |
| Force pushes              | Blocked                                                      |
| Branch deletion           | Blocked                                                      |
| Bypass scope              | Limited to owner actions performed through a pull request    |
| Secrets and personal data | None added                                                   |
| Application runtime       | Unchanged                                                    |

---

## Database and API Compatibility Impact

- No database schema or migration changes.
- No request or response contract changes.
- No runtime application behavior changes.
- No dependency or lockfile changes.
- No GitHub Actions workflow changes.

---

## Rollback

1. Export the current active ruleset.
2. Restore the preserved disabled ruleset configuration or change enforcement
   to `disabled`.
3. Correct only the rule causing operational failure where possible.
4. Retain pull-request, deletion, and non-fast-forward protections unless they
   are themselves the verified failure source.
5. Revert the repository commit to remove `CODEOWNERS` only when ownership
   configuration is the verified failure source.

---

## Remaining Risks and Follow-up Tasks

1. **Single-maintainer governance**

   Independent human approval is unavailable until another trusted collaborator
   is added. The PR-only owner bypass prevents deadlock but retains high trust in
   the owner account.

2. **Account security**

   Administrator account hardening, phishing resistance, and recovery controls
   remain outside this repository change.

3. **Additional CI gates**

   F-006 must add the integration, governance, end-to-end, and security gates
   identified by the audit. Their exact stable names should then be added to the
   ruleset.

4. **Actions hardening**

   F-005 must pin Actions and restrict the repository Actions policy.

5. **CODEOWNERS activation**

   GitHub reads CODEOWNERS from the base branch, so code-owner matching becomes
   fully effective when this pull request is merged into `main`.
