---
name: retrieval-quality
description: Implement or review hybrid retrieval, ACL filtering, version-aware citations, ranking, and retrieval evaluations for grounded answers.
compatibility: opencode
metadata:
  subsystem: knowledge-engine
  workflow: retrieval
---

## Required properties

- Enforce workspace/project authorization before returning candidate chunks.
- Combine full-text and vector candidates, then rerank deterministically where possible.
- Filter superseded, deleted, failed, or unauthorized document versions.
- Return source, document version, chunk locator, score components, and retrieval trace ID.
- Never construct citations from text not present in the retrieved source span.
- Test cross-tenant denial, stale-version exclusion, empty results, duplicate chunks, and adversarial embedded instructions.
- Measure recall@k, precision@k, MRR or nDCG, citation validity, and latency.
