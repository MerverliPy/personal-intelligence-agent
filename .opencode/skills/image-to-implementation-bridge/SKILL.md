---
name: image-to-implementation-bridge
description: Translate visual references into contract-compatible PIA implementation guidance without treating images as direct authority.
compatibility: opencode
metadata:
  audience: concept-and-frontend-agents
  output: implementation-bridge
---

## Use this skill when

A task uses screenshots, generated images, prototype frames, or visual references to influence PIA code or contracts.

## Principle

Images are evidence or inspiration. They are not implementation authority. Only approved decisions and contracts authorize product changes.

## Procedure

1. Describe the image objectively.
2. Extract concrete UI details: layout, hierarchy, state, motion, density, color, and interaction cues.
3. Compare extracted details against the approved adapter, decision ledger, and design contract.
4. Classify each detail as:
   - already approved;
   - needs decision;
   - rejected due to conflict;
   - presentation-only.
5. Convert eligible details into a decision packet or contract amendment.
6. Do not implement until the resulting scope is approved.

## Reject details that

- require new routes or APIs;
- invent data or product behavior;
- violate approved tokens or safe-area rules;
- weaken accessibility;
- add unapproved dependencies;
- change offline or PWA assumptions;
- conflict with real PIA content or evidence.

## Output

Return a mapping table with: visual detail, source image/path, classification, required approval, and implementation note.
