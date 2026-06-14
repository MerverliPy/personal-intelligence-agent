# Decision Ledger

## Open decisions

| ID | Category | Problem | Status | Dependencies |
|---|---|---|---|---|
| *(none — see approved decisions below)* | | | | |

## Approved decisions

| ID | Selected alternative | Conditions | Approved by | Approved at | Implemented by commits |
|---|---|---|---|---|---|
| PIA-MUR-D-001 | Approve PIA-MUR-ADAPTER-001 as PROPOSED → APPROVED with commit baseline `ef6a910`. Authorizes the **detected operating context** and the **next baseline phase only**. Does **not** authorize any product-code change, dependency addition, schema change, route change, API contract change, auth change, or deployment change. Six blockers (B-1 through B-6) remain tracked in `.ui-redesign/state/workflow-state.json` and will be raised at the relevant phase. Baseline hygiene cleanup (delete stray `tatus --short` file, add `.opencode/run-logs/` to `.gitignore`) was approved in the same step. | user (explicit) | 2026-06-14 | chore: adopt mobile UI redesign adapter (PIA-MUR-D-001) |

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
