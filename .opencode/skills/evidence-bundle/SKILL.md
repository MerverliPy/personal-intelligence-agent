---
name: evidence-bundle
description: Build a redacted, traceable evidence package connecting baseline, decisions, contracts, commits, automated results, physical-device results, feature parity, rollback, and pull-request delivery.
compatibility: opencode
metadata:
  output: evidence-manifest
  security: redact-secrets
---

## Required links

```text
baseline evidence
  -> decision ID
  -> approved alternative
  -> design contract
  -> implementation contract
  -> commit(s)
  -> automated test evidence
  -> physical-device evidence
  -> acceptance result
```

## Bundle contents

- manifest;
- before-and-after artifacts;
- environment and commit metadata;
- feature-parity matrix;
- accessibility report;
- performance report;
- backend regression report;
- dependency records;
- device reports;
- disagreement and root-cause reports;
- known limitations;
- rollback instructions;
- pull-request description.

## Security

Review every artifact for secrets, tokens, cookies, personal data, and sensitive production information. Redact or exclude it before persistence.
