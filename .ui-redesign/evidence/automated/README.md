# Automated Evidence — Index

This directory holds redacted, traceable evidence captured during the
mobile UI redesign workflow. All files are JSON, Markdown, or redacted
artifacts; no session cookies, OIDC tokens, or user-submitted free-text
content may be included.

## Files

| File | Captured at | Source | Redaction |
|---|---|---|---|
| `http-baseline-probes.json` | 2026-06-14 | orchestrator `curl` probes (no auth) | request_ids redacted; placeholder workspace IDs used; no session data |

## Redaction rules

- `request_id` values are replaced with `<redacted>` in any evidence body.
- Session cookies (`Set-Cookie`, `Cookie`) must never appear in any file in this directory.
- User-submitted free-text content (e.g., `free_text` feedback field) must never appear in any file in this directory.
- Real workspace IDs in any API path are replaced with `ws-baseline-probe`, `d-baseline-probe`, `c-baseline-probe`.

## Future files (anticipated)

- `device-validation/<run-id>/` — screenshots, recordings, network logs from physical iPhone 16 Pro (B-1 must be resolved first).
- `axe-baseline/` — automated axe-core accessibility scans (B-6 must be resolved first; no browser binary on host).
- `before-after/` — before/after evidence pairs tied to specific feature-parity rows.
- `reports/` — aggregated reports produced by the orchestrator at the end of each phase.

## Validation

Each file in this directory must:

- Be referenced by `.ui-redesign/state/workflow-state.json` evidence block.
- Be referenced by `.ui-redesign/contracts/FEATURE_PARITY_MATRIX.md` evidence columns.
- Be linked to a specific decision ID in `.ui-redesign/decisions/DECISION_LEDGER.md`.
- Pass the secret scan (`pnpm security:secrets`).
