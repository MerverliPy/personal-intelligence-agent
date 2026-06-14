# Calm — Motion spec

All durations and curves honor `prefers-reduced-motion: reduce` (set to `0.01ms`).

| Element | Property | Duration | Easing | Notes |
|---|---|---:|---|---|
| Tab switch (active state) | color, fill | 100ms | `linear` | Tab text/icon color transitions between `--fg-muted` and `--fg`. |
| Row press | background | 80ms | `ease-out` | Tap-state highlight on rows. |
| Row press release | background | 200ms | `ease-in-out` | Return to default. |
| FAB press | transform: scale | 100ms | `ease-out` | Scale 1.0 → 0.94. |
| FAB release | transform: scale | 200ms | `ease-in-out` | Back to 1.0. |
| Sheet open | transform: translateY | 250ms | `cubic-bezier(0.32, 0.72, 0, 1)` | From `100%` to `0`. iOS-native sheet curve. |
| Sheet close | transform: translateY | 220ms | `cubic-bezier(0.32, 0.72, 0, 1)` | Reverse. |
| Backdrop fade | opacity | 200ms | `ease` | 0 → 0.4 alpha. |
| Network banner appear | transform: translateY | 220ms | `cubic-bezier(0.32, 0.72, 0, 1)` | Slides from -100% to 0. |
| Streamed text reveal | n/a | 0ms | n/a | No character-by-character reveal; the entire delta is appended in a single frame (mirrors `appendAssistantDelta` at `conversation-detail.ts:305-318`). |

## Reduced-motion behavior

When `prefers-reduced-motion: reduce` is set OR the dev toggle `Reduce motion` is checked:

- Sheet open/close → instant.
- Tab and row color transitions → instant.
- FAB scale → no transform.
- Network banner → instant.

## Dark-mode timing

Dark-mode color transitions are 100ms `ease-out` to avoid flash. There is no logo-splash or app-launch animation.

## Scroll behavior

- `app-main` uses `-webkit-overflow-scrolling: touch` for iOS native momentum.
- Bounce-overscroll is allowed (the standard iOS rubber-band) but the body background matches the sheet panel background (`--bg`) so overscroll appears clean.
- Pull-to-refresh is **not** implemented in the prototype; it would be added in the implementation-contract phase.

## Touch target timing

- All interactive elements (rows, tabs, FAB, citation chips, send button, search button) have a tap target ≥ 44pt.
- Tap targets are hit-tested before hover (there is no hover on touch).
- The `touchstart` → `touchend` → `click` sequence is the standard 300ms delay only if `touch-action` is not set; Calm sets `touch-action: manipulation` on all interactive elements to remove the 300ms delay (UNVERIFIED: requires browser testing per `PIA-MUR-D-002` §5 item 13).
