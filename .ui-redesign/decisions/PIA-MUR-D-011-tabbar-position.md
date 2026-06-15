# PIA-MUR-D-011 — Tab-bar position: fixed (DPC-6)

**Status:** `PROPOSED`
**Date:** 2026-06-14
**Parent decision:** PIA-MUR-D-002 §5 (safe-area + iOS 16 Pro); PIA-MUR-D-004 (design contract §3.6 + §8); PIA-MUR-D-016 (pre-flight tooling).
**Resolves:** Safe-area inset concern surfaced by DPC-6.

## Problem

DPC-6 (safe-area insets) failed in the pre-flight harness:

```
DPC-6: safe-area insets
- Tab bar: position: absolute; bottom: 0 of body
- Body height: 1136pt
- Viewport height: 853pt
- Tab bar is 283pt BELOW the viewport (invisible without scrolling)
```

The prototype's `.tab-bar` is `position: absolute; bottom: 0` of the body container (`.ui-redesign/concepts/concept-3-stream/interactive/styles.css:264-271`). The body grows vertically to fit the conversation list + message thread + composer + dev-controls panel. The tab bar is at the BOTTOM OF THE BODY, not at the BOTTOM OF THE VIEWPORT. As a result, the tab bar is 283pt below the viewport in the headless run — invisible to the user without scrolling.

By contrast, the prototype's `.dynamic-island` is `position: fixed; top: 11pt` and stays in view correctly. The two chrome elements use inconsistent positioning.

The design contract §8 requires: "Bottom of tab bar: 49pt + env(safe-area-inset-bottom)" — implying the tab bar should be at the viewport bottom, not the body bottom.

## Scope

This packet authorizes the **prototype-only** CSS fix for the Stream concept prototype. It does NOT authorize production code changes.

## Materially different alternatives

| Alternative | Description | Trade-offs |
|---|---|---|
| **A. `position: fixed; bottom: 0`** on `.tab-bar` | Standard iOS PWA pattern. The tab bar always stays at the viewport bottom regardless of content height. | **Recommended.** Matches the design contract §8 and the iOS HIG. |
| B. Set `body { height: 100vh; overflow: hidden }` and let each `.screen` scroll independently | More complex; each screen would need its own scroll container. | Reject. More moving parts; doesn't fix the iOS-installation concerns. |
| C. Keep `position: absolute` and add `body { max-height: 100dvh; overflow-y: scroll }` | Forces the body to be viewport-height, with internal scroll. | Reject. iOS Safari fights with `100dvh` due to the dynamic UI chrome (URL bar). |
| D. Accept the issue, document it, and fix in the implementation contract | Defers the fix. | Reject. The prototype is the demo; it should match the design contract. |

## Recommendation

**A.** Specifically:
- Change `.tab-bar` from `position: absolute` to `position: fixed; bottom: 0; left: 0; right: 0;`.
- The existing `height: var(--tab-bar-safe)` and `padding-bottom: env(safe-area-inset-bottom, 0px)` already handle the height and home-indicator clearance.
- The FAB's `bottom: calc(var(--tab-bar-safe) + 16pt)` (line 308) will still work correctly because the tab bar is now a fixed element and the FAB is also fixed.

## Acceptance criteria

- **AC1.** `.tab-bar` is at the viewport bottom (top + height ≤ viewport height) in the headless run.
- **AC2.** The tab bar's `position: fixed` doesn't break the existing tab-bar visibility.
- **AC3.** No regression in DPC-1, DPC-4, DPC-12, DPC-14, or any other test that touches the tab bar.
- **AC4.** The body can still scroll (content overflows correctly; the fixed tab bar overlays the bottom of the content, which is the standard iOS pattern).

## Exact scope (this packet authorizes)

- Modify `.ui-redesign/concepts/concept-3-stream/interactive/styles.css`:
  - `.tab-bar` block: change `position: absolute; left: 0; right: 0; bottom: 0;` to `position: fixed; left: 0; right: 0; bottom: 0;`.
- Re-run `pnpm preflight:device` to confirm DPC-6 now passes.
- Update the per-DPC JSON evidence at `.ui-redesign/evidence/preflight/dpc-6_-safe-area-insets.json`.
- Update `dpc-summary.json` to mark DPC-6 as PASS (or PARTIAL if iPhone-specific behavior can't be fully verified in headless).

## Out of scope

- Production code changes (`apps/web/src/`). Deferred to PIA-MUR-D-004-IMPL.
- The `.dynamic-island` element (already `position: fixed`; works correctly).
- The FAB (already `position: fixed`; works correctly).

## Response syntax

- **"Approve PIA-MUR-D-011"** → I update the prototype CSS, re-run the harness, commit the changes, and surface the updated pre-flight report.
- **"Approve with overrides"** → e.g., "use option D and document only" — I document the override.
- **"Reject"** → defer; the implementation contract will need to address it.
