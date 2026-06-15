# Device-Validation Pre-flight — iPhone 16 Pro (PIA-MUR-D-005 candidate + downstream)

**Status:** `IN_PROGRESS`
**Date:** 2026-06-14
**Phase:** device-validation pre-flight, between `design-contract` (PIA-MUR-D-004) and `implementation-contract`
**Authority:** PIA-MUR-D-001 (adapter), PIA-MUR-D-004 (design contract)
**Bridges confirmed live:**

- **Cloudflared quick-tunnel (HTTPS):** `https://sig-mardi-experiences-coastal.trycloudflare.com` → live API at `http://localhost:3000` (PID 216180)
- **Tailscale direct (HTTP):** `http://100.81.83.98:3000` → live API at `http://localhost:3000`
- **Prototype static server (HTTP, Tailscale):** `http://100.81.83.98:8000` → Stream concept prototype at `.ui-redesign/concepts/concept-3-stream/interactive/`

**Tunnel PIDs (for cleanup):**

- Cloudflared: `2006185` (log: `.ui-redesign/evidence/devices/cloudflared.log`)
- Prototype server: `2016765` (log: `.ui-redesign/evidence/devices/prototype-server.log`)

**Target device:** iPhone 16 Pro (or 16 Pro Max); iOS version 17.x+ recommended; Bluetooth keyboard optional.

---

## Bridges (in order of recommendation)

| Bridge                          | URL                                                       | Use for                                                                                                      |
| ------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Cloudflared (HTTPS)**         | `https://sig-mardi-experiences-coastal.trycloudflare.com` | Live API shell, native `<dialog>` baseline, PWA install (Add to Home Screen), service-worker-required checks |
| **Tailscale (HTTP, live API)**  | `http://100.81.83.98:3000`                                | Fast Safari browser iteration against the live API                                                           |
| **Tailscale (HTTP, prototype)** | `http://100.81.83.98:8000`                                | Stream concept prototype (most checks)                                                                       |

The Tailscale prototype path requires the iPhone to be on the same Tailscale network. Both are live as of 2026-06-14.

---

## Test checklist (14 checks: DPC-1 through DPC-14)

