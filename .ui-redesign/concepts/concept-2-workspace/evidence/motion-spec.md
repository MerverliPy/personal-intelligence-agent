# Workspace — Motion spec

All durations and curves honor `prefers-reduced-motion: reduce` (set to `0.01ms`).

| Element | Property | Duration | Easing | Notes |
|---|---|---:|---|---|
| Card press | transform: scale | 100ms | `ease-out` | Scale 1.0 → 0.99. Mirrors the standard iOS Mail card press. |
| Card release | transform: scale | 200ms | `ease-in-out` | Back to 1.0. |
| Tab switch (active state) | color, fill | 120ms | `ease-out` | Tab text/icon color transitions between `--ink-muted` and `--accent`. |
| FAB press | transform: scale + box-shadow | 100ms | `ease-out` | Scale 1.0 → 0.94; shadow shrinks. |
| FAB release | transform: scale + box-shadow | 220ms | `ease-in-out` | Back to 1.0; shadow expands. |
| Sheet open | transform: translateY | 280ms | `cubic-bezier(0.32, 0.72, 0, 1)` | From `100%` to `0`. Slightly slower than Calm (250ms) to match the card's heavier feel. |
| Sheet close | transform: translateY | 240ms | `cubic-bezier(0.32, 0.72, 0, 1)` | Reverse. |
| Backdrop fade | opacity | 200ms | `ease` | 0 → 0.4 alpha. |
| Network banner appear | transform: translateY | 240ms | `cubic-bezier(0.32, 0.72, 0, 1)` | Slides from -100% to 0. |
| Progress bar (upload) | width | 300ms | `ease` | During ingestion, the progress bar smoothly grows. |
| Tab switch screen content | opacity | 100ms | `ease` | Cross-fade between previous and next screens. **UNVERIFIED for `prefers-reduced-motion`.** |
| Card insertion (list) | transform: translateY + opacity | 220ms | `ease-out` | New cards slide in 8pt and fade. |

## Reduced-motion behavior

When `prefers-reduced-motion: reduce` is set OR the dev toggle `Reduce motion` is checked:

- Card press, tab switch, FAB press → instant.
- Sheet open/close → instant.
- Network banner → instant.
- Tab switch cross-fade → instant.
- Card insertion → no animation.

## Dark-mode timing

Dark-mode color transitions are 120ms `ease-out` to avoid flash. There is no logo-splash or app-launch animation.

## Touch-action

All interactive elements set `touch-action: manipulation` to remove the iOS 300ms tap delay (UNVERIFIED: requires browser testing per `PIA-MUR-D-002` §5 item 13).

## Bounce-overscroll

`app-main` uses `-webkit-overflow-scrolling: touch` for iOS native momentum. Bounce-overscroll is allowed; the body background matches the sheet panel background (`--bg`) so overscroll appears clean.

## Active-tab highlight

The active tab in Workspace uses a 2pt-thick top accent line (`border-top: 2pt solid var(--accent);` on the tab). The transition is 120ms `ease-out`. The Workspace tab's icon is slightly larger (26pt vs 24pt) to give it visual weight — implementation may add `transform: scale(1.05)` to the active tab icon.
