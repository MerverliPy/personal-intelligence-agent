// ---------------------------------------------------------------------------
// Security: Provider-failure graceful degradation (P3-T10)
// ---------------------------------------------------------------------------
// Per NFR-REL-005 and docs/07_TEST_EVALUATION_STRATEGY.md §2 (Resilience):
//   "A provider outage MUST degrade with an explicit error or configured
//    fallback, not silent data loss."
//
// This test injects a failing model gateway into the orchestrator and
// asserts that:
//   1. The orchestrator emits a `run.failed` SSE event with a stable
//      error code (MODEL_PROVIDER_UNAVAILABLE), not a crash.
//   2. The run row in model_runs transitions to FAILED with an error
//      code and safe message.
//   3. No PII or raw provider error messages leak to the client.
// ---------------------------------------------------------------------------

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import {
  AssistantOrchestrator,
  ModelGatewayError,
  type ModelGateway,
  type GenerationRequest,
  type GenerationResult,
  type GenerationEvent,
  type RetrievalService as RetrievalServiceType,
} from '@pia/ai';
import type { RetrievalService, RetrievalResponse, RetrievalResult } from '@pia/knowledge';
import { createConversation } from '@pia/db';
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
    console.warn('PostgreSQL unavailable — provider-failure test will be skipped.');
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

/**
 * A model gateway that always fails with a PROVIDER_UNAVAILABLE error.
 * Used to simulate a downstream LLM outage.
 */
function createFailingGateway(): ModelGateway {
  // AUD-P3-102: use the real ModelGatewayError constructor so the
  // catch block's `instanceof ModelGatewayError` check is true and
  // the category-derived safe message is used.
  const err = new ModelGatewayError('upstream connection refused', 'PROVIDER_UNAVAILABLE');

  async function generate(_request: GenerationRequest): Promise<GenerationResult> {
    throw err;
  }

  async function* stream(_request: GenerationRequest): AsyncIterable<GenerationEvent> {
    yield { type: 'error', error: err };
  }

  return { generate, stream };
}

/**
 * Stub retrieval service that returns a single evidence chunk without
 * hitting the database. This isolates the test to provider-failure
 * behavior; the retrieval path is covered by other security and e2e
 * tests.
 */
function createStubRetrievalService(
  workspaceId: string,
  versionId: string,
  chunkId: string,
): RetrievalService {
  const stubResult: RetrievalResult = {
    chunkId,
    documentId: '00000000-0000-0000-0000-0000000000a1',
    documentVersionId: versionId,
    sourceId: '00000000-0000-0000-0000-0000000000a2',
    text: 'Stub evidence for provider-failure test.',
    score: 1.0,
    fusedScore: 1.0,
    lexicalScore: 1.0,
    vectorScore: 1.0,
    locator: { type: 'paragraph', ordinal: 0 },
    sensitivity: 'INTERNAL',
    retrievalTraceId: '00000000-0000-0000-0000-0000000000a3',
  };
  const response: RetrievalResponse = {
    results: [stubResult],
    trace: {
      id: '00000000-0000-0000-0000-0000000000a3',
      workspaceId,
      queryText: 'q',
      configName: 'stub',
      configVersion: '1.0.0',
      latencyMs: 0,
      createdAt: new Date().toISOString(),
    },
    latencyMs: 0,
  };
  return {
    async retrieve() {
      return response;
    },
  } as unknown as RetrievalService;
}

describe('provider-failure graceful degradation (P3-T10 security)', () => {
  it('emits run.failed and persists FAILED status when the provider throws', async () => {
    if (!dbAvailable) return;
    if (!pool || !fixtures) throw new Error('Setup did not complete');

    const orchestrator = new AssistantOrchestrator({
      pool,
      gateway: createFailingGateway(),
      retrievalService: createStubRetrievalService(
        fixtures.workspaceId,
        fixtures.documentVersionId,
        fixtures.chunkId,
      ) as unknown as RetrievalServiceType['retrievalService'],
    });

    const conversation = await createConversation(pool, fixtures.workspaceId, fixtures.userId, {
      title: 'Provider Failure Test',
      mode: 'ASK',
      sensitivity: 'INTERNAL',
    });

    const { runId } = await orchestrator.initiate({
      workspaceId: fixtures.workspaceId,
      conversationId: conversation.id,
      userId: fixtures.userId,
      userContent: 'What does the policy say?',
    });

    // Stream and collect events
    const events: { type: string; error?: { code?: string; message?: string } }[] = [];
    for await (const event of orchestrator.stream({
      workspaceId: fixtures.workspaceId,
      conversationId: conversation.id,
      runId,
      userId: fixtures.userId,
      userContent: 'What does the policy say?',
    })) {
      events.push(event as { type: string; error?: { code?: string; message?: string } });
    }

    // The orchestrator must emit a run.failed event
    const failEvent = events.find((e) => e.type === 'run.failed');
    expect(failEvent).toBeDefined();
    expect(failEvent?.error?.code).toBe('MODEL_PROVIDER_UNAVAILABLE');

    // The error message is present and bounded in length
    expect(failEvent?.error?.message).toBeDefined();
    expect(failEvent?.error?.message!.length).toBeLessThanOrEqual(200);

    // AUD-P3-102: the SSE envelope and the DB `error_safe_message`
    // carry the category-derived sanitized string, NOT the raw
    // provider text. The raw provider text is logged to the
    // observability stream (console.error) for debugging only.
    const safeMessage = failEvent?.error?.message ?? '';
    expect(safeMessage).not.toContain('upstream connection refused');
    expect(safeMessage).toContain('unavailable');
    // Truncation is the final guardrail — the safe message must be
    // a short, neutral, category-derived phrase.
    expect(safeMessage.length).toBeLessThan(200);

    // The run row must be FAILED with the sanitized safe message
    const runRow = await pool.query<{
      status: string;
      error_code: string | null;
      error_safe_message: string | null;
    }>(`SELECT status, error_code, error_safe_message FROM model_runs WHERE id = $1`, [runId]);
    expect(runRow.rows[0]?.status).toBe('FAILED');
    expect(runRow.rows[0]?.error_code).toBe('MODEL_PROVIDER_UNAVAILABLE');
    // The DB column carries the sanitized text, not the raw provider text.
    expect(runRow.rows[0]?.error_safe_message).toBeDefined();
    expect(runRow.rows[0]?.error_safe_message).not.toContain('upstream connection refused');
    expect(runRow.rows[0]?.error_safe_message).toContain('unavailable');
  });
});
