# PIA-MUR-D-013 — Feature Critique Panel: Group 1 (Core Shell)

## Objective

Evaluate the Core Shell features (design tokens, safe-area insets, bottom tab bar, top app bar) for structural soundness, accessibility, visual correctness, and adherence to the approved design contract (PIA-MUR-D-004) before acceptance.

## Verdict

**REVISE** — The features have structural value but require targeted revision before acceptance.

## Panel Participants

- **Critic** (adversarial): `feature-critic`
- **Advocate** (constructive): `feature-advocate`
- **Judge** (neutral synthesizer): `feature-judge`

## Findings by Severity

### P0 (blocking — must fix)

1. Tab navigation click handler absent — tabs are visual but non-functional
2. Dual headers rendered (app bar + page header) — violates Stream concept

### P1 (high — should fix)

1. Tab order does not match design contract (Conversations must be first)
2. Hardcoded body colors instead of CSS custom property tokens
3. Missing 2pt active tab indicator
4. Old CSS from pre-redesign inline styles still present
5. Undefined CSS custom properties referenced (unresolved var() calls)

### P2 (medium — good practice)

1. Dark mode uses hardcoded colors, not token-driven
2. Unconditional 59pt safe-area-top padding on all pages (only `#app-shell` needs it)
3. Missing workspace-scoped safe-area adjustment
4. Missing or misnamed token values (`--s-*` spacing tokens)
5. Line-height not set via tokens
6. Header content overflows on long workspace names

### P3 (low — polish)

1. Mode-of-conversation sheet scope: does not reset on tab switch
2. z-index values hardcoded (risk of stacking context conflicts)
3. No skip-to-content link for keyboard users
4. Body height uses 100vh instead of 100dvh (iOS Safari URL bar issue)

## Files Evaluated

- `apps/web/src/pages/shared.ts` (design tokens, app shell, tab bar, app bar)
- `apps/web/src/pages/conversation-list.ts`
- `apps/web/src/pages/conversation-detail.ts`
- `apps/web/src/pages/document-list.ts`
- `apps/web/src/pages/search.ts`
- `apps/web/src/pages/document-detail.ts`
- `apps/web/src/pages/upload.ts`
- `apps/api/src/routes/web.ts`

## Remediations Applied

Commit `d3e28a6` and `4678602` applied the following fixes:

1. Added tab navigation click handler + reordered tabs (Conversations default)
2. Removed dual headers; app bar is the single header
3. Computed avatar initial in JS (was hardcoded)
4. Added 2pt active tab indicator (CSS ::after pseudo-element)
5. Body colors and line-height set via CSS custom properties
6. Added text-overflow ellipsis on header title
7. Added skip-to-content link for keyboard users
8. z-index values converted to CSS custom property tokens
9. Body height changed to 100dvh
10. Container padding changed to `--s-4` token
11. `window.__piaWorkspaceId` set on all workspace pages
12. Tab navigation extracts workspaceId from URL path

## Files Changed

```
apps/web/src/pages/shared.ts                  | 109 ++++++++++++++++---------
apps/web/src/pages/conversation-detail.ts     |  25 ++++++----------
apps/web/src/pages/document-list.ts           |   1 +
apps/web/src/pages/search.ts                  |   1 +
```

## State

**DONE** — All P0 items resolved; P1 items resolved; P2/P3 items partially resolved in follow-up commits (4678602, 0cf39ce, 038910f). Remaining polish items tracked for device-validation.
