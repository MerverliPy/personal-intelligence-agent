---
description: Produce a complete, schema-validated design contract from approved concept and product model decisions.
agent: mobile-ui-orchestrator
---

$ARGUMENTS

Verify that the repository adapter (PIA-MUR-ADAPTER-001), product model (PIA-MUR-D-002), and selected concept are approved. Confirm all required pre-approvals from the adapter are resolved. Record the design-system-architect's design direction selection in the decision ledger. Request approval for the design contract gate. If no approved concept exists, stop and report which prerequisite is missing.

Invoke the design-system-architect specialist with the approved concept, product model, and baseline evidence. Produce a machine-readable design contract (JSON, validated against contracts/design-contract.schema.json) and a human-readable companion (MD). Record all decisions translated by the contract. Do not authorize any product code changes.
