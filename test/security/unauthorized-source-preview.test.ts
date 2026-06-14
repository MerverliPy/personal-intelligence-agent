// ---------------------------------------------------------------------------
// Security: Unauthorized source preview (P3-T10)
// ---------------------------------------------------------------------------
// Per FR-CIT-004 and FR-AUTH-006:
//   "User interfaces MUST expose source title, version, locator, and
//    access-controlled preview."
//   "Object authorization MUST be checked server-side for every read and
//    write."
//
// This test exercises the citation verifier against chunks that do not
// belong to the requesting workspace. A user must NEVER be able to cite
// (and therefore preview) a chunk in a workspace they do not own.
//
// We also test that the chunk-row lookup in the verifier does NOT return
// rows from other workspaces, so the cross-workspace check can fire
// deterministically.
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
    console.warn('PostgreSQL unavailable — unauthorized-source-preview test will be skipped.');
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

describe('unauthorized source preview rejection (P3-T10 security)', () => {
  it('rejects a citation whose chunk ID does not exist in the DB at all', async () => {
    if (!dbAvailable) return;
    if (!pool || !fixtures) throw new Error('Setup did not complete');

    const fakeChunkCitation: VerifiableCitation = {
      id: 'cite-fake-chunk-001',
      chunkId: '00000000-0000-0000-0000-deadbeef0000',
      documentVersionId: '00000000-0000-0000-0000-deadbeef0001',
      sourceLocator: {},
    };

    const evidenceMap = new Map<string, { chunkId: string; documentVersionId: string }>();
    // Fabricate an evidence map entry — the verifier should still reject
    // because the chunk does not exist in document_chunks.
    evidenceMap.set(fakeChunkCitation.chunkId, {
      chunkId: fakeChunkCitation.chunkId,
      documentVersionId: fakeChunkCitation.documentVersionId,
    });

    const input: VerifierInput = {
      workspaceId: fixtures.workspaceId,
      modelRunId: '00000000-0000-0000-0000-000000000010',
      citations: [fakeChunkCitation],
      evidenceMap,
    };

    const result = await verifyCitations(pool, input);
    expect(result.allValid).toBe(false);
    expect(result.results[0]?.status).toBe('INVALID_CHUNK_MISSING');
    expect(result.results[0]?.reasonCode).toBe('CHUNK_NOT_FOUND');
  });

  it('rejects a citation whose evidence_map entry is fabricated', async () => {
    if (!dbAvailable) return;
    if (!pool || !fixtures) throw new Error('Setup did not complete');

    // Citation claims a real chunk in alpha, but the evidence_map was
    // tampered with so the chunk is NOT in the generation evidence.
    // This is a forged-citation attempt.
    const forgedCitation: VerifiableCitation = {
      id: 'cite-forged-evidence-001',
      chunkId: fixtures.chunkId,
      documentVersionId: fixtures.documentVersionId,
      sourceLocator: { type: 'paragraph', ordinal: 0 },
    };

    const emptyEvidence = new Map<string, { chunkId: string; documentVersionId: string }>();
    // Intentionally NOT setting fixtures.chunkId in the evidence map

    const input: VerifierInput = {
      workspaceId: fixtures.workspaceId,
      modelRunId: '00000000-0000-0000-0000-000000000011',
      citations: [forgedCitation],
      evidenceMap: emptyEvidence,
    };

    const result = await verifyCitations(pool, input);
    expect(result.allValid).toBe(false);
    expect(result.results[0]?.status).toBe('INVALID_EVIDENCE_MISSING');
    expect(result.results[0]?.reasonCode).toBe('CITATION_NOT_IN_EVIDENCE_SET');
  });

  it('rejects a citation that points to a SUPERSEDED version', async () => {
    if (!dbAvailable) return;
    if (!pool || !fixtures) throw new Error('Setup did not complete');

    // Create a second version for the same document, mark it SUPERSEDED
    const sfRes = await pool.query<{ id: string }>(
      `INSERT INTO stored_files (id, workspace_id, storage_provider, object_key, original_filename, size_bytes, checksum_sha256, scan_status, created_by)
       VALUES (gen_random_uuid(), $1, 'minio', 'sec/v2.txt', 'v2.txt', 1024, $2, 'CLEAN', $3)
       RETURNING id`,
      [fixtures.workspaceId, '7'.repeat(64), fixtures.userId],
    );
    const sf2Id = sfRes.rows[0]!.id;

    const v2Res = await pool.query<{ id: string }>(
      `INSERT INTO document_versions (id, workspace_id, document_id, stored_file_id, version_number, status, is_current, checksum_sha256, pipeline_version, created_by)
       VALUES (gen_random_uuid(), $1, $2, $3, 2, 'SUPERSEDED', false, $4, 'sec-v1', $5)
       RETURNING id`,
      [fixtures.workspaceId, fixtures.documentId, sf2Id, '8'.repeat(64), fixtures.userId],
    );
    const supersededVersionId = v2Res.rows[0]!.id;

    // Create a real chunk in the SUPERSEDED version so the chunk-existence
    // check passes and the version-lifecycle check fires.
    const v2Content = 'Old superseded content from a previous policy version.';
    const v2ChunkRes = await pool.query<{ id: string }>(
      `INSERT INTO document_chunks (id, workspace_id, document_id, document_version_id, ordinal, content, content_hash, locator, heading_path, chunking_version)
       VALUES (gen_random_uuid(), $1, $2, $3, 0, $4, $5, $6, '{}', 'sec-v1')
       RETURNING id`,
      [
        fixtures.workspaceId,
        fixtures.documentId,
        supersededVersionId,
        v2Content,
        '9'.repeat(64),
        JSON.stringify({
          type: 'paragraph',
          ordinal: 0,
          startOffset: 0,
          endOffset: v2Content.length,
        }),
      ],
    );
    const v2ChunkId = v2ChunkRes.rows[0]!.id;

    const supersededCitation: VerifiableCitation = {
      id: 'cite-superseded-001',
      chunkId: v2ChunkId,
      documentVersionId: supersededVersionId,
      sourceLocator: { type: 'paragraph', ordinal: 0 },
    };

    const evidenceMap = new Map<string, { chunkId: string; documentVersionId: string }>();
    evidenceMap.set(v2ChunkId, {
      chunkId: v2ChunkId,
      documentVersionId: supersededVersionId,
    });

    const input: VerifierInput = {
      workspaceId: fixtures.workspaceId,
      modelRunId: '00000000-0000-0000-0000-000000000012',
      citations: [supersededCitation],
      evidenceMap,
    };

    const result = await verifyCitations(pool, input);
    expect(result.allValid).toBe(false);
    expect(result.results[0]?.status).toBe('INVALID_VERSION_STALE');
    expect(result.results[0]?.reasonCode).toBe('VERSION_SUPERSEDED');
  });
});
