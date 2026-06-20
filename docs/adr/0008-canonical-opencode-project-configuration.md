# ADR-0008: Canonical OpenCode project configuration

- Status: Accepted
- Date: 2026-06-17
- Approved by: Repository owner
- Approved at: 2026-06-17T19:17:43Z
- Related finding: REPO-AUDIT-F-004
- Related redesign blocker: B-4

## Context

The repository currently contains both `opencode.json` and `opencode.jsonc`.
They define materially different defaults and permissions:

- `opencode.json` selects `mobile-ui-orchestrator`, supplies project instruction
  files, permits several read-only tools, permits skills, and requires approval
  for delegated tasks.
- `opencode.jsonc` selects `plan`, applies path-sensitive secret protections,
  denies skills and delegated tasks, and blocks destructive or publishing
  commands.

OpenCode 1.17.7 merges both project files. The currently resolved configuration
therefore contains values from both files, with `opencode.jsonc` overriding
conflicting values.

This makes repository policy dependent on undocumented merge behavior. A
maintainer can edit one file believing it is authoritative while the other file
changes the effective result.

The repository documentation already instructs operators to start in the
default `plan` agent. The external repository audit also recommends retaining
the stricter permission baseline.

## Decision

The repository will use exactly one canonical project configuration:

- Canonical file: `opencode.jsonc`
- Default agent: `delivery` (updated 2026-06-20: post-decision change from `plan` to `delivery` to match implementation)
- OpenCode version: exactly `1.17.7`
- `opencode.json` will be removed

The canonical configuration must preserve the security-sensitive policy from
the existing `opencode.jsonc`:

- secret, credential, private-key, environment-file, and Git metadata read
  restrictions;
- equivalent edit restrictions;
- delegated task and skill denial;
- approval for unclassified shell commands;
- explicit denial of destructive Git, infrastructure, publication, privilege,
  and destructive filesystem commands;
- disabled sharing;
- denied external-directory access.

The canonical configuration must also preserve non-conflicting values that are
part of the currently resolved project configuration:

- project instruction files:
  - `AGENTS.md`
  - `.ui-redesign/adapter/REPOSITORY_ADAPTER.md`
  - `.ui-redesign/decisions/DECISION_LEDGER.md`
- explicit read-only tool allowances for:
  - `glob`
  - `grep`
  - `list`
  - `lsp`
  - `todowrite`
  - `question`

The canonical file will retain the existing `opencode.jsonc` watcher,
tool-output, compaction, snapshot, update-notification, and permission settings
unless a separately reviewed change documents a reason to alter them.

The root package will pin `opencode-ai` to exact version `1.17.7`. Repository
validation will invoke the local package binary rather than relying on an
unversioned user-level installation.

An effective-configuration smoke test will verify at minimum:

1. exactly one root OpenCode configuration exists;
2. the local OpenCode version is `1.17.7`;
3. the resolved default agent is `delivery`;
4. sharing remains disabled;
5. all required instruction files are loaded;
6. task and skill permissions remain denied;
7. external-directory access remains denied;
8. protected read and edit patterns remain denied;
9. destructive and publishing commands remain denied;
10. expected read-only tools remain allowed.

The smoke test must isolate or explicitly disclose user-level and environment
configuration sources so a developer-specific override cannot make the
repository test pass accidentally.

## Consequences

### Positive

- Project policy has one authoritative source.
- The effective default agent and permissions are reviewable without relying on
  configuration merge order.
- OpenCode runtime behavior is tied to a reproducible version.
- Regression testing detects permission or default-agent drift.
- The mobile redesign instruction files remain active while the stricter
  permission baseline is preserved.

### Negative and risks

- Installing the pinned CLI adds platform-specific optional dependencies and a
  package postinstall step.
- Developers with unsupported platforms must use a separately reviewed
  installation method.
- User-level, environment-provided, or future global OpenCode configuration can
  still affect an interactive session.
- Setting `task` and `skill` to `deny` intentionally prevents delegation from
  this default configuration. Any future delegation-enabled profile requires a
  separate reviewed configuration and decision.

## Alternatives considered

### Keep both files and document merge order

Rejected. The effective policy would remain dependent on version-specific merge
behavior and would still be easy to edit incorrectly.

### Make `opencode.json` canonical

Rejected. It has weaker secret-path controls, permits skills, permits delegated
tasks subject to approval, and selects a redesign-specific orchestrator as the
general project default.

### Keep only the current `opencode.jsonc` without copying resolved values

Rejected. Removing `opencode.json` would also remove the project instruction
list and explicit read-only tool allowances that are currently contributed by
that file.

### Do not pin OpenCode

Rejected. Configuration semantics and effective permissions could change when
the developer installation changes.

## Rollback

Revert the consolidation commit and stop OpenCode use until the conflicting
configuration state is reviewed. Restoring both root configuration files while
continuing normal OpenCode operation is not an acceptable steady-state
rollback.
