# Decision Ledger

## Open decisions

| ID | Category | Problem | Status | Dependencies |
|---|---|---|---|---|
| *(none — see approved decisions below)* | | | | |

## Approved decisions

| ID | Selected alternative | Conditions | Approved by | Approved at | Implemented by commits |
|---|---|---|---|---|---|
| PIA-MUR-D-001 | Approve PIA-MUR-ADAPTER-001 as PROPOSED → APPROVED with commit baseline `ef6a910`. Authorizes the **detected operating context** and the **next baseline phase only**. Does **not** authorize any product-code change, dependency addition, schema change, route change, API contract change, auth change, or deployment change. Six blockers (B-1 through B-6) remain tracked in `.ui-redesign/state/workflow-state.json` and will be raised at the relevant phase. Baseline hygiene cleanup (delete stray `tatus --short` file, add `.opencode/run-logs/` to `.gitignore`) was approved in the same step. | user (explicit) | 2026-06-14 | chore: adopt mobile UI redesign adapter (PIA-MUR-D-001) |
| PIA-MUR-D-002 | Approve the product-model recommendation (`.ui-redesign/reports/PIA-MUR-D-002-product-model.md`) as the canonical product model for the iPhone 16 Pro redesign. All trade-off recommendations accepted as default: **T1=A** (bottom tab bar, 3–4 tabs), **T2=A** (single-pane conversation with bottom-sheet citation modal), **T3=A** (dedicated search tab), **T4=A** (top-left avatar in header, iOS Mail pattern), **T5=A** (text-only input, iOS dictation as system affordance), **T6=A** (persistent top banner on network loss, disable destructive actions), **T7=A** (FAB on Documents / Conversations tabs). All 10 acceptance criteria (A1–A10) acknowledged; 17 out-of-scope items (Section 7) acknowledged with assigned owners; 6 blockers (B-1–B-6) acknowledged (none block this gate; B-1 blocks downstream `device-validation`). Sections 1–10 are authoritative for the design contract. Does **not** authorize any product-code, dependency, schema, route, API, auth, infra, or deployment change. | user (explicit) | 2026-06-14 | chore(redesign): approve product model (PIA-MUR-D-002) |

## Rejected decisions

| ID | Rejection reason | Replacement |
|---|---|---|

## Revised or superseded decisions

| ID | Replaced by | Reason |
|---|---|---|

## Rules

- Every design decision is recorded.
- Approval applies only to the stated scope.
- New implementation-discovered decisions return to approval.
- Rejected directions update constraints so they are not repeated without new evidence.
