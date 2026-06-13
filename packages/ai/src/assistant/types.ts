// ---------------------------------------------------------------------------
// Assistant orchestrator types — SSE events and configuration (P3-T05)
// ---------------------------------------------------------------------------
// Per docs/04_API_ARCHITECTURE.md#6-sse-event-contract:
//   Every event includes a monotonically increasing sequence and run ID.
//   Reconnection SHOULD support Last-Event-ID.
// ---------------------------------------------------------------------------

import type { ModelGateway } from '../gateway/index.js';
import type { Pool } from 'pg';
import type { RetrievalService } from '@pia/knowledge';
import type {
  SseRunStartedEvent,
  SseResponseDeltaEvent,
  SseCitationProvisionalEvent,
  SseApprovalRequiredEvent,
  SseResponseCompletedEvent,
  SseRunFailedEvent,
} from '@pia/contracts';

// Re-export SSE event types for convenience
export type {
  SseRunStartedEvent,
  SseResponseDeltaEvent,
  SseCitationProvisionalEvent,
  SseApprovalRequiredEvent,
  SseResponseCompletedEvent,
  SseRunFailedEvent,
};

/** Union of all SSE events the orchestrator can produce. */
export type OrchestratorSseEvent =
  | SseRunStartedEvent
  | SseResponseDeltaEvent
  | SseCitationProvisionalEvent
  | SseApprovalRequiredEvent
  | SseResponseCompletedEvent
  | SseRunFailedEvent;

/**
 * Options passed to the orchestrator for a single message/run.
 */
export interface OrchestratorRunOptions {
  /** The workspace ID for scoping all queries and persistence. */
  readonly workspaceId: string;
  /** The conversation ID the user is messaging. */
  readonly conversationId: string;
  /** The authenticated user's ID (for retrieval scoping). */
  readonly userId: string;
  /** The ID of the model run created by initiate() — stream() resumes this run. */
  readonly runId: string;
  /** The user's message content. */
  readonly userContent: string;
  /** The conversation mode (default: ASK). */
  readonly mode?: string;
  /** Whether retrieval should be performed (default: true). */
  readonly retrievalEnabled?: boolean;
  /** Optional list of source IDs to restrict retrieval. */
  readonly retrievalSourceIds?: readonly string[];
  /** AbortSignal for cancellation. */
  readonly signal?: AbortSignal;
}

/**
 * Configuration for creating an AssistantOrchestrator.
 */
export interface AssistantOrchestratorConfig {
  /** Model gateway for generation (fake or real). */
  readonly gateway: ModelGateway;
  /** Retrieval service for evidence lookup. */
  readonly retrievalService: RetrievalService;
  /** Database pool for persistence. */
  readonly pool: Pool;
  /** Prompt name used for generation. */
  readonly promptName?: string;
  /** Prompt version used for generation. */
  readonly promptVersion?: string;
  /** Model provider identifier. */
  readonly provider?: string;
  /** Model name. */
  readonly model?: string;
}
