# Workflow Context Cache

> **Purpose**: Condensed state summary for specialist agents. Read this FIRST before any full file reads.
> **Updated by**: `mobile-ui-orchestrator` on every state transition and before every specialist delegation.

---

## Current State

- **Phase**: `IMPLEMENTATION_COMPLETE`
- **Phase index**: 7 of 10
- **Last approval**: PWA follow-up commit (apple-mobile-web-app meta + ws-card click handlers, 2026-06-16)
- **Next action**: Critique panels DONE (PIA-MUR-D-013/014/015). Device validation deferred (no real iPhone verified). Focus-trap code implemented (AUDIT-05), not device-verified. Proceed to evidence-bundle and delivery when device validation complete.
- **Updated at**: 2026-06-18
- **Confidence**: `high`
- **Staleness**: 2 / 3 transitions

## Active Contract Summary

- **Contract ID**: PIA-MUR-D-004 (design contract, approved)
- **Implementation contract**: PIA-MUR-D-004-IMPL (approved, 8 atomic commits — ALL LANDED)
- **Follow-up commit**: `e1d219a` — iOS PWA meta tags + workspace card click handlers for standalone mode
- **Concept**: Stream (PIA-MUR-D-003c) — `#2563EB` accent, 3-tab bottom bar, footnote citation chips, sheet-heavy navigation
- **Target**: iPhone 16 Pro portrait, Safari + installed PWA + iOS Chrome
- **Key tokens**: `--accent: #2563EB`, body 19pt, 4pt spacing grid, `--motion-sheet: 280ms`
- **Tab layout**: 3 tabs (Conversations / Documents / Search), Conversations default
- **PWA**: network-required, manifest at `/manifest.webmanifest`, service worker scope `/`

## Implemented Features (8 Commits + 1 Follow-up)

| #   | Commit    | Feature                                               | Decision             |
| --- | --------- | ----------------------------------------------------- | -------------------- |
| 1   | `440c693` | Design tokens extracted to `shared.ts`                | PIA-MUR-D-004        |
| 2   | `040de91` | Safe-area insets + `viewport-fit=cover`               | PIA-MUR-D-004 + -011 |
| 3   | `3c54d25` | Bottom tab bar (T1=A, Conversations/Documents/Search) | PIA-MUR-D-002 + -011 |
| 4   | `89f2088` | Top app bar (T4=A) with 44pt avatar                   | PIA-MUR-D-002 + -009 |
| 5   | `3181682` | Network-loss banner (T6=A) + offline detection        | PIA-MUR-D-002 §5     |
| 6   | `6479230` | Footnote citation chip + sheet modal                  | PIA-MUR-D-002 + -009 |
| 7   | `10c3561` | FAB (T7=A) + mode-of-conversation sheet               | PIA-MUR-D-002        |
| 8   | `9484a95` | PWA manifest + service worker + icons + theme-color   | PIA-MUR-D-004 §9     |
| 9   | `e1d219a` | iOS PWA meta tags + workspace card standalone fixes   | PWA follow-up        |

## Open Blockers

| ID  | Description                               | Status                                |
| --- | ----------------------------------------- | ------------------------------------- |
| B-2 | mobile-ui-design-contract command missing | RESOLVED (command created)            |
| B-6 | Playwright + axe-core dependency policy   | RESOLVED (PIA-MUR-D-016/017 approved) |

## Open Decisions

- PIA-MUR-D-005-candidate: Dark-mode badge contrast (resolution deferred to device-validation)
- PIA-MUR-D-006-candidate: iOS Safari dialog focus (resolution deferred to device-validation)
- PIA-MUR-D-007-candidate: prefers-reduced-motion in PWA (resolution deferred to device-validation)
- PIA-MUR-D-008-candidate: POST /v1/me/active-workspace endpoint (out of redesign scope)

## Recent Approvals

1. PWA follow-up commit — iOS meta tags + workspace card standalone fix (2026-06-16)
2. PIA-MUR-D-004-IMPL — Implementation contract (2026-06-15)
3. PIA-MUR-D-004 — Design contract (2026-06-14)

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

### For feature-critic — Group 1 (Core Shell)

**Evaluate**: Design tokens system, safe-area insets + viewport-fit=cover, bottom tab bar (3 tabs), top app bar with 44pt avatar
**Evidence**: CONTEXT_CACHE.md, `.ui-redesign/contracts/DESIGN_CONTRACT.json`, `apps/web/src/pages/shared.ts`, `apps/api/src/routes/web.ts`, `.ui-redesign/evidence/preflight/dpc-04-touch-targets.json`, `.ui-redesign/evidence/preflight/dpc-06-safe-area.json`, `.ui-redesign/evidence/preflight/dpc-07-viewport-fit.json`
**Key contracts**: PIA-MUR-D-002 (T1=A, T4=A), PIA-MUR-D-004 (§3 tokens, §8 safe-area), PIA-MUR-D-009 (44pt targets), PIA-MUR-D-011 (fixed tab-bar)
**Protected areas**: Do NOT read/modify auth/API/schema paths. These are frontend-only CSS/HTML changes.
**Output**: Feature Critic Report with P0-P3 severity