For each check, **what to do** / **expected behavior** / **pass criteria** / **if it fails, what to capture** / **how to report** are documented in `.ui-redesign/reports/PIA-MUR-D-005-device-preflight-checklist.md` (the iphone-interaction-specialist's full report).

### Summary of checks (full template in the checklist report)

| ID         | UNVERIFIED    | Bridge               | What to verify                                                                                    |
| ---------- | ------------- | -------------------- | ------------------------------------------------------------------------------------------------- |
| **DPC-1**  | UNVERIFIED-1a | Tailscale prototype  | Custom sheet focus trap (Tab cycle, Esc, backdrop, swipe-down) on iOS 16 Pro Safari               |
| **DPC-2**  | UNVERIFIED-1b | Cloudflared live API | Native `<dialog id="citation-modal">` focus behavior (likely BLOCKED — requires auth)             |
| **DPC-3**  | UNVERIFIED-2  | Cloudflared          | Reduce-motion in installed PWA (sheet snaps instantly with iOS Reduce Motion ON)                  |
| **DPC-4**  | UNVERIFIED-4  | Tailscale prototype  | Touch-target bounding-box sizes (44pt minimum); 32pt avatar and 18×24pt citation chip likely fail |
| **DPC-5**  | UNVERIFIED-6  | Tailscale prototype  | Pixel-perfect match between prototype and SVG screenshots                                         |
| **DPC-6**  | additional    | Either               | Safe-area insets (Dynamic Island, home indicator)                                                 |
| **DPC-7**  | additional    | Either               | `viewport-fit=cover` edge-to-edge                                                                 |
| **DPC-8**  | UNVERIFIED-3  | Tailscale prototype  | Dark mode (auto + manual toggle); status badge contrast                                           |
| **DPC-9**  | additional    | Tailscale prototype  | Dynamic Type AX5 (no clipping)                                                                    |
| **DPC-10** | additional    | Tailscale prototype  | VoiceOver rotor (landmarks, headings, citation chip)                                              |
| **DPC-11** | additional    | Cloudflared          | PWA install + standalone launch (expected FAIL pre-implementation; in-scope for impl-contract)    |
| **DPC-12** | additional    | Tailscale prototype  | External keyboard Tab order (BLOCKED if no BT keyboard)                                           |
| **DPC-13** | additional    | Cloudflared          | Back button in standalone PWA                                                                     |
| **DPC-14** | additional    | Tailscale prototype  | Network-loss banner (T6) + disabled destructive actions                                           |

### Recommended execution order

1. **DPC-3** (reduce-motion) — requires iOS Settings change early.
2. **DPC-11** (PWA install) — installs to Home Screen for subsequent checks.
3. **DPC-1, 4, 5, 6, 7, 8, 9, 14** (in the prototype via Tailscale).
4. **DPC-10, 12, 13** (extra setup; skip if unavailable).
5. **DPC-2** (native dialog) — likely BLOCKED; document and defer.

---

## Result template

Copy this into your reply and fill in one block per check. **Be terse. Redact any cookies, tokens, or user-submitted free-text content from screenshots, recordings, console logs, or written observations.**

```
DPC-1 (UNVERIFIED-1a custom sheet focus): PASS | FAIL | BLOCKED
  - Tab cycles within sheet: Y / N
  - Esc closes sheet: Y / N
  - Backdrop tap closes sheet: Y / N
  - Swipe-down > 80pt closes sheet: Y / N
  - Focus visible on first focusable: Y / N
  - Observation: <one sentence>
  - Captured: <screenshot path or note; redact any cookies/tokens>
  - iOS version: <Settings → General → About>

DPC-2 (UNVERIFIED-1b native dialog focus): PASS | FAIL | BLOCKED
  - If BLOCKED, reason: <"requires authenticated session; deferred">
  - (If tested) Tab cycles within dialog: Y / N
  - (If tested) Esc closes dialog: Y / N

DPC-3 (UNVERIFIED-2 reduce-motion in PWA): PASS | FAIL
  - Safari browser: sheet snaps instantly: Y / N
  - Installed PWA: sheet snaps instantly: Y / N
  - iOS Settings → Reduce Motion: ON / OFF
  - Captured: <screen recording path>

DPC-4 (UNVERIFIED-4 touch targets): PASS | FAIL
  - Citation chip [1] bounding box: __pt × __pt (target 44pt)
  - Tab bar button: __pt × __pt (target 44pt)
  - FAB: __pt × __pt (target 56pt)
  - Send button: __pt × __pt (target 56pt)
  - Avatar: 32pt × 32pt (target 44pt) **LIKELY FAIL**
  - Back chevron: __pt × __pt (target 44pt)
  - Failing elements: <list>

DPC-5 (UNVERIFIED-6 pixel-perfect): PASS | MINOR | FAIL
  - 01 conversation list: PASS / MINOR / FAIL
  - 02 conversation detail: PASS / MINOR / FAIL
  - 03 citation bottom sheet: PASS / MINOR / FAIL
  - 04 document list: PASS / MINOR / FAIL
  - 05 search results: PASS / MINOR / FAIL
  - 06 offline state: PASS / MINOR / FAIL
  - Differences: <one sentence per FAIL>

DPC-6 (safe-area): PASS | FAIL
  - Dynamic Island not overlapped: Y / N
  - Home indicator not overlapped: Y / N
  - Landscape clipping: Y / N

DPC-7 (viewport-fit=cover): PASS | FAIL
  - Portrait edge-to-edge: Y / N
  - Landscape behavior: <observed>

DPC-8 (dark mode): PASS | FAIL
  - Auto-switch on iOS dark mode toggle: Y / N
  - Manual dev toggle matches: Y / N
  - Status badge contrast in dark: <observation>

DPC-9 (AX5): PASS | FAIL
  - No text clipping: Y / N
  - Tab bar still functional: Y / N

DPC-10 (VoiceOver rotor): PASS | FAIL
  - Landmarks present: Y / N
  - Headings descend: Y / N
  - Citation chip announces claim: Y / N

DPC-11 (PWA install + standalone): PASS | FAIL
  - "Add to Home Screen" present in share sheet: Y / N
  - Launches in standalone (no URL bar): Y / N
  - Note: prototype is not yet PWA-capable; expected FAIL pre-implementation

DPC-12 (BT keyboard Tab order): PASS | FAIL | BLOCKED
  - If BLOCKED, reason: <"no BT keyboard">
  - Tab order top-to-bottom: Y / N
  - `/` shortcut focuses search: Y / N

DPC-13 (back button): PASS | FAIL
  - In-app back chevron works: Y / N
  - Swipe-back does not crash: Y / N
  - Cold-relaunch lands on Conversations: Y / N

DPC-14 (offline banner T6): PASS | FAIL
  - Banner appears below Dynamic Island: Y / N
  - FAB at 40% opacity: Y / N
  - Send disabled: Y / N
  - Toggle off restores: Y / N
```

---

## What the orchestrator will do with the results

For each UNVERIFIED item, the orchestrator will:

| Item                         | If PASS                                                            | If FAIL                                      | Decision packet that may be opened |
| ---------------------------- | ------------------------------------------------------------------ | -------------------------------------------- | ---------------------------------- |
| UNVERIFIED-1 (DPC-1 + DPC-2) | PARTIALLY RESOLVED; impl-contract re-tests DPC-2                   | Open PIA-MUR-D-006 (iOS focus fix)           | PIA-MUR-D-006                      |
| UNVERIFIED-2 (DPC-3)         | RESOLVED                                                           | Open PIA-MUR-D-007 (reduce-motion PWA fix)   | PIA-MUR-D-007                      |
| UNVERIFIED-4 (DPC-4)         | RESOLVED                                                           | Open PIA-MUR-D-009 (touch-target fix)        | PIA-MUR-D-009 (new)                |
| UNVERIFIED-6 (DPC-5)         | RESOLVED                                                           | Open PIA-MUR-D-010 (visual-fidelity fix)     | PIA-MUR-D-010 (new)                |
| Safe-area (DPC-6/7)          | RESOLVED                                                           | Open PIA-MUR-D-011 (chrome regression)       | PIA-MUR-D-011 (new)                |
| Dark mode (DPC-8)            | Open PIA-MUR-D-005 (already named) to formalize dark-mode contrast | Open PIA-MUR-D-005 with contrast fix         | PIA-MUR-D-005 (already named)      |
| AX5 (DPC-9)                  | RESOLVED                                                           | Open PIA-MUR-D-012 (AX5 clipping fix)        | PIA-MUR-D-012 (new)                |
| VoiceOver (DPC-10)           | RESOLVED                                                           | Open PIA-MUR-D-013 (ARIA fix)                | PIA-MUR-D-013 (new)                |
| PWA install (DPC-11)         | Documentation only                                                 | In-scope for implementation contract         | (no new decision)                  |
| BT keyboard (DPC-12/13)      | RESOLVED                                                           | Open PIA-MUR-D-014 (navigation-behavior fix) | PIA-MUR-D-014 (new)                |
| Offline banner (DPC-14)      | RESOLVED                                                           | Open PIA-MUR-D-015 (offline-state fix)       | PIA-MUR-D-015 (new)                |

After all DPCs are reported:

- Orchestrator updates `phases.implementation-contract.pause_reason` in `workflow-state.json`.
- New `evidence.device-validation` entries added (paths to screenshots, recordings, the user-completed Part B template).
- New `blockers[]` entries added for any DPC that opens a new decision packet.
- Surfaces PIA-MUR-D-004-IMPL for next approval, OR a follow-up decision packet (PIA-MUR-D-005 through -015) if any DPC fails.

---

## Safety reminders (from `REPOSITORY_ADAPTER.md`)

- Do not include session cookies, OIDC tokens, embedding vectors, user-submitted documents, or free-text feedback in any screenshot, recording, console log, or report.
- Use the test account's synthetic data only.
- Wipe `Set-Cookie` headers from any inspector screenshots.
- The tunnel URLs are best-effort and not for production.

---

## Bridge management

To stop the cloudflared tunnel:

```bash
kill $(cat .ui-redesign/evidence/devices/cloudflared.pid)
```

To stop the prototype server:

```bash
kill $(cat .ui-redesign/evidence/devices/prototype-server.pid)
```

The orchestrator will leave both running until the pre-flight is complete or the user requests a stop.

---

**Status: ready for user to execute DPC-1 through DPC-14.**
