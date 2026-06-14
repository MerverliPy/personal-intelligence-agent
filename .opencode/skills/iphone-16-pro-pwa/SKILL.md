---
name: iphone-16-pro-pwa
description: Audit, design, implement, and test an iPhone 16 Pro portrait-first, network-required PWA with safe-area, viewport, touch, keyboard, motion, accessibility, and installed-mode rigor.
compatibility: opencode
metadata:
  primary-device: iphone-16-pro
  orientation: portrait
---

## Primary environments

- iPhone 16 Pro Safari
- iPhone 16 Pro installed PWA
- iPhone 16 Pro iOS Chrome
- approved additional iPhone generations

## Design rules

- Use `viewport-fit=cover` only with deliberate safe-area handling.
- Use runtime `env(safe-area-inset-*)` values; do not guess fixed insets.
- Handle dynamic browser chrome and viewport-height changes.
- Keep focused form controls visible when the keyboard opens.
- Keep visually compact controls touch-safe.
- Do not make critical actions gesture-only.
- Support adaptive motion, user-selectable motion, and reduced motion.
- Support progressive disclosure, screen-specific density, and user-selectable density.
- Validate text scaling, themes, focus, semantics, and contrast.
- Treat installed mode as a distinct environment.
- Provide explicit online failure and reconnect behavior.
- Do not add offline behavior unless a new decision explicitly reverses the network-required policy.

## Evidence

Require runtime screenshots or recordings, structured physical-device results, environment identification, commit identity, and automated comparison.
