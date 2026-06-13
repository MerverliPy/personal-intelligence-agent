// ---------------------------------------------------------------------------
// Assistant orchestrator — retrieval + context + generation + persistence (P3-T05)
// ---------------------------------------------------------------------------
// Per docs/04_API_ARCHITECTURE.md#6-sse-event-contract and FR-CONV-007:
//   The orchestrator runs retrieval, context compilation, model streaming,
//   cancellation, persistence, and safe terminal-state handling.
//
// Two-phase API:
//   1. initiate()  — persists user message, creates run (CREATED), returns IDs.
//   2. stream()    — transitions to STREAMING, runs full pipeline, yields SSE events.
// ---------------------------------------------------------------------------

import type { Pool } from 'pg';
import type { RetrievalService, RetrievalResult } from '@pia/knowledge';
import {
  createMessage,
  getConversationMessages,
  getMessage,
  createModelRun,
  startStreaming,
  completeModelRun,
  getModelRun,
  createCitation,
  updateCitationVerification,
} from '@pia/db';
import { compileContext, DEFAULT_COMPACTION_POLICY } from '../context/index.js';
import type { ModelGateway } from '../gateway/index.js';
import type { EvidenceItem, CompilerInput } from '../context/index.js';
import { renderPrompt } from '../prompts/renderer.js';
import { TEMPLATE as ANSWER_PROMPT_TEMPLATE } from '../prompts/prompts/conversation.answer.js';
import { mapDbRoleToGateway } from './role-mapping.js';
import {
  buildCitations,
  buildEvidenceMap,
  StreamingCitationParser,
  verifyCitations,
} from '@pia/knowledge';
import type { VerifiableCitation, VerifierInput } from '@pia/knowledge';
import type { Citation } from '@pia/contracts';
import type {
  OrchestratorSseEvent,
  OrchestratorRunOptions,
  AssistantOrchestratorConfig,
} from './types.js';

/**
 * Default prompt name and version used when not overridden in config.
 */
const DEFAULT_PROMPT_NAME = 'conversation.answer';
const DEFAULT_PROMPT_VERSION = '2.0.0';
const DEFAULT_PROVIDER = 'fake';
const DEFAULT_MODEL = 'fake-v1';

/**
 * Result of the initiate() phase.
 */
export interface InitiateResult {
  /** The persisted user message ID. */
  userMessageId: string;
  /** The created model run ID (in CREATED state). */
  runId: string;
  /** Timestamp of creation. */
  createdAt: string;
}

/**
 * Orchestrates a single user message through retrieval, context compilation,
 * model streaming, and persistence.
 *
 * ## Two-phase lifecycle
 *
 * ### Phase 1: initiate()
 * Persists the user message and creates a model run in CREATED state.
 * The caller receives identifiers to return in a 202 response.
 *
 * ### Phase 2: stream()
 * Transitions the run to STREAMING, performs retrieval + context compilation,
 * streams from the model gateway, persists the assistant message and
 * terminal run state. Yields SSE events throughout.
 */
export class AssistantOrchestrator {
  private readonly gateway: ModelGateway;
  private readonly retrievalService: RetrievalService;
  private readonly pool: Pool;
  readonly promptName: string;
  readonly promptVersion: string;
  readonly provider: string;
  readonly model: string;

  constructor(config: AssistantOrchestratorConfig) {
    this.gateway = config.gateway;
    this.retrievalService = config.retrievalService;
    this.pool = config.pool;
    this.promptName = config.promptName ?? DEFAULT_PROMPT_NAME;
    this.promptVersion = config.promptVersion ?? DEFAULT_PROMPT_VERSION;
    this.provider = config.provider ?? DEFAULT_PROVIDER;
    this.model = config.model ?? DEFAULT_MODEL;
  }

  /**
   * Phase 1: Persist the user message and create a model run in CREATED state.
   *
   * The caller receives identifiers suitable for a 202 response.
   * No streaming or model calls occur during this phase.
   */
  async initiate(options: {
    workspaceId: string;
    conversationId: string;
    userId: string;
    userContent: string;
  }): Promise<InitiateResult> {
    const { workspaceId, conversationId, userId, userContent } = options;

    // Persist user message
    const userMessage = await createMessage(this.pool, workspaceId, {
      conversationId,
      role: 'USER',
      content: userContent,
      createdBy: userId,
    });

    // Create model run in CREATED state
    const modelRun = await createModelRun(this.pool, workspaceId, {
      conversationId,
      userMessageId: userMessage.id,
      provider: this.provider,
      model: this.model,
      promptName: this.promptName,
      promptVersion: this.promptVersion,
    });

    return {
      userMessageId: userMessage.id,
      runId: modelRun.id,
      createdAt: modelRun.createdAt,
    };
  }