### For feature-advocate — Group 1 (Core Shell)

**Same context as feature-critic above**
**Output**: Feature Advocate Report with High/Medium/Low value

### For feature-critic — Group 2 (Interactions)

**Evaluate**: Network-loss banner + offline detection (T6=A), footnote citation chip + bottom-sheet citation modal, FAB + mode-of-conversation sheet (T7=A)
**Evidence**: CONTEXT_CACHE.md, `apps/web/src/pages/shared.ts`, `apps/web/src/pages/conversation-detail.ts`, `apps/web/src/pages/conversation-list.ts`, `apps/web/src/pages/document-list.ts`, `.ui-redesign/evidence/preflight/dpc-01-sheet-focus.json`, `.ui-redesign/evidence/preflight/dpc-14-offline-banner.json`, `.ui-redesign/evidence/preflight/dpc-10-aria.json`
**Key contracts**: PIA-MUR-D-002 (T2=A, T5=A, T6=A, T7=A), PIA-MUR-D-004 (§3.4 citation, §3.5 sheets, §3.8 offline), PIA-MUR-D-009 (44pt touch targets)
**Protected areas**: Same as Group 1
**Output**: Feature Critic Report with P0-P3 severity

### For feature-advocate — Group 2 (Interactions)

**Same context as feature-critic Group 2**
**Output**: Feature Advocate Report with High/Medium/Low value

### For feature-critic — Group 3 (PWA)

**Evaluate**: PWA manifest, service worker, icons, theme-color, apple-touch-icon, iOS PWA meta tags (apple-mobile-web-app-capable, status-bar-style), workspace card click handlers for standalone mode
**Evidence**: CONTEXT_CACHE.md, `apps/web/public/manifest.webmanifest`, `apps/web/public/sw.js`, `apps/web/src/pages/shared.ts` (PWA meta tags), `apps/api/src/routes/web.ts` (workspace card handlers + head section), `.ui-redesign/evidence/preflight/dpc-13-pwa-standalone.json`
**Key contracts**: PIA-MUR-D-004 §9 (PWA), PIA-MUR-D-012 (iOS meta tags + click handlers)
**Protected areas**: Same as Group 1
**Output**: Feature Critic Report with P0-P3 severity

### For feature-advocate — Group 3 (PWA)

**Same context as feature-critic Group 3**
**Output**: Feature Advocate Report with High/Medium/Low value

### For feature-judge

**Input**: Receives both Critic and Advocate reports for all 3 groups
**Output**: Feature Judge Report with ACCEPT/REJECT/HYBRID/REVISE recommendation per group

### For frontend-implementer

- **Phase**: `feature-critique`
- **Context**: All 8 features (see table above) are implemented and committed. The Critique Panel evaluates each feature group for flaws/risks (critic) and strengths/value (advocate).
- **Groups for batching**:
  - **Group 1 (Core Shell)**: Design tokens + safe-area/viewport + bottom tab bar + top app bar
  - **Group 2 (Interactions)**: Network-loss banner + citation chips/sheet + FAB/mode sheet
  - **Group 3 (PWA)**: Manifest + SW + icons + theme-color + iOS meta tags
- **Source of truth for behavior**: Design contract at `.ui-redesign/contracts/DESIGN_CONTRACT.json`
- **Source of truth for implementation**: The actual source files at `apps/web/src/pages/` and `apps/api/src/routes/web.ts`
- **Preflight evidence**: `.ui-redesign/evidence/preflight/` — DPC-1 through DPC-14
- **Read guidelines**: CONTEXT_CACHE.md first, then the relevant source files for each feature being critiqued

### For real-ui-product-tester (Validation — P2)

- API running at `http://localhost:3000/`
- Tailscale bridge: `http://100.81.83.98:3000/`
- Preflight harness: `apps/web/test/preflight/`
- Playwright + axe-core installed (chromium + webkit)

### For iphone-interaction-specialist (Device Validation — P4)

- Requires physical iPhone 16 Pro
- cloudflared tunnel: `cloudflared tunnel --no-autoupdate --url http://localhost:3000`
- DPC checklist: 14 DPCs (dpc-01 through dpc-14)
- Unverified items: DPC-1 (sheet focus — code implemented, device verification deferred), DPC-3 (reduce-motion in PWA), DPC-5 (pixel-perfect), DPC-11 (PWA install)

## Batch Approval State

- **Pending batch**: None
- **Last batch**: N/A
- **Next expected batch**: Critique panel results for each feature group

## Phase Dependency Map

```
adapter → baseline → product-model → concepts → design-contract → implementation-contract → implementation → [VALIDATION + CRITIQUE] → device-validation → evidence-bundle → delivery
```

- `implementation` is COMPLETE
- `validation` and `critique` run next (both in progress)
- `device-validation` requires implementation complete — satisfied
- `evidence-bundle` and `delivery` are never skippable
