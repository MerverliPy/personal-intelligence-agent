// ---------------------------------------------------------------------------
// OpenAI Chat Completions adapter — provider adapter for the model gateway
// ---------------------------------------------------------------------------
// Per P3-T01: Provider SDK types and API keys remain inside this adapter.
// The adapter maps our provider-neutral GenerationRequest/GenerationResult
// to OpenAI's Chat Completions API and converts provider-specific errors
// to stable ModelGatewayError categories.
//
// Uses Chat Completions (not deprecated Assistants API). The Responses API
// is a future optimization that can be swapped in under the same interface.
// ---------------------------------------------------------------------------

import OpenAI from 'openai';
import type {
  ModelGateway,
  ModelGatewayConfig,
  GenerationRequest,
  GenerationResult,
  GenerationEvent,
  Message,
} from './types.js';
import { ModelGatewayError } from './types.js';
import type { ErrorCategory } from './types.js';
import type { SensitivityPolicy } from './policy.js';

/**
 * Options for creating an OpenAI chat completions adapter.
 */
export interface OpenAIGatewayOptions {
  /** Configuration for this adapter instance. */
  readonly config: ModelGatewayConfig;
  /** Optional sensitivity policy for pre-dispatch checks. */
  readonly policy?: SensitivityPolicy;
}

/**
 * Creates a model gateway adapter backed by OpenAI Chat Completions API.
 *
 * The adapter isolates all OpenAI SDK types and API keys behind the
 * provider-neutral `ModelGateway` interface. Application code never
 * imports `openai` types directly.
 */
export function createOpenAIGateway(options: OpenAIGatewayOptions): ModelGateway {
  const { config, policy } = options;

  const client = new OpenAI({
    apiKey: config.apiKey.expose(),
    maxRetries: 0,
    timeout: config.timeoutMs,
  });

  function buildRequestParams(request: GenerationRequest, stream?: boolean) {
    const params: Record<string, unknown> = {
      model: config.name,
      messages: mapMessages(request.messages),
      max_tokens: request.budget?.maxTokens ?? config.maxTokens,
      temperature: config.temperature,
    };

    if (stream) {
      params['stream'] = true;
      params['stream_options'] = { include_usage: true };
    }

    if (request.outputSchema) {
      params['response_format'] = {
        type: 'json_schema' as const,
        json_schema: {
          name: request.outputSchema.name,
          schema: request.outputSchema.schema,
          strict: true,
        },
      };
    }

    return params;
  }

  async function generate(
    request: GenerationRequest,
    signal?: AbortSignal,
  ): Promise<GenerationResult> {
    checkPolicy(policy, request, config.provider);

    try {
      const params = buildRequestParams(request, false);

      const completion = await client.chat.completions.create(
        params as unknown as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
        {
          signal,
          timeout: request.budget?.timeoutMs ?? config.timeoutMs,
        },
      );

      const choice = completion.choices[0];
      if (!choice) {
        throw new ModelGatewayError(
          'OpenAI returned no completion choices',
          'PROVIDER_UNAVAILABLE',
        );
      }

      const finishReason = mapFinishReason(choice.finish_reason);

      return {
        content: choice.message.content ?? '',
        usage: {
          promptTokens: completion.usage?.prompt_tokens ?? 0,
          completionTokens: completion.usage?.completion_tokens ?? 0,
          totalTokens: completion.usage?.total_tokens ?? 0,
        },
        finishReason,
        model: { ...config },
      };
    } catch (error) {
      throw mapError(error, config.provider);
    }
  }

  async function* stream(
    request: GenerationRequest,
    signal?: AbortSignal,
  ): AsyncIterable<GenerationEvent> {
    checkPolicy(policy, request, config.provider);

    try {
      const params = buildRequestParams(request, true);

      const stream = await client.chat.completions.create(
        params as unknown as OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming,
        {
          signal,
          timeout: request.budget?.timeoutMs ?? config.timeoutMs,
        },
      );

      for await (const chunk of stream) {
        if (signal?.aborted) {
          yield {
            type: 'error',
            error: new ModelGatewayError('Request cancelled', 'CANCELLED'),
          };
          return;
        }

        const delta = chunk.choices[0]?.delta;
        if (delta?.content) {
          yield { type: 'text_delta', content: delta.content };
        }

        const toolCalls = delta?.tool_calls;
        if (toolCalls) {
          for (const tc of toolCalls) {
            if (tc.id) {
              yield {
                type: 'tool_call_start',
                id: tc.id,
                name: tc.function?.name ?? '',
              };
            }
            if (tc.function?.arguments) {
              yield {
                type: 'tool_call_delta',
                id: tc.id ?? '',
                arguments: tc.function.arguments,
              };
            }
          }
        }

        const finishReason = chunk.choices[0]?.finish_reason;
        if (finishReason && finishReason !== 'tool_calls') {
          yield {
            type: 'done',
            usage: chunk.usage
              ? {
                  promptTokens: chunk.usage.prompt_tokens,
                  completionTokens: chunk.usage.completion_tokens,
                  totalTokens: chunk.usage.total_tokens,
                }
              : { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
            finishReason: mapFinishReason(finishReason),
          };
          return;
        }
      }
    } catch (error) {
      yield {
        type: 'error',
        error: mapError(error, config.provider),
      };
    }
  }

  return { generate, stream };
}

function mapMessages(
  messages: readonly Message[],
): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  return messages.map((m) => {
    switch (m.role) {
      case 'system':
        return { role: 'system', content: m.content };
      case 'user':
        return { role: 'user', content: m.content };
      case 'assistant':
        return { role: 'assistant', content: m.content };
      case 'tool':
        return {
          role: 'tool',
          content: m.content,
          tool_call_id: m.name ?? '',
        };
    }
  });
}

