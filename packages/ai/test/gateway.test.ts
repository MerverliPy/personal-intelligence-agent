// ---------------------------------------------------------------------------
// Model gateway tests — fake adapter, types, policy, and error mapping
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import {
  ModelGatewayError,
  createFakeModelGateway,
  fakeModelGateway,
  fakeModelGatewayConfig,
  createPermissiveSensitivityPolicy,
} from '../src/gateway/index.js';
import type {
  ModelGateway,
  GenerationRequest,
  GenerationEvent,
  ModelGatewayConfig,
} from '../src/gateway/index.js';

const defaultRequest: GenerationRequest = {
  messages: [{ role: 'user', content: 'Hello, how are you?' }],
};

describe('fakeModelGateway', () => {
  const gateway = fakeModelGateway;

  describe('generate', () => {
    it('echoes the last user message', async () => {
      const result = await gateway.generate(defaultRequest);
      expect(result.content).toBe('Hello, how are you?');
    });

    it('returns stop finish reason', async () => {
      const result = await gateway.generate(defaultRequest);
      expect(result.finishReason).toBe('stop');
    });

    it('returns usage proportional to message length', async () => {
      const result = await gateway.generate(defaultRequest);
      expect(result.usage.completionTokens).toBeGreaterThan(0);
      expect(result.usage.totalTokens).toBe(
        result.usage.promptTokens + result.usage.completionTokens,
      );
    });

    it('returns the model config in the result', async () => {
      const result = await gateway.generate(defaultRequest);
      expect(result.model.provider).toBe('fake');
      expect(result.model.name).toBe('fake-v1');
    });

    it('returns (empty) when no user message is present', async () => {
      const result = await gateway.generate({
        messages: [{ role: 'system', content: 'You are helpful.' }],
      });
      expect(result.content).toBe('(empty)');
    });

    it('supports cancellation via AbortSignal', async () => {
      const controller = new AbortController();
      controller.abort();
      await expect(gateway.generate(defaultRequest, controller.signal)).rejects.toMatchObject({
        name: 'ModelGatewayError',
      });
    });

    it('returns different usage for different message lengths', async () => {
      const short = await gateway.generate({
        messages: [{ role: 'user', content: 'Hi' }],
      });
      const long = await gateway.generate({
        messages: [{ role: 'user', content: 'This is a much longer message with many words' }],
      });
      expect(long.usage.totalTokens).toBeGreaterThan(short.usage.totalTokens);
    });
  });

  describe('stream', () => {
    async function collectStream(
      gateway: ModelGateway,
      request: GenerationRequest,
    ): Promise<{
      text: string;
      events: GenerationEvent[];
      usage: { promptTokens: number; completionTokens: number; totalTokens: number } | null;
      finishReason: string | null;
    }> {
      let text = '';
      const events: GenerationEvent[] = [];
      let usage = null;
      let finishReason: string | null = null;

      for await (const event of gateway.stream(request)) {
        events.push(event);
        if (event.type === 'text_delta') {
          text += event.content;
        }
        if (event.type === 'done') {
          usage = event.usage;
          finishReason = event.finishReason;
        }
      }

      return { text, events, usage, finishReason };
    }

    it('streams the echoed message one character at a time', async () => {
      const { text, events } = await collectStream(gateway, defaultRequest);
      expect(text).toBe('Hello, how are you?');
      // One text_delta per character + one done event
      const textEvents = events.filter((e) => e.type === 'text_delta');
      expect(textEvents).toHaveLength('Hello, how are you?'.length);
    });

    it('ends with a done event containing usage', async () => {
      const { usage, finishReason } = await collectStream(gateway, defaultRequest);
      expect(usage).not.toBeNull();
      expect(usage!.totalTokens).toBeGreaterThan(0);
      expect(finishReason).toBe('stop');
    });

    it('streams (empty) for no user message', async () => {
      const { text } = await collectStream(gateway, {
        messages: [{ role: 'system', content: 'System prompt' }],
      });
      expect(text).toBe('(empty)');
    });

    it('throws when cancelled before stream starts', async () => {
      const controller = new AbortController();
      controller.abort();
      const iterator = gateway.stream(defaultRequest, controller.signal)[Symbol.asyncIterator]();
      await expect(iterator.next()).rejects.toMatchObject({
        name: 'ModelGatewayError',
      });
    });
  });

  describe('config', () => {
    it('returns default config with fake provider', () => {
      const config = fakeModelGatewayConfig();
      expect(config.provider).toBe('fake');
      expect(config.name).toBe('fake-v1');
      expect(config.maxTokens).toBe(4096);
      expect(config.temperature).toBe(0.7);
      expect(config.timeoutMs).toBe(30000);
    });
  });

  describe('custom instance', () => {
    it('createFakeModelGateway returns a working instance', async () => {
      const g = createFakeModelGateway();
      const result = await g.generate(defaultRequest);
      expect(result.content).toBe('Hello, how are you?');
    });
  });
});

