---
name: real-ui-validation
description: Validate the real running application, real routes, real APIs, real authentication, real data, and physical-device behavior without accepting mock-only evidence.
compatibility: opencode
metadata:
  validation: real-runtime
  mocks: prohibited-for-acceptance
---

## Acceptance evidence must use

- actual application runtime;
- actual product routes and flows;
- actual integrations;
- actual repository data;
- real authentication path;
- physical iPhone 16 Pro;
- approved browsers and installed mode.

## Insufficient by itself

- source inspection;
- static screenshots;
- component snapshots;
- mock server;
- fixtures;
- browser emulation;
- unit tests;
- generated reports without reproducing the user flow.

## Disagreement rule

When automated and physical results differ:

1. mark the gate blocked;
2. preserve both results;
3. reproduce the discrepancy;
4. perform root-cause analysis;
5. update the relevant contract or implementation;
6. retest both environments.