function mapFinishReason(reason: string | null | undefined): GenerationResult['finishReason'] {
  switch (reason) {
    case 'stop':
      return 'stop';
    case 'length':
      return 'length';
    case 'content_filter':
      return 'content_filter';
    case 'tool_calls':
    case 'function_call':
      return 'tool_calls';
    default:
      return 'error';
  }
}

function mapError(error: unknown, provider: string): never {
  if (error instanceof ModelGatewayError) throw error;

  if (error instanceof Error && isOpenAIError(error)) {
    const category = mapOpenAIErrorToCategory(error);
    throw new ModelGatewayError(`[${provider}] ${error.message}`, category, error);
  }

  if (error instanceof Error) {
    const name = error.name;
    const message = error.message;
    if (name === 'AbortError' || message.includes('abort')) {
      throw new ModelGatewayError('Request cancelled', 'CANCELLED', error);
    }
    if (message.includes('timeout') || message.includes('Timeout')) {
      throw new ModelGatewayError('Request timed out', 'TIMEOUT', error);
    }
    throw new ModelGatewayError(`[${provider}] ${message}`, 'UNKNOWN', error);
  }

  throw new ModelGatewayError(`[${provider}] Unknown error`, 'UNKNOWN');
}

function isOpenAIError(error: Error): boolean {
  const status = (error as unknown as Record<string, unknown>)['status'];
  const type = (error as unknown as Record<string, unknown>)['type'];
  return (
    error instanceof OpenAI.APIError ||
    error instanceof OpenAI.AuthenticationError ||
    error instanceof OpenAI.RateLimitError ||
    error instanceof OpenAI.APIConnectionError ||
    error instanceof OpenAI.APIConnectionTimeoutError ||
    error instanceof OpenAI.BadRequestError ||
    error instanceof OpenAI.PermissionDeniedError ||
    (typeof status === 'number' && typeof type === 'string' && type.startsWith('openai'))
  );
}

function mapOpenAIErrorToCategory(error: Error): ErrorCategory {
  if (error instanceof OpenAI.AuthenticationError) return 'AUTHENTICATION';
  if (error instanceof OpenAI.RateLimitError) return 'RATE_LIMITED';
  if (error instanceof OpenAI.APIConnectionError) return 'PROVIDER_UNAVAILABLE';
  if (error instanceof OpenAI.APIConnectionTimeoutError) return 'TIMEOUT';
  if (error instanceof OpenAI.BadRequestError) return 'INVALID_REQUEST';
  if (error instanceof OpenAI.PermissionDeniedError) return 'AUTHENTICATION';

  const status = (error as unknown as Record<string, unknown>)['status'];
  if (typeof status === 'number') {
    if (status === 429) return 'RATE_LIMITED';
    if (status === 400) return 'INVALID_REQUEST';
    if (status >= 500) return 'PROVIDER_UNAVAILABLE';
  }
  return 'UNKNOWN';
}

function checkPolicy(
  policy: SensitivityPolicy | undefined,
  request: GenerationRequest,
  provider: string,
): void {
  if (!policy || !request.safety) return;
  if (!policy.canRoute(request.safety.maximumSensitivity, provider)) {
    throw new ModelGatewayError(
      `Policy denied routing for sensitivity ${request.safety.maximumSensitivity} to ${provider}`,
      'POLICY_DENIED',
    );
  }
}