  /**
   * Phase 2: Stream the full orchestration pipeline, yielding SSE events.
   *
   * This method transitions the run to STREAMING, performs retrieval,
   * compiles context, streams from the model gateway, and persists the
   * terminal run state. The caller receives a generator of SSE events.
   *
   * @throws if the run fails and cannot be persisted safely.
   */
  async *stream(
    options: OrchestratorRunOptions,
  ): AsyncGenerator<OrchestratorSseEvent, void, undefined> {
    const {
      workspaceId,
      conversationId,
      userId,
      runId,
      userContent,
      mode = 'ASK',
      retrievalEnabled = true,
      signal,
    } = options;

    // --- Look up the existing run created by initiate() ---
    const existingRun = await getModelRun(this.pool, workspaceId, runId);
    if (!existingRun) {
      yield {
        type: 'run.failed',
        sequence: 0,
        error: {
          code: 'NOT_FOUND',
          message: 'Model run not found.',
          request_id: runId,
        },
      };
      return;
    }

    if (existingRun.conversationId !== conversationId) {
      yield {
        type: 'run.failed',
        sequence: 0,
        error: {
          code: 'FORBIDDEN',
          message: 'Run does not belong to this conversation.',
          request_id: runId,
        },
      };
      return;
    }

    // If the run already reached terminal state, don't restart
    if (existingRun.status !== 'CREATED') {
      yield {
        type: 'run.failed',
        sequence: 0,
        error: {
          code: 'CONFLICT',
          message: `Run is already in ${existingRun.status} state.`,
          request_id: runId,
        },
      };
      return;
    }

    // Look up the user message that triggered this run
    const userMessage = await getMessage(this.pool, workspaceId, existingRun.userMessageId);
    if (!userMessage) {
      yield {
        type: 'run.failed',
        sequence: 0,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'User message not found for this run.',
          request_id: runId,
        },
      };
      return;
    }

    // Use the actual persisted user content if none was provided (re-connection case)
    const effectiveUserContent = userContent || userMessage.content;

    // --- Transition the existing run to STREAMING ---
    await startStreaming(this.pool, workspaceId, runId);
    let sequence = 0;

    yield {
      type: 'run.started',
      run_id: runId,
      message_id: userMessage.id,
      sequence: sequence++,
    };

    const startTime = Date.now();

