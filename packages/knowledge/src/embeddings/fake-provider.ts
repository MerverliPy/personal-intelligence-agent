// ---------------------------------------------------------------------------
// Fake embedding provider — deterministic vectors for development and testing
// ---------------------------------------------------------------------------
// Per P2-T06: A provider-neutral fake adapter that generates deterministic
// embeddings without calling an external service. Suitable for local
// development, CI, and deterministic tests.
//
// Vectors are derived from text content using SHA-256-based hashing, so
// identical inputs always produce identical vectors. This is NOT suitable
// for semantic search but perfectly adequate for proving pipeline
// idempotency, batching, and persistence.
// ---------------------------------------------------------------------------

import { createHash } from 'node:crypto';
import type {
  EmbeddingProvider,
  EmbeddingRequest,
  EmbeddingResponse,
  EmbeddingModelConfig,
} from './types.js';

/**
 * Creates a fake embedding provider that generates deterministic vectors
 * from text content.
 *
 * The provider uses SHA-256 hashing with per-dimension salts to produce
 * float values in the range [-1, 1]. Vectors are normalized to unit
 * length so cosine similarity is computable.
 *
 * ## Usage
 *
 * ```ts
 * const provider = createFakeEmbeddingProvider();
 * const response = await provider.embed({
 *   model: { provider: 'fake', model: 'fake-v1', dimensions: 1536, version: '1.0' },
 *   inputs: [{ index: 0, text: 'Hello world' }],
 * });
 * ```
 */
export function createFakeEmbeddingProvider(): EmbeddingProvider {
  return {
    async embed(request: EmbeddingRequest): Promise<EmbeddingResponse> {
      const { model, inputs } = request;
      const results = inputs.map((input) => ({
        index: input.index,
        vector: generateVector(input.text, model.dimensions),
      }));

      return {
        model: { ...model },
        results,
      };
    },
  };
}

/**
 * Generates a deterministic float vector of the given dimensionality.
 *
 * Uses SHA-256 hashing: for each dimension `d`, we hash the text
 * concatenated with `":d"` and derive a float in [-1, 1] from the
 * first 4 bytes of the digest. The resulting vector is L2-normalized.
 */
function generateVector(text: string, dimensions: number): number[] {
  const vector: number[] = [];

  // Pre-compute all dimension values
  for (let d = 0; d < dimensions; d++) {
    const hash = createHash('sha256').update(text).update(':').update(String(d)).digest();

    // Read first 4 bytes as a signed 32-bit big-endian integer,
    // then scale to [-1, 1].
    const raw = ((hash[0]! << 24) | (hash[1]! << 16) | (hash[2]! << 8) | hash[3]!) >>> 0; // unsigned

    // Map uint32 [0, 2^32-1] to float [-1, 1]
    const value = (raw / 0xffffffff) * 2 - 1;
    vector.push(value);
  }

  // L2-normalize the vector
  const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  if (magnitude > 0) {
    for (let i = 0; i < vector.length; i++) {
      vector[i] = vector[i]! / magnitude;
    }
  }

  return vector;
}

/**
 * A shared singleton fake embedding provider instance.
 */
export const fakeEmbeddingProvider: EmbeddingProvider = createFakeEmbeddingProvider();

/**
 * Returns a default embedding model config for the fake provider.
 *
 * Matches the `chunk_embeddings.embedding_dimensions` CHECK constraint
 * of 1536 (OpenAI ada-002 / text-embedding-3-small compatible).
 */
export function defaultFakeModelConfig(): EmbeddingModelConfig {
  return {
    provider: 'fake',
    model: 'fake-v1',
    dimensions: 1536,
    version: '1.0',
  };
}
