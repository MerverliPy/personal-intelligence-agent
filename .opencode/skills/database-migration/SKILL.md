---
name: database-migration
description: Design and verify PostgreSQL migrations with tenant isolation, forward compatibility, rollback or restore reasoning, and zero unsafe destructive changes.
compatibility: opencode
metadata:
  database: postgresql
  workflow: migration
---

## Rules

- Prefer additive expand-and-contract migrations.
- Add nullable columns or safe defaults before requiring data.
- Backfill separately from schema locks when data volume may be material.
- Create indexes concurrently in production-oriented migrations where supported.
- Include workspace-scoped indexes for tenant-owned tables.
- Preserve immutable source and audit provenance.
- Never drop or rewrite data without explicit approval and a tested restore path.
- Test migration from a clean database and from the previous schema snapshot.
