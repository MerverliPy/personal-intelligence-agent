# PIA-MUR-D-009 — Touch-target minimum enforcement (DPC-4)

**Status:** `PROPOSED`
**Date:** 2026-06-14
**Parent decision:** PIA-MUR-D-002 (product model); PIA-MUR-D-004 (design contract §7.2); PIA-MUR-D-016 (pre-flight tooling).
**Resolves:** UNVERIFIED-4.

## Problem

DPC-4 (touch targets, UNVERIFIED-4) failed in the pre-flight harness:

- **Avatar** in the header: **32×32pt** (CSS: `.app-header__avatar` in `.ui-redesign/concepts/concept-3-stream/interactive/styles.css:160-161`)
- **Citation chip** in messages: **18×24pt** (CSS: `.citation-chip` in `.ui-redesign/concepts/concept-3-stream/interactive/styles.css:475-476`)

Both are below the **44×44pt HIG minimum** that the design contract §7.2 mandates for all interactive elements.

```
DPC-4: touch targets
- Avatar: 32x32pt  (target 44pt)  **FAIL**
- Citation chip: 18x24pt  (target 44pt)  **FAIL**
```

## Scope

This packet authorizes the **prototype-only** CSS fixes for the Stream concept prototype (`.ui-redesign/concepts/concept-3-stream/interactive/`). It does NOT authorize production code changes. The implementation contract (PIA-MUR-D-004-IMPL) will mirror these fixes in `apps/web/src/`.

## Materially different alternatives

| Alternative                                   | Description                                                                                                                         | Trade-offs                                                                            |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| **A. Increase padding to meet 44×44pt**       | Add 6pt transparent padding to the avatar (32→44). Add `min-width: 44pt; min-height: 44pt; padding: 13pt 4pt` to the citation chip. | **Recommended.** No semantic change; meets HIG; preserves visual design.              |
| B. Accept 32pt for the avatar as an exception | Apple's HIG allows 32pt for header buttons in some contexts. Document the exception.                                                | Reject. Inconsistent with the design contract; 44pt is iOS 16 Pro standard.           |
| C. Redesign the avatar as a non-target        | Make the avatar non-interactive (remove `<button>` wrapper; use `<div>`). Move the workspace switcher to a different location.      | Reject. Loses the T4 = A decision (top-left avatar in header for workspace switcher). |

## Recommendation

**A.** Specifically:

- `.app-header__avatar`: add `padding: 6pt` (or set `min-width: 44pt; min-height: 44pt; box-sizing: content-box;`).
- `.citation-chip`: change `min-width: 18pt; min-height: 24pt` to `min-width: 44pt; min-height: 44pt` and adjust inner padding to preserve the 16pt visible glyph.

## Acceptance criteria

- **AC1.** `.app-header__avatar` measures ≥ 44×44pt in the headless Playwright run.
- **AC2.** `.citation-chip` measures ≥ 44×44pt in the headless Playwright run.
- **AC3.** Visible glyph size is preserved (avatar letter "P" still 16pt; citation `[1]`/`[2]` still 16pt).
- **AC4.** Visual appearance is acceptable (avatar and chip don't appear bloated).
- **AC5.** No regression in the 50+ other Playwright sub-tests that pass today.

## Exact scope (this packet authorizes)

- Modify `.ui-redesign/concepts/concept-3-stream/interactive/styles.css`:
  - `.app-header__avatar` block: add `min-width: 44pt; min-height: 44pt;` (or equivalent padding).
  - `.citation-chip` block: change `min-width: 18pt; min-height: 24pt` to `min-width: 44pt; min-height: 44pt`.
- Re-run `pnpm preflight:device` to confirm DPC-4 now passes.
- Update the per-DPC JSON evidence at `.ui-redesign/evidence/preflight/dpc-4_-touch-targets-_unverified-4_.json`.
- Update `dpc-summary.json` to mark DPC-4 as PASS.

## Out of scope

- Production code changes (`apps/web/src/`). Deferred to PIA-MUR-D-004-IMPL.
- Other 44pt elements (which already meet the minimum).

## Response syntax

- **"Approve PIA-MUR-D-009"** → I update the prototype CSS, re-run the harness, commit the changes, and surface the updated pre-flight report.
- **"Approve with overrides"** → e.g., "use option B for the avatar (32pt exception)" — I document the override and re-run.
- **"Reject"** → defer; the 44pt minimum stands and the implementation contract will need to address it.
