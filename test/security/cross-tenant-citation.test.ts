// ---------------------------------------------------------------------------
// Security: Cross-tenant citation rejection (P3-T10)
// ---------------------------------------------------------------------------
// Per FR-CIT-003, FR-AUTH-006, FR-AUTH-007:
//   Citations must be rejected when they reference a chunk from a
//   different workspace. The deterministic verifier (P3-T07) enforces
//   this via the CHUNK_WRONG_WORKSPACE check. This test asserts that
//   behavior using seeded fixtures in two workspaces.
// ---------------------------------------------------------------------------

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { verifyCitations, type VerifiableCitation, type VerifierInput } from '@pia/knowledge';
import {
  setupSecurityDatabase,
  teardownSecurityDatabase,
  seedSecurityFixtures,
  isDatabaseAvailable,
  type SecurityFixtureRegistry,
} from './helpers/setupSecurity.js';

let pool: Pool | undefined;
let fixtures: SecurityFixtureRegistry | undefined;
let dbAvailable = false;

beforeAll(async () => {
  dbAvailable = await isDatabaseAvailable();
  if (!dbAvailable) {
    console.warn('PostgreSQL unavailable — cross-tenant security test will be skipped.');
    return;
  }
  pool = await setupSecurityDatabase();
  fixtures = await seedSecurityFixtures(pool);
}, 60_000);

afterAll(async () => {
  if (pool) {
    await teardownSecurityDatabase();
  }
}, 30_000);

describe('cross-tenant citation rejection (P3-T10 security)', () => {
  it('rejects a citation that references a chunk in another workspace', async () => {
    if (!dbAvailable) return;
    if (!pool || !fixtures) throw new Error('Setup did not complete');

    // The model run is in alpha; the citation chunk belongs to the OTHER workspace.
    const crossTenantCitation: VerifiableCitation = {
      id: 'cite-cross-tenant-001',
      chunkId: fixtures.otherChunkId,
      documentVersionId: fixtures.otherDocumentVersionId,
      sourceLocator: { type: 'paragraph', ordinal: 0 },
    };

    const evidenceMap = new Map<string, { chunkId: string; documentVersionId: string }>();
    // The model incorrectly included the cross-tenant chunk in the evidence map
    // (this simulates a retrieval-layer leak). The verifier must still catch it.
    evidenceMap.set(fixtures.otherChunkId, {
      chunkId: fixtures.otherChunkId,
      documentVersionId: fixtures.otherDocumentVersionId,
    });

    const input: VerifierInput = {
      workspaceId: fixtures.workspaceId, // alpha
      modelRunId: '00000000-0000-0000-0000-000000000001',
      citations: [crossTenantCitation],
      evidenceMap,
    };

    const result = await verifyCitations(pool, input);

    expect(result.allValid).toBe(false);
    expect(result.invalidCount).toBe(1);
    const perCite = result.results[0]!;
    expect(perCite.status).toBe('INVALID_CROSS_WORKSPACE');
    expect(perCite.reasonCode).toBe('CHUNK_WRONG_WORKSPACE');
  });

  it('accepts a citation that references a chunk in the same workspace', async () => {
    if (!dbAvailable) return;
    if (!pool || !fixtures) throw new Error('Setup did not complete');

    const sameWorkspaceCitation: VerifiableCitation = {
      id: 'cite-same-ws-001',
      chunkId: fixtures.chunkId,
      documentVersionId: fixtures.documentVersionId,
      sourceLocator: { type: 'paragraph', ordinal: 0 },
    };

    const evidenceMap = new Map<string, { chunkId: string; documentVersionId: string }>();
    evidenceMap.set(fixtures.chunkId, {
      chunkId: fixtures.chunkId,
      documentVersionId: fixtures.documentVersionId,
    });

    const input: VerifierInput = {
      workspaceId: fixtures.workspaceId,
      modelRunId: '00000000-0000-0000-0000-000000000002',
      citations: [sameWorkspaceCitation],
      evidenceMap,
    };

    const result = await verifyCitations(pool, input);
    expect(result.allValid).toBe(true);
    expect(result.validCount).toBe(1);
    expect(result.results[0]?.status).toBe('VALID');
  });
});
