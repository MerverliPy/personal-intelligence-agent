// ---------------------------------------------------------------------------
// Fake embedding provider tests — no database required
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { fakeEmbeddingProvider, defaultFakeModelConfig } from '../src/embeddings/fake-provider.js';

describe('FakeEmbeddingProvider', () => {
  const modelConfig = defaultFakeModelConfig();

  it('produces deterministic vectors — same text yields same vector', async () => {
    const response1 = await fakeEmbeddingProvider.embed({
      model: modelConfig,
      inputs: [{ index: 0, text: 'Hello world' }],
    });
    const response2 = await fakeEmbeddingProvider.embed({
      model: modelConfig,
      inputs: [{ index: 0, text: 'Hello world' }],
    });

    expect(response1.results).toHaveLength(1);
    expect(response2.results).toHaveLength(1);
    expect(response1.results[0]!.vector).toEqual(response2.results[0]!.vector);
  });

  it('produces different vectors for different texts', async () => {
    const response1 = await fakeEmbeddingProvider.embed({
      model: modelConfig,
      inputs: [{ index: 0, text: 'Hello world' }],
    });
    const response2 = await fakeEmbeddingProvider.embed({
      model: modelConfig,
      inputs: [{ index: 0, text: 'Goodbye world' }],
    });

    expect(response1.results[0]!.vector).not.toEqual(response2.results[0]!.vector);
  });

  it('produces vectors of the configured dimensionality', async () => {
    const response = await fakeEmbeddingProvider.embed({
      model: modelConfig,
      inputs: [{ index: 0, text: 'test' }],
    });

    expect(response.results[0]!.vector).toHaveLength(modelConfig.dimensions);
  });

  it('produces L2-normalized vectors (unit length)', async () => {
    const response = await fakeEmbeddingProvider.embed({
      model: modelConfig,
      inputs: [{ index: 0, text: 'test normalization' }],
    });

    const vector = response.results[0]!.vector;
    const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    // Should be very close to 1.0 (allowing for floating point)
    expect(magnitude).toBeCloseTo(1.0, 5);
  });

  it('handles batch of multiple inputs', async () => {
    const response = await fakeEmbeddingProvider.embed({
      model: modelConfig,
      inputs: [
        { index: 0, text: 'first' },
        { index: 1, text: 'second' },
        { index: 2, text: 'third' },
      ],
    });

    expect(response.results).toHaveLength(3);
    expect(response.results[0]!.index).toBe(0);
    expect(response.results[1]!.index).toBe(1);
    expect(response.results[2]!.index).toBe(2);

    // Each should be different
    expect(response.results[0]!.vector).not.toEqual(response.results[1]!.vector);
    expect(response.results[1]!.vector).not.toEqual(response.results[2]!.vector);
  });

  it('respects requested dimensions (non-default)', async () => {
    const customConfig = { ...modelConfig, dimensions: 384 };
    const response = await fakeEmbeddingProvider.embed({
      model: customConfig,
      inputs: [{ index: 0, text: 'custom dims' }],
    });

    expect(response.results[0]!.vector).toHaveLength(384);
  });

  it('returns model config in response', async () => {
    const response = await fakeEmbeddingProvider.embed({
      model: modelConfig,
      inputs: [{ index: 0, text: 'test' }],
    });

    expect(response.model.provider).toBe(modelConfig.provider);
    expect(response.model.model).toBe(modelConfig.model);
    expect(response.model.dimensions).toBe(modelConfig.dimensions);
  });
});
