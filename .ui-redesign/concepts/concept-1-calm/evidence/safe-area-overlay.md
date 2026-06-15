# Calm — Safe-area + touch-target annotated overlay

`08-annotated-safe-area.svg` shows the iPhone 16 Pro portrait viewport (393×852pt) with colored bands marking the regions the design contract and implementation contract must respect.

## Bands (top → bottom)

| Color                    | Region              |      pt | Source / standard                                                                                                          |
| ------------------------ | ------------------- | ------: | -------------------------------------------------------------------------------------------------------------------------- |
| Green (15% alpha)        | Safe area top       |      47 | iOS HIG: status bar + Dynamic Island clearance (44pt status bar + 3pt visual margin)                                       |
| Yellow (18% alpha)       | Dynamic Island band |   11–47 | iPhone 16 Pro: 124×37pt centered pill; content must start at or below 60pt                                                 |
| Blue (18% alpha)         | Header              |   47–91 | Calm header height (44pt) — title centered, avatar at `left: 8pt`                                                          |
| White (4% alpha)         | Main scroll content | 128–769 | Padding-bottom = `--tab-bar-h` + `env(safe-area-inset-bottom)`                                                             |
| Pink (10% alpha, dashed) | Row touch target    |    ≥ 44 | HIG §44: minimum 44×44pt; Calm enforces 60pt row height for primary lists                                                  |
| Blue (18% alpha)         | Tab bar             | 769–818 | iOS tab bar: 49pt at 1x. Calm: `--tab-bar-h: 49pt`                                                                         |
| Green (15% alpha)        | Safe area bottom    | 818–852 | iOS home indicator zone: 34pt typical on Face ID devices                                                                   |
| Purple (dashed circle)   | FAB                 |    56pt | Anchored to `bottom: calc(tab-bar-h + 16pt + env(safe-area-inset-bottom))`, `right: max(16pt, env(safe-area-inset-right))` |

## Side safe areas

8pt green strips at the left and right edges mark the **landscape** safe area; Calm uses `left: 8pt` for the avatar in portrait. In landscape (`landscape-left` / `landscape-right`) the safe-area-inset-left and -right expand to the camera/notch side and the avatar moves to the side opposite the camera.

## Tab-bar safe area

The tab bar uses `--tab-bar-h: 49pt` + `env(safe-area-inset-bottom, 0px)`. On iPhone 16 Pro the bottom safe-area inset is 34pt, giving a total tab-bar bottom area of 83pt. The home indicator (5×134pt) is centered horizontally with 8pt clearance from the bottom edge.

## Touch target enforcement

| Element        |                  Min size | Position          | Notes                                                                                                                                                                            |
| -------------- | ------------------------: | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Row in list    |                   44×44pt | full-width        | 16pt left/right padding; row height = 60pt to give more thumb-reach                                                                                                              |
| Tab in tab bar |                 ~131×49pt | full-1/3 of width | 3 tabs at 393pt = 131pt each — well above 44pt                                                                                                                                   |
| FAB            |                   56×56pt | bottom-right      | HIG §56: ≥ 56pt for primary floating action                                                                                                                                      |
| Citation chip  |                   44×24pt | inline with text  | Height is 24pt (tall enough for the visible glyph); the 44pt vertical tap target is implied by the line height — implementation must add a transparent hit-rect. **UNVERIFIED.** |
| Send button    |                   56×56pt | end of composer   | 56pt matches HIG for primary messaging actions                                                                                                                                   |
| Avatar         | 32pt visible, 44pt target | top-left          | Visible 32pt circle inside a 44pt tap area                                                                                                                                       |
| Back button    |                   44×44pt | top-left (detail) | Replaces avatar in conversation detail                                                                                                                                           |

## What this overlay does NOT verify (UNVERIFIED for the device-validation phase)

- Actual `prefers-reduced-motion` support in iOS 16 Pro installed PWA mode.
- `<dialog>` focus management on iOS Safari.
- The 44pt touch target for the citation chip in a real iOS touch environment (current SVG is conceptual).
- Smart Invert compatibility of the status badges.

All UNVERIFIED items are also recorded in `PIA-MUR-D-002` §10 and in the parent decision-packet.md for this concept.