    try {
      // --- Retrieval ---
      let evidence: EvidenceItem[] = [];
      if (retrievalEnabled) {
        evidence = await this.performRetrieval(
          workspaceId,
          effectiveUserContent,
          userId,
          options.retrievalSourceIds,
        );
      }

      // --- Insufficient evidence check ---
      if (retrievalEnabled && evidence.length === 0) {
        const insufficientMessage = await createMessage(this.pool, workspaceId, {
          conversationId,
          role: 'ASSISTANT',
          content:
            "I don't have sufficient information to answer that question based on the available documents.",
          createdBy: null,
        });

        await completeModelRun(this.pool, workspaceId, runId, {
          status: 'COMPLETED',
          assistantMessageId: insufficientMessage.id,
          inputTokens: 0,
          outputTokens: 0,
          latencyMs: Date.now() - startTime,
        });

        yield {
          type: 'response.completed',
          sequence: sequence++,
          message_id: insufficientMessage.id,
          usage: {
            prompt_tokens: 0,
            completion_tokens: 0,
            total_tokens: 0,
          },
          citations: [],
          insufficient_evidence: true,
        };
        return;
      }

      // --- Context compilation ---
      const existingMessages = await getConversationMessages(
        this.pool,
        workspaceId,
        conversationId,
      );
      // Exclude the triggering user message from conversation history
      const historyMessages = existingMessages
        .filter((m) => m.id !== userMessage.id)
        .map((m) => ({
          role: mapDbRoleToGateway(m.role),
          content: m.content,
        }));

      const renderedPrompt = renderPrompt(
        ANSWER_PROMPT_TEMPLATE,
        { context: { currentDate: new Date().toISOString().slice(0, 10) } },
        { name: this.promptName, version: this.promptVersion },
      );

      const compilerInput: CompilerInput = {
        mode,
        userRequest: effectiveUserContent,
        prompt: renderedPrompt,
        ...(evidence.length > 0 ? { evidence } : {}),
        ...(historyMessages.length > 0 ? { conversationHistory: historyMessages } : {}),
        tokenBudget: { maxTokens: 8000 },
        compactionPolicy: DEFAULT_COMPACTION_POLICY,
      };

      const compilerOutput = compileContext(compilerInput);

      // --- Stream from gateway ---
      let fullResponse = '';
      let gatewayUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

      // Build evidence map for citation builder + streaming parser
      const evidenceMap = buildEvidenceMap(evidence);
      const citationParser = new StreamingCitationParser(evidenceMap);

      for await (const event of this.gateway.stream(
        { messages: compilerOutput.messages },
        signal,
      )) {
        switch (event.type) {
          case 'text_delta':
            fullResponse += event.content;
            yield {
              type: 'response.delta',
              sequence: sequence++,
              text: event.content,
            };

            // Feed delta to streaming citation parser
            for (const prov of citationParser.feed(event.content)) {
              yield {
                type: 'citation.provisional',
                sequence: sequence++,
                citation_id: prov.chunkId,
                source: {
                  chunk_id: prov.chunkId,
                  document_version_id: prov.documentVersionId,
                  source_locator: prov.sourceLocator,
                },
              };
            }
            break;
          case 'error':
            throw new Error(event.error.message ?? 'Model gateway error');
          case 'done':
            gatewayUsage = {
              promptTokens: event.usage.promptTokens,
              completionTokens: event.usage.completionTokens,
              totalTokens: event.usage.totalTokens,
            };
            break;
          case 'tool_call_start':
          case 'tool_call_delta':
          case 'tool_call_end':
            // Tool calls not yet supported in P3; silently skip
            break;
        }

        // Check cancellation between events
        if (signal?.aborted) {
          await completeModelRun(this.pool, workspaceId, runId, {
            status: 'CANCELLED',
            inputTokens: gatewayUsage.promptTokens || null,
            outputTokens: gatewayUsage.completionTokens || null,
            latencyMs: Date.now() - startTime,
            errorCode: 'CANCELLED',
            errorSafeMessage: 'Run cancelled by user.',
          });
          return;
        }
      }

      // --- Flush streaming parser for any remaining buffered text ---
      citationParser.flush();

      // --- Build citations from the full response ---
      const citationResult = buildCitations(fullResponse, evidenceMap, {
        workspaceId,
        modelRunId: runId,
        assistantMessageId: '', // placeholder — persist message first
      });

      // --- Persist assistant message with cleaned text (markers stripped) ---
      const assistantMessage = await createMessage(this.pool, workspaceId, {
        conversationId,
        role: 'ASSISTANT',
        content: citationResult.cleanedText,
        createdBy: null,
      });

      // --- Persist citations ---
      const persistedCitations: Citation[] = [];
      const verifiableCitations: VerifiableCitation[] = [];
      for (const citeInput of citationResult.citations) {
        const row = await createCitation(this.pool, {
          workspaceId: citeInput.workspaceId,
          modelRunId: citeInput.modelRunId,
          assistantMessageId: assistantMessage.id,
          chunkId: citeInput.chunkId,
          documentVersionId: citeInput.documentVersionId,
          sourceLocator: citeInput.sourceLocator,
          claimStart: citeInput.claimStart,
          claimEnd: citeInput.claimEnd,
          claimText: citeInput.claimText,
        });
        persistedCitations.push({
          id: row.id,
          chunk_id: row.chunkId,
          document_version_id: row.documentVersionId,
          source_locator: row.sourceLocator,
          claim_start: row.claimStart,
          claim_end: row.claimEnd,
          claim_text: citeInput.claimText,
          verification_status: row.verificationStatus,
        });
        verifiableCitations.push({
          id: row.id,
          chunkId: row.chunkId,
          documentVersionId: row.documentVersionId,
          sourceLocator: row.sourceLocator,
        });
      }

      // --- Verify citations (P3-T07) ---
      if (verifiableCitations.length > 0) {
        const verifierInput: VerifierInput = {
          workspaceId,
          modelRunId: runId,
          citations: verifiableCitations,
          evidenceMap,
        };

        const verificationResult = await verifyCitations(this.pool, verifierInput);

        // Update each citation's verification_status
        for (const vr of verificationResult.results) {
          const updated = await updateCitationVerification(
            this.pool,
            workspaceId,
            vr.citationId,
            vr.status,
          );
          // Sync verification_status back into the SSE-ready citation array
          const pc = persistedCitations.find((c) => c.id === vr.citationId);
          if (pc) {
            pc.verification_status = updated.verificationStatus;
          }
        }

        // If any critical check failed, abort normal completion (FR-CIT-002, FR-CIT-003)
        if (!verificationResult.allValid) {
          const invalidReasons = verificationResult.results
            .filter((r) => r.status !== 'VALID')
            .map((r) => `${r.citationId}: ${r.reason ?? r.status}`)
            .join('; ');

          await completeModelRun(this.pool, workspaceId, runId, {
            status: 'FAILED',
            assistantMessageId: assistantMessage.id,
            inputTokens: gatewayUsage.promptTokens,
            outputTokens: gatewayUsage.completionTokens,
            latencyMs: Date.now() - startTime,
            errorCode: 'VERIFICATION_FAILED',
            errorSafeMessage: truncateSafe(`Citation verification failed: ${invalidReasons}`),
          });

          yield {
            type: 'run.failed',
            sequence: sequence++,
            error: {
              code: 'VERIFICATION_FAILED',
              message:
                'Citation verification failed. The answer contains citations that could not be validated.',
              request_id: runId,
            },
          };
          return;
        }
      }

      // --- Complete the run ---
      await completeModelRun(this.pool, workspaceId, runId, {
        status: 'COMPLETED',
        assistantMessageId: assistantMessage.id,
        inputTokens: gatewayUsage.promptTokens,
        outputTokens: gatewayUsage.completionTokens,
        latencyMs: Date.now() - startTime,
      });

      yield {
        type: 'response.completed',
        sequence: sequence++,
        message_id: assistantMessage.id,
        usage: {
          prompt_tokens: gatewayUsage.promptTokens,
          completion_tokens: gatewayUsage.completionTokens,
          total_tokens: gatewayUsage.totalTokens,
        },
        citations: persistedCitations,
      };
    } catch (err) {
      // --- Safe error handling ---
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred.';
      const safeMessage = truncateSafe(errorMessage);

      try {
        await completeModelRun(this.pool, workspaceId, runId, {
          status: 'FAILED',
          inputTokens: null,
          outputTokens: null,
          latencyMs: Date.now() - startTime,
          errorCode: 'MODEL_PROVIDER_UNAVAILABLE',
          errorSafeMessage: safeMessage,
        });
      } catch (persistErr) {
        // Log but don't expose persistence failures to the client
        console.error('Failed to persist run failure:', persistErr);
      }

      yield {
        type: 'run.failed',
        sequence: sequence++,
        error: {
          code: 'MODEL_PROVIDER_UNAVAILABLE',
          message: safeMessage,
          request_id: runId,
        },
      };
    }
  }

  /**
   * Runs retrieval and maps results to compiler-compatible evidence items.
   */
  private async performRetrieval(
    workspaceId: string,
    queryText: string,
    userId: string,
    sourceIds?: readonly string[],
  ): Promise<EvidenceItem[]> {
    try {
      const response = await this.retrievalService.retrieve(
        {
          queryText,
          workspaceId,
          maxResults: 10,
          ...(sourceIds?.[0] ? { sourceId: sourceIds[0] } : {}),
          scoreThreshold: 0,
        },
        userId,
      );

      return response.results.map((r: RetrievalResult) => ({
        text: r.text,
        sourceId: r.sourceId,
        documentId: r.documentId,
        documentVersionId: r.documentVersionId,
        chunkId: r.chunkId,
        score: r.fusedScore,
        locator: r.locator,
        retrievalTraceId: r.retrievalTraceId,
      }));
    } catch {
      // Retrieval failure should not block the conversation
      return [];
    }
  }
}

/**
 * Truncates an error message to a safe length for client exposure.
 */
function truncateSafe(raw: string): string {
  const maxLen = 200;
  if (raw.length > maxLen) {
    return raw.slice(0, maxLen) + '...';
  }
  return raw;
}
