// ---------------------------------------------------------------------------
// Model gateway types — provider-neutral generation contracts
// ---------------------------------------------------------------------------
// Per P3-T01: Provider SDK types remain inside the adapter. Generation request,
// result, event, and error types form the stable boundary between application
// code and model providers. Secrets and provider-specific objects never cross
// this boundary.
// ---------------------------------------------------------------------------

import type { Redacted } from '@pia/config';

/**
 * Sensitivity classification for data routed through the model gateway.
 *
 * Per `docs/03_DATA_MODEL.md#9`: Sources, documents, conversations, memories,
 * and tool connections carry a sensitivity class that governs provider
 * eligibility, logging, retention, and export.
 */
export type SensitivityClass =
  | 'PUBLIC'
  | 'INTERNAL'
  | 'CONFIDENTIAL'
  | 'HIGHLY_CONFIDENTIAL'
  | 'REGULATED'
  | 'PROHIBITED';

/**
 * Configuration for a model provider used by the gateway.
 *
 * Mirrors the `embedding.EmbeddingModelConfig` pattern from
 * `packages/knowledge/src/embeddings/types.ts`. Persisted alongside model-run
 * records so different models/configs are never silently mixed.
 */
export interface ModelGatewayConfig {
  /** Provider identifier (e.g. "fake", "openai"). */
  readonly provider: string;
  /** Model name (e.g. "gpt-4o"). */
  readonly name: string;
  /** API key for the provider (redacted in logs). */
  readonly apiKey: Redacted;
  /** Default maximum tokens per generation request. */
  readonly maxTokens: number;
  /** Default sampling temperature. */
  readonly temperature: number;
  /** Request timeout in milliseconds. */
  readonly timeoutMs: number;
}

/**
 * A single message in a generation request.
 */
export interface Message {
  /** Role of the message author. */
  readonly role: 'system' | 'user' | 'assistant' | 'tool';
  /** Text content of the message. */
  readonly content: string;
  /** Optional name/tool-call-id for tool messages. */
  readonly name?: string;
}

/**
 * Structured output schema for typed generation.
 *
 * When provided, the model must produce output conforming to this JSON Schema.
 */
export interface OutputSchema {
  /** JSON Schema identifier. */
  readonly name: string;
  /** JSON Schema definition (subset of draft-07). */
  readonly schema: Record<string, unknown>;
}

/**
 * Safety configuration for a generation request.
 */
export interface SafetyConfig {
  /**
   * Maximum sensitivity class the requesting context is authorized for.
   * The gateway's policy must check this against the provider's permitted
   * classes before dispatching.
   */
  readonly maximumSensitivity: SensitivityClass;
}

/**
 * Budget constraints for a generation request.
 */
export interface BudgetConfig {
  /** Maximum tokens for the completion. Overrides the model default. */
  readonly maxTokens?: number;
  /** Maximum time for this request in milliseconds. Overrides the model default. */
  readonly timeoutMs?: number;
}

/**
 * Provider-neutral generation request.
 *
 * Contains the full context the model gateway needs to dispatch a request
 * without exposing provider-specific types or credentials.
 */
export interface GenerationRequest {
  /** Messages forming the conversation / prompt. */
  readonly messages: readonly Message[];
  /** Structured output schema (optional — for typed generation). */
  readonly outputSchema?: OutputSchema;
  /** Safety and sensitivity configuration. */
  readonly safety?: SafetyConfig;
  /** Per-request budget overrides. */
  readonly budget?: BudgetConfig;
}

/**
 * Token usage statistics from a generation.
 */
export interface Usage {
  /** Prompt tokens consumed. */
  readonly promptTokens: number;
  /** Completion tokens produced. */
  readonly completionTokens: number;
  /** Total tokens consumed. */
  readonly totalTokens: number;
}

/**
 * Finish reason for a generation.
 */
export type FinishReason = 'stop' | 'length' | 'content_filter' | 'tool_calls' | 'error';

/**
 * Provider-neutral generation result.
 */
export interface GenerationResult {
  /** The completed text content (if not streaming). */
  readonly content: string;
  /** Token usage statistics. */
  readonly usage: Usage;
  /** Reason the generation stopped. */
  readonly finishReason: FinishReason;
  /** Provider/model/config used (for provenance). */
  readonly model: ModelGatewayConfig;
}

/**
 * Streaming event types produced by the model gateway.
 */
export type GenerationEvent =
  | { readonly type: 'text_delta'; readonly content: string }
  | { readonly type: 'tool_call_start'; readonly id: string; readonly name: string }
  | { readonly type: 'tool_call_delta'; readonly id: string; readonly arguments: string }
  | { readonly type: 'tool_call_end'; readonly id: string }
  | { readonly type: 'error'; readonly error: ModelGatewayError }
  | { readonly type: 'done'; readonly usage: Usage; readonly finishReason: FinishReason };

/**
 * Stable error categories for model gateway failures.
 *
 * Each adapter maps provider-specific errors to these categories so
 * application code can handle failures without provider awareness.
 */
export type ErrorCategory =
  | 'AUTHENTICATION'
  | 'RATE_LIMITED'
  | 'TIMEOUT'
  | 'PROVIDER_UNAVAILABLE'
  | 'INVALID_REQUEST'
  | 'CONTENT_FILTERED'
  | 'CANCELLED'
  | 'POLICY_DENIED'
  | 'UNKNOWN';

/**
 * Error thrown by the model gateway.
 *
 * Carries a stable category for metrics and application handling.
 * Provider-specific error details are available via `cause`.
 */
export class ModelGatewayError extends Error {
  constructor(
    message: string,
    public readonly category: ErrorCategory,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = 'ModelGatewayError';
  }
}

/**
 * Provider-neutral model gateway interface.
 *
 * Implementations MUST NOT expose SDK types or credentials across the
 * boundary. All provider-specific logic (API keys, SDK imports, network
 * calls) is contained within the adapter implementation.
 */
export interface ModelGateway {
  /**
   * Generate a completion from the model provider.
   *
   * @param request - The generation request with messages and config.
   * @param signal - Optional AbortSignal for cancellation.
   * @returns The completed generation result.
   * @throws {ModelGatewayError} on any failure, with a stable error category.
   */
  generate(request: GenerationRequest, signal?: AbortSignal): Promise<GenerationResult>;

  /**
   * Stream generation events from the model provider.
   *
   * @param request - The generation request with messages and config.
   * @param signal - Optional AbortSignal for cancellation.
   * @returns An async iterable of generation events.
   */
  stream(request: GenerationRequest, signal?: AbortSignal): AsyncIterable<GenerationEvent>;
}