describe('ModelGatewayError', () => {
  it('creates an error with a category', () => {
    const error = new ModelGatewayError('test message', 'AUTHENTICATION');
    expect(error.name).toBe('ModelGatewayError');
    expect(error.message).toBe('test message');
    expect(error.category).toBe('AUTHENTICATION');
  });

  it('accepts an optional cause', () => {
    const cause = new Error('original');
    const error = new ModelGatewayError('test', 'UNKNOWN', cause);
    expect(error.cause).toBe(cause);
  });

  it('is an instance of Error', () => {
    const error = new ModelGatewayError('test', 'UNKNOWN');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ModelGatewayError);
  });

  it('all error categories are valid', () => {
    const categories = [
      'AUTHENTICATION',
      'RATE_LIMITED',
      'TIMEOUT',
      'PROVIDER_UNAVAILABLE',
      'INVALID_REQUEST',
      'CONTENT_FILTERED',
      'CANCELLED',
      'POLICY_DENIED',
      'UNKNOWN',
    ] as const;
    for (const cat of categories) {
      const error = new ModelGatewayError('test', cat);
      expect(error.category).toBe(cat);
    }
  });
});

describe('SensitivityPolicy', () => {
  describe('createPermissiveSensitivityPolicy', () => {
    const policy = createPermissiveSensitivityPolicy();

    it('allows PUBLIC to any provider', () => {
      expect(policy.canRoute('PUBLIC', 'openai')).toBe(true);
      expect(policy.canRoute('PUBLIC', 'fake')).toBe(true);
    });

    it('allows INTERNAL to any provider', () => {
      expect(policy.canRoute('INTERNAL', 'openai')).toBe(true);
    });

    it('allows CONFIDENTIAL to any provider', () => {
      expect(policy.canRoute('CONFIDENTIAL', 'openai')).toBe(true);
    });

    it('allows HIGHLY_CONFIDENTIAL to any provider', () => {
      expect(policy.canRoute('HIGHLY_CONFIDENTIAL', 'openai')).toBe(true);
    });

    it('allows REGULATED to any provider', () => {
      expect(policy.canRoute('REGULATED', 'openai')).toBe(true);
    });

    it('denies PROHIBITED regardless of provider', () => {
      expect(policy.canRoute('PROHIBITED', 'openai')).toBe(false);
      expect(policy.canRoute('PROHIBITED', 'fake')).toBe(false);
      expect(policy.canRoute('PROHIBITED', 'anthropic')).toBe(false);
    });
  });

  describe('policy integration with gateway', () => {
    const policy = createPermissiveSensitivityPolicy();

    it('gateway without policy allows all requests', async () => {
      const gateway = createFakeModelGateway();
      const result = await gateway.generate({
        messages: [{ role: 'user', content: 'test' }],
        safety: { maximumSensitivity: 'CONFIDENTIAL' },
      });
      expect(result.content).toBe('test');
    });

    it('gateway with policy allows PUBLIC requests', async () => {
      const gateway = createFakeModelGateway(policy);
      const result = await gateway.generate({
        messages: [{ role: 'user', content: 'test' }],
        safety: { maximumSensitivity: 'PUBLIC' },
      });
      expect(result.content).toBe('test');
    });

    it('gateway with policy denies PROHIBITED requests', async () => {
      const gateway = createFakeModelGateway(policy);
      await expect(
        gateway.generate({
          messages: [{ role: 'user', content: 'test' }],
          safety: { maximumSensitivity: 'PROHIBITED' },
        }),
      ).rejects.toMatchObject({
        name: 'ModelGatewayError',
      });
    });
  });
});
