# PIA-MUR-D-005 — Dark-mode auto-switch CSS (DPC-8)

**Status:** `PROPOSED`
**Date:** 2026-06-14
**Parent decision:** PIA-MUR-D-002 §5; PIA-MUR-D-004 (design contract §2.1 + §7.3).
**Resolves:** UNVERIFIED-3 (dark-mode badge contrast, already named in DESIGN_CONTRACT.md §13 follow-up topics).

## Problem

DPC-8 (dark mode) failed the auto-switch test in Chromium:

```
DPC-8: dark mode
- Manual #toggle-dark click: PASS (body backgroundColor becomes rgb(10, 10, 10))
- Light default: PASS (body backgroundColor is rgb(255, 255, 255))
- Auto-switch via prefers-color-scheme: dark: FAIL
  - Expected: rgb(10, 10, 10)
  - Received: rgb(255, 255, 255)
- axe color-contrast in dark mode: PASS (no critical violations)
```

The prototype's CSS does have an `@media (prefers-color-scheme: dark)` rule that updates `--bg` to `#0A0A0A`:

```css
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0a0a0a;
    --fg: #f5f5f5;
    /* ... */
  }
}
```

But when Playwright's `page.emulateMedia({ colorScheme: 'dark' })` is set BEFORE `page.goto()`, the body backgroundColor is still `rgb(255, 255, 255)`. The `@media` rule is not firing in Chromium.

The axe color-contrast test PASSES in dark mode (no critical violations), so the dark colors themselves are valid. The bug is in the auto-switch mechanism, not the color palette.

## Root cause hypotheses

1. **CSS specificity issue:** the `@media (prefers-color-scheme: dark)` rule on `:root` may be overridden by a more specific rule elsewhere in the CSS (e.g., `body { background: var(--bg); }` may not re-evaluate when the media query changes).
2. **CSS variable cascade issue:** the variable `--bg` is defined twice — once in `:root` and once in `@media (prefers-color-scheme: dark) :root`. Some browsers may not re-evaluate the variable when the media query matches.
3. **App.js override:** the prototype's `app.js` may be setting a theme class or background color on load that overrides the CSS variable.

## Scope

This packet authorizes the **prototype-only** CSS/JS fix for the Stream concept prototype. It does NOT authorize production code changes.

## Materially different alternatives

| Alternative                                                                                             | Description                                                                                                  | Trade-offs                                                                                  |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| **A. Reorder the CSS rules; use `!important` on the body**                                              | Force the body to use `var(--bg)` with higher specificity.                                                   | **Recommended** (pending root cause confirmation). Simple, targeted.                        |
| B. Add a `body.theme-dark` class set by app.js when the media query matches                             | More explicit; the app code controls the theme.                                                              | Reject for the prototype; adds JS complexity. Could be appropriate for the production code. |
| C. Add a manual JS toggle that sets the theme on load (similar to the existing `#toggle-dark` checkbox) | The app already has a manual toggle; add a "auto" mode that respects `prefers-color-scheme` on initial load. | Consider. Cleaner than CSS hacks; the manual toggle already works.                          |
| D. Accept the issue; document that dark mode auto-switch only works in WebKit (not Chromium)            | File as a known limitation.                                                                                  | Reject. The user expects dark mode to work on both browsers.                                |

## Recommendation

**C** (with fallback to **A** if C doesn't work). Specifically:

1. In `app.js`, add an `applyAutoTheme()` function that:
   - Checks `window.matchMedia('(prefers-color-scheme: dark)').matches`.
   - If true, sets the `data-theme="dark"` attribute on the root `<html>` element (or adds a `.theme-dark` class to body).
   - Registers a `matchMedia.addEventListener('change', ...)` listener to update the theme when the user changes their iOS dark-mode setting while the app is open.
2. Add an explicit CSS rule for `[data-theme="dark"]` (in addition to the `@media` rule) that sets `--bg`, `--fg`, etc.
3. Keep the existing `@media (prefers-color-scheme: dark)` rule as a fallback for the brief moment between page load and JS execution.

If C doesn't work due to JS timing or other issues, fall back to A: reorder CSS so `body { background: var(--bg); }` has higher specificity than the @media rule.

## Acceptance criteria

- **AC1.** `page.emulateMedia({ colorScheme: 'dark' })` followed by `page.goto(...)` results in `getComputedStyle(document.body).backgroundColor === 'rgb(10, 10, 10)'`.
- **AC2.** Toggling iOS dark mode while the app is open updates the theme (requires the `matchMedia.addEventListener('change', ...)` listener).
- **AC3.** The manual `#toggle-dark` checkbox still works.
- **AC4.** Light mode still works (no regression).
- **AC5.** axe color-contrast still passes in dark mode.

## Exact scope (this packet authorizes)

- Modify `.ui-redesign/concepts/concept-3-stream/interactive/index.html` (no changes expected; just for reference).
- Modify `.ui-redesign/concepts/concept-3-stream/interactive/styles.css`:
  - Reorder the `@media (prefers-color-scheme: dark)` rule OR add an explicit `[data-theme="dark"]` rule (depending on which approach is taken).
- Modify `.ui-redesign/concepts/concept-3-stream/interactive/app.js`:
  - Add `applyAutoTheme()` function (if option C is taken).
  - Call `applyAutoTheme()` on DOMContentLoaded.
- Re-run `pnpm preflight:device` to confirm DPC-8 now passes.
- Update the per-DPC JSON evidence at `.ui-redesign/evidence/preflight/dpc-8_-dark-mode-_unverified-3_.json`.
- Update `dpc-summary.json` to mark DPC-8 as PASS.

## Out of scope

- Production code changes (`apps/web/src/`). Deferred to PIA-MUR-D-004-IMPL.
- Adding a theme picker / multi-theme support.
- Color contrast improvements (already pass axe; not a blocker).

## Response syntax

- **"Approve PIA-MUR-D-005"** → I implement option C (auto-theme JS), re-run the harness, commit the changes, and surface the updated pre-flight report.
- **"Approve with overrides"** → e.g., "use option A (CSS reordering) only" — I document the override.
- **"Reject"** → defer; the implementation contract will need to address it.
