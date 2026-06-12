// ---------------------------------------------------------------------------
// Fake model adapter — deterministic generation for development and testing
// ---------------------------------------------------------------------------
// Per P3-T01: A provider-neutral fake adapter that generates deterministic
// responses without calling an external service. Suitable for local
// development, CI, and deterministic tests.
//
// The fake adapter echoes the last user message as the assistant response,
// with deterministic usage and timing. Streaming yields one text_delta
// event per character, followed by `done`.
// ---------------------------------------------------------------------------

import type {
  ModelGateway,
  GenerationRequest,
  GenerationResult,
  GenerationEvent,
  ModelGatewayConfig,
  ModelGatewayError,
} from './types.js';
import type { SensitivityPolicy } from './policy.js';
import { Redacted } from '@pia/config';

/**
 * Creates a fake model gateway that generates deterministic echo responses.
 *
 * The fake adapter:
 * - Echoes the last user message as the assistant response.
 * - Returns deterministic usage proportional to message length.
 * - Streams one character at a time with zero delay (synchronous).
 * - Supports cancellation via AbortSignal.
 * - Supports sensitivity policy checks via an injected policy.
 *
 * ## Usage
 *
 * ```ts
 * import { createFakeModelGateway, fakeModelGatewayConfig } from '@pia/ai/gateway';
 *
 * const gateway = createFakeModelGateway();
 * const result = await gateway.generate({
 *   messages: [{ role: 'user', content: 'Hello' }],
 * });
 * // result.content === 'Hello'
 * ```
 */
export function createFakeModelGateway(policy?: SensitivityPolicy): ModelGateway {
  const sensitivityPolicy = policy;

  async function generate(
    request: GenerationRequest,
    signal?: AbortSignal,
  ): Promise<GenerationResult> {
    checkCancelled(signal);
    checkPolicy(sensitivityPolicy, request);

    const lastUserMessage =
      [...request.messages].reverse().find((m) => m.role === 'user')?.content ?? '';
    const response = lastUserMessage || '(empty)';

    await simulateLatency(signal);

    const promptTokens = request.messages.reduce((sum, m) => sum + approximateTokens(m.content), 0);
    const completionTokens = approximateTokens(response);

    return {
      content: response,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      },
      finishReason: 'stop',
      model: fakeModelGatewayConfig(),
    };
  }

  async function* stream(
    request: GenerationRequest,
    signal?: AbortSignal,
  ): AsyncIterable<GenerationEvent> {
    checkCancelled(signal);
    checkPolicy(sensitivityPolicy, request);

    const lastUserMessage =
      [...request.messages].reverse().find((m) => m.role === 'user')?.content ?? '';
    const response = lastUserMessage || '(empty)';

    for (let i = 0; i < response.length; i++) {
      if (signal?.aborted) {
        yield {
          type: 'error',
          error: {
            name: 'ModelGatewayError',
            message: 'Request cancelled',
            category: 'CANCELLED',
          } as ModelGatewayError,
        };
        return;
      }
      yield { type: 'text_delta', content: response[i]! };
    }

    const promptTokens = request.messages.reduce((sum, m) => sum + approximateTokens(m.content), 0);
    const completionTokens = approximateTokens(response);

    yield {
      type: 'done',
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      },
      finishReason: 'stop',
    };
  }

  return { generate, stream };
}

/**
 * A shared singleton fake model gateway instance.
 */
export const fakeModelGateway: ModelGateway = createFakeModelGateway();

/**
 * Returns a default model gateway config for the fake provider.
 */
export function fakeModelGatewayConfig(): ModelGatewayConfig {
  return {
    provider: 'fake',
    name: 'fake-v1',
    apiKey: new Redacted('fake-key'),
    maxTokens: 4096,
    temperature: 0.7,
    timeoutMs: 30000,
  };
}

/**
 * Approximates a token count from a string (roughly 4 chars per token).
 */
function approximateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

/**
 * Throws CANCELLED error if the signal is already aborted.
 */
function checkCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) {
    const err = new Error('Request cancelled') as ModelGatewayError;
    err.name = 'ModelGatewayError';
    (err as unknown as Record<string, unknown>)['category'] = 'CANCELLED';
    throw err;
  }
}

/**
 * Checks sensitivity policy before dispatch.
 */
function checkPolicy(policy: SensitivityPolicy | undefined, request: GenerationRequest): void {
  if (!policy || !request.safety) return;
  if (!policy.canRoute(request.safety.maximumSensitivity, 'fake')) {
    const err = new Error(
      `Policy denied routing for sensitivity ${request.safety.maximumSensitivity} to fake`,
    ) as ModelGatewayError;
    err.name = 'ModelGatewayError';
    (err as unknown as Record<string, unknown>)['category'] = 'POLICY_DENIED';
    throw err;
  }
}

/**
 * Simulates a non-zero duration to keep the interface async.
 */
function simulateLatency(signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    setImmediate(() => {
      if (signal?.aborted) {
        resolve();
        return;
      }
      resolve();
    });
  });
}
