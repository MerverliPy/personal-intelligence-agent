---
name: readme-landing-quality
description: Improve public-facing README, documentation landing sections, and project presentation without changing product behavior.
compatibility: opencode
metadata:
  audience: repository-docs-agents
  output: docs-quality-review
---

## Use this skill when

A task edits `README.md`, top-level docs, screenshots, assets, badges, roadmap summaries, or public project-positioning copy.

## Scope

This skill applies to presentation and documentation. It does not authorize product code changes.

## Quality checklist

Check that public-facing material has:

- clear first-screen value proposition;
- specific audience and use case;
- concrete feature evidence;
- readable visual hierarchy;
- consistent roadmap and status language;
- screenshots or image references when they materially help;
- no generic AI marketing phrases;
- no unsupported claims;
- no stale task counts or command counts;
- links that point to real repository paths.

## PIA tone

Use direct, trust-first language. Prefer evidence, provenance, approvals, isolation, retrieval quality, and auditability over vague claims about intelligence or automation.

## Output

Return:

1. inspected paths;
2. stale or weak claims;
3. hierarchy issues;
4. proposed copy changes;
5. validation required.
