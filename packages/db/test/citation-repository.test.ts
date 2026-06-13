// ---------------------------------------------------------------------------
// Citation repository integration tests
// ---------------------------------------------------------------------------

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Pool } from 'pg';
import { setupTestDatabase, teardownTestDatabase } from './helpers.js';
import { runMigrations, defaultMigrationsDir } from '../src/migrate.js';
import { createConversation, type ConversationRow } from '../src/conversations.js';
import { createMessage, type PersistedMessage } from '../src/messages.js';
import { createModelRun, startStreaming, completeModelRun, type ModelRunRow } from '../src/runs.js';
import {
  createCitation,
  getCitationsForMessage,
  getCitationsForModelRun,
  type CitationRow,
} from '../src/citations.js';

// ---------------------------------------------------------------------------
// Test lifecycle
// ---------------------------------------------------------------------------

let pool: Pool;

beforeAll(async () => {
  pool = await setupTestDatabase();
}, 30_000);

afterAll(async () => {
  await teardownTestDatabase();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createWorkspaceAndUser(p: Pool): Promise<{ workspaceId: string; userId: string }> {
  const user = await p.query<{ id: string }>(
    `INSERT INTO users (id, email) VALUES (gen_random_uuid(), $1) RETURNING id`,
    [`cite-test-${Date.now()}@test.com`],
  );
  const userId = user.rows[0]!.id;
  const ws = await p.query<{ id: string }>(
    `INSERT INTO workspaces (id, name, created_by) VALUES (gen_random_uuid(), $1, $2) RETURNING id`,
    [`Cite Test WS ${Date.now()}`, userId],
  );
  const wsId = ws.rows[0]!.id;
  await p.query(
    `INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'OWNER')`,
    [wsId, userId],
  );
  return { workspaceId: wsId, userId };
}

async function createConversationAndMessage(
  p: Pool,
  wsId: string,
  userId: string,
): Promise<{ conversationId: string; messageId: string }> {
  const conv = await createConversation(p, wsId, userId, { mode: 'ASK' });
  const msg = await createMessage(p, wsId, {
    conversationId: conv.id,
    role: 'USER',
    content: 'Test message',
    createdBy: userId,
  });
  return { conversationId: conv.id, messageId: msg.id };
}

async function createChunkPrerequisites(
  p: Pool,
  wsId: string,
  userId: string,
): Promise<{ chunkId: string; documentVersionId: string }> {
  const sf = await p.query<{ id: string }>(
    `INSERT INTO stored_files (workspace_id, storage_provider, object_key, original_filename, size_bytes, checksum_sha256, created_by)
     VALUES ($1, 'test', $2, 'test.pdf', 1000, 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789', $3)
     RETURNING id`,
    [wsId, `${Date.now()}-test`, userId],
  );
  const storedFileId = sf.rows[0]!.id;

  const doc = await p.query<{ id: string }>(
    `INSERT INTO documents (workspace_id, title, created_by)
     VALUES ($1, 'Test Document', $2)
     RETURNING id`,
    [wsId, userId],
  );
  const documentId = doc.rows[0]!.id;

  const dv = await p.query<{ id: string }>(
    `INSERT INTO document_versions (workspace_id, document_id, stored_file_id, version_number, checksum_sha256, created_by)
     VALUES ($1, $2, $3, 1, 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789', $4)
     RETURNING id`,
    [wsId, documentId, storedFileId, userId],
  );
  const documentVersionId = dv.rows[0]!.id;

  const ch = await p.query<{ id: string }>(
    `INSERT INTO document_chunks (workspace_id, document_id, document_version_id, ordinal, content, content_hash, locator, chunking_version)
     VALUES ($1, $2, $3, 0, 'Test chunk content', 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789', '{}', '1.0.0')
     RETURNING id`,
    [wsId, documentId, documentVersionId],
  );
  const chunkId = ch.rows[0]!.id;

  return { chunkId, documentVersionId };
}

async function createRunInWorkspace(
  p: Pool,
  wsId: string,
  convId: string,
  userId: string,
  userMsgId: string,
): Promise<ModelRunRow> {
  return createModelRun(p, wsId, {
    conversationId: convId,
    userMessageId: userMsgId,
    provider: 'fake',
    model: 'fake-v1',
    promptName: 'test.prompt',
    promptVersion: '1.0.0',
  });
}

// ---------------------------------------------------------------------------
// createCitation
// ---------------------------------------------------------------------------

describe('createCitation', () => {
  it('creates a citation with all required fields', async () => {
    const { workspaceId, userId } = await createWorkspaceAndUser(pool);
    const { conversationId, messageId } = await createConversationAndMessage(
      pool,
      workspaceId,
      userId,
    );
    const run = await createRunInWorkspace(pool, workspaceId, conversationId, userId, messageId);
    await startStreaming(pool, workspaceId, run.id);
    await completeModelRun(pool, workspaceId, run.id, {
      status: 'COMPLETED',
      assistantMessageId: messageId,
    });

    const { chunkId, documentVersionId } = await createChunkPrerequisites(
      pool,
      workspaceId,
      userId,
    );

    const citation = await createCitation(pool, {
      workspaceId,
      modelRunId: run.id,
      assistantMessageId: messageId,
      chunkId,
      documentVersionId,
      sourceLocator: { page: 1, line: 10 },
      claimStart: 0,
      claimEnd: 50,
      claimText: 'The sky is blue.',
    });

    expect(citation.id).toBeDefined();
    expect(citation.workspaceId).toBe(workspaceId);
    expect(citation.modelRunId).toBe(run.id);
    expect(citation.assistantMessageId).toBe(messageId);
    expect(citation.claimStart).toBe(0);
    expect(citation.claimEnd).toBe(50);
    expect(citation.sourceLocator).toEqual({ page: 1, line: 10 });
    expect(citation.verificationStatus).toBe('PENDING');
  });

  it('sets verificationStatus to PENDING by default', async () => {
    const { workspaceId, userId } = await createWorkspaceAndUser(pool);
    const { conversationId, messageId } = await createConversationAndMessage(
      pool,
      workspaceId,
      userId,
    );
    const run = await createRunInWorkspace(pool, workspaceId, conversationId, userId, messageId);
    await startStreaming(pool, workspaceId, run.id);
    await completeModelRun(pool, workspaceId, run.id, {
      status: 'COMPLETED',
      assistantMessageId: messageId,
    });

    const { chunkId, documentVersionId } = await createChunkPrerequisites(
      pool,
      workspaceId,
      userId,
    );

    const citation = await createCitation(pool, {
      workspaceId,
      modelRunId: run.id,
      assistantMessageId: messageId,
      chunkId,
      documentVersionId,
      sourceLocator: { section: 'intro' },
      claimStart: null,
      claimEnd: null,
      claimText: 'Assumption.',
    });

    expect(citation.verificationStatus).toBe('PENDING');
  });
});

// ---------------------------------------------------------------------------
// getCitationsForMessage
// ---------------------------------------------------------------------------

describe('getCitationsForMessage', () => {
  it('returns citations for a given message', async () => {
    const { workspaceId, userId } = await createWorkspaceAndUser(pool);
    const { conversationId, messageId } = await createConversationAndMessage(
      pool,
      workspaceId,
      userId,
    );
    const run = await createRunInWorkspace(pool, workspaceId, conversationId, userId, messageId);
    await startStreaming(pool, workspaceId, run.id);
    await completeModelRun(pool, workspaceId, run.id, {
      status: 'COMPLETED',
      assistantMessageId: messageId,
    });

    const { chunkId, documentVersionId } = await createChunkPrerequisites(
      pool,
      workspaceId,
      userId,
    );

    await createCitation(pool, {
      workspaceId,
      modelRunId: run.id,
      assistantMessageId: messageId,
      chunkId,
      documentVersionId,
      sourceLocator: { page: 1 },
      claimStart: 0,
      claimEnd: 10,
      claimText: 'First claim',
    });

    await createCitation(pool, {
      workspaceId,
      modelRunId: run.id,
      assistantMessageId: messageId,
      chunkId,
      documentVersionId,
      sourceLocator: { page: 2 },
      claimStart: 20,
      claimEnd: 30,
      claimText: 'Second claim',
    });

    const citations = await getCitationsForMessage(pool, workspaceId, messageId);
    expect(citations).toHaveLength(2);
    expect(citations[0]!.claimStart).toBe(0);
    expect(citations[0]!.claimEnd).toBe(10);
    expect(citations[1]!.claimStart).toBe(20);
    expect(citations[1]!.claimEnd).toBe(30);
  });

  it('returns empty array when no citations exist', async () => {
    const { workspaceId, userId } = await createWorkspaceAndUser(pool);
    const { conversationId, messageId } = await createConversationAndMessage(
      pool,
      workspaceId,
      userId,
    );

    const citations = await getCitationsForMessage(pool, workspaceId, messageId);
    expect(citations).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// getCitationsForModelRun
// ---------------------------------------------------------------------------

describe('getCitationsForModelRun', () => {
  it('returns citations for a given model run', async () => {
    const { workspaceId, userId } = await createWorkspaceAndUser(pool);
    const { conversationId, messageId } = await createConversationAndMessage(
      pool,
      workspaceId,
      userId,
    );
    const run = await createRunInWorkspace(pool, workspaceId, conversationId, userId, messageId);
    await startStreaming(pool, workspaceId, run.id);
    await completeModelRun(pool, workspaceId, run.id, {
      status: 'COMPLETED',
      assistantMessageId: messageId,
    });

    const { chunkId, documentVersionId } = await createChunkPrerequisites(
      pool,
      workspaceId,
      userId,
    );

    await createCitation(pool, {
      workspaceId,
      modelRunId: run.id,
      assistantMessageId: messageId,
      chunkId,
      documentVersionId,
      sourceLocator: { page: 1 },
      claimStart: 0,
      claimEnd: 10,
      claimText: 'Claim from run',
    });

    const citations = await getCitationsForModelRun(pool, workspaceId, run.id);
    expect(citations).toHaveLength(1);
    expect(citations[0]!.claimStart).toBe(0);
    expect(citations[0]!.claimEnd).toBe(10);
  });
});
