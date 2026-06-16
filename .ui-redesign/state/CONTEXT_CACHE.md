# Workflow Context Cache

> **Purpose**: Condensed state summary for specialist agents. Read this FIRST before any full file reads.
> **Updated by**: `mobile-ui-orchestrator` on every state transition and before every specialist delegation.

---

## Current State

- **Phase**: `IMPLEMENTATION_CONTRACT_APPROVED`
- **Phase index**: 6 of 10
- **Last approval**: PIA-MUR-D-004-IMPL (implementation contract, 2026-06-15)
- **Next action**: Begin commit 1 of 8 (extract design tokens to `shared.ts`)
- **Updated at**: 2026-06-15
- **Confidence**: `high`
- **Staleness**: 0 / 3 transitions

## Active Contract Summary

- **Contract ID**: PIA-MUR-D-004 (design contract, approved)
- **Implementation contract**: PIA-MUR-D-004-IMPL (approved, 8 atomic commits)
- **Concept**: Stream (PIA-MUR-D-003c) — `#2563EB` accent, 3-tab bottom bar, footnote citation chips, sheet-heavy navigation
- **Target**: iPhone 16 Pro portrait, Safari + installed PWA + iOS Chrome
- **Key tokens**: `--accent: #2563EB`, body 19pt, 4pt spacing grid, `--motion-sheet: 280ms`
- **Tab layout**: 3 tabs (Conversations / Documents / Search), Conversations default
- **PWA**: network-required, manifest at `/manifest.webmanifest`, service worker scope `/`

## Open Blockers

| ID  | Description                               | Status                                |
| --- | ----------------------------------------- | ------------------------------------- |
| B-2 | mobile-ui-design-contract command missing | RESOLVED (command created)            |
| B-6 | Playwright + axe-core dependency policy   | RESOLVED (PIA-MUR-D-016/017 approved) |

## Open Decisions

- PIA-MUR-D-005-candidate: Dark-mode badge contrast (non-blocking, device-validation)
- PIA-MUR-D-006-candidate: iOS Safari dialog focus (non-blocking, device-validation)
- PIA-MUR-D-007-candidate: prefers-reduced-motion in PWA (non-blocking, device-validation)
- PIA-MUR-D-008-candidate: POST /v1/me/active-workspace endpoint (out of redesign scope)

## Recent Approvals

1. PIA-MUR-D-004-IMPL — Implementation contract (2026-06-15)
2. PIA-MUR-D-004 — Design contract (2026-06-14)
3. PIA-MUR-D-003c — Stream concept direction (2026-06-14)

## Active File Paths

| Purpose                 | Path                                                  |
| ----------------------- | ----------------------------------------------------- |
| Design contract (JSON)  | `.ui-redesign/contracts/DESIGN_CONTRACT.json`         |
| Design contract (MD)    | `.ui-redesign/contracts/DESIGN_CONTRACT.md`           |
| Implementation contract | `.ui-redesign/decisions/PIA-MUR-D-004-IMPL.md`        |
| Decision ledger         | `.ui-redesign/decisions/DECISION_LEDGER.md`           |
| Feature parity matrix   | `.ui-redesign/contracts/FEATURE_PARITY_MATRIX.md`     |
| Repository adapter      | `.ui-redesign/adapter/REPOSITORY_ADAPTER.md`          |
| Repository baseline     | `.ui-redesign/baseline/REPOSITORY_BASELINE.md`        |
| Workflow state          | `.ui-redesign/state/workflow-state.json`              |
| Preflight evidence      | `.ui-redesign/evidence/preflight/`                    |
| Prototype (Stream)      | `.ui-redesign/concepts/concept-3-stream/interactive/` |

## Protected Areas

| Area            | Paths                                                                               |
| --------------- | ----------------------------------------------------------------------------------- |
| Authentication  | `apps/api/src/routes/auth.ts`, `apps/api/src/plugins/auth.ts`, `packages/auth/src/` |
| Authorization   | `packages/domain/src/`, `packages/db/src/membership*`                               |
| Public API      | `api/openapi.yaml`, `apps/api/src/routes/*.ts` (except `web*.ts`)                   |
| Database schema | `db/schema.sql`, `db/migrations/`                                                   |
| Infrastructure  | `infra/`, `compose.yaml`, `.github/workflows/`                                      |
| Credentials     | `.env`, `.env.*`, `*.pem`, `*.key` — NEVER READ                                     |

## Specialist Delegation Context

### For frontend-implementer

- Implementing commit 1 of 8: extract design tokens from prototype to `apps/web/src/pages/shared.ts`
- Key tokens: `--accent: #2563EB`, `--motion-sheet: 280ms`, body 19pt, 4pt grid
- Source: `.ui-redesign/concepts/concept-3-stream/interactive/styles.css` lines 13-113
- Target: `apps/web/src/pages/shared.ts`
- Per-commit verification: `pnpm typecheck`, `pnpm test:unit`, `pnpm lint`

### For design-system-architect

- Design contract is complete and approved
- JSON validates against `contracts/design-contract.schema.json` (13/13 required fields, 17/17 const checks)
- All 17 components specified with anatomy, variants, states, behavior, a11y, motion, safe-area

### For accessibility-performance-validator

- Preflight harness available at `apps/web/test/preflight/`
- 15 DPCs, 13/13 tested DPCs PASS in both chromium and webkit
- DPC-2 and DPC-11 untested (product-code dependent)
- axe-core + ARIA assertions + screenshot comparison available

### For real-ui-product-tester

- Prototype running at `http://100.81.83.98:8000/`
- API running at `http://100.81.83.98:3000/`
- Tailscale bridge active
- Playwright + axe-core installed (chromium + webkit)

## Batch Approval State

- **Pending batch**: None
- **Last batch**: N/A
- **Next expected batch**: Commits 1-3 (tokens + safe-area + tab-bar)

## Phase Dependency Map

```
adapter → baseline → product-model → concepts → design-contract → implementation-contract → implementation → device-validation → evidence-bundle → delivery
```

- `implementation` and `device-validation-prep` can run in parallel
- `device-validation` requires `implementation` complete
- `evidence-bundle` and `delivery` are never skippable
- Conditional skip allowed for other phases if acceptance criteria already pass with evidence
