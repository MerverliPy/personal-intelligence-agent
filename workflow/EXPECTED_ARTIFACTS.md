# Expected Artifacts

All execution artifacts belong under `.ui-redesign/`.

```text
.ui-redesign/
  adapter/
    REPOSITORY_ADAPTER.md
  audits/
    repository-inventory.md
    product-model.md
    screen-inventory.md
    mobile-ux-audit.md
    accessibility-baseline.md
    performance-baseline.md
  baseline/
    feature-parity-matrix.md
    route-map.md
    data-flow-map.md
  concepts/
    <concept-id>/
      brief.md
      prototype/
      screenshots/
  contracts/
    design-contract.json
    implementation-contract.md
    performance-budget.json
  decisions/
    DECISION_LEDGER.md
    <decision-id>.md
  evidence/
    manifest.json
    automated/
    devices/
    before-after/
    reports/
  handoffs/
    final-handoff.md
  reports/
    validation-summary.md
    root-cause-<id>.md
    workflow-improvement-proposal.md
  state/
    workflow-state.json
```

Raw artifacts containing personal data, credentials, tokens, or sensitive production content must be excluded or redacted before persistence.
