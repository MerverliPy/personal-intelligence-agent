// ---------------------------------------------------------------------------
// Embedding provider interface — provider-neutral contract for vector generation
// ---------------------------------------------------------------------------
// Per P2-T06: Provider SDK types remain inside the adapter. Embedding model,
// dimension, and pipeline version are persisted. Retries must not duplicate
// embeddings. Mixed dimensions/models are isolated by embedding_version.
//
// The EmbeddingProvider abstracts the external embedding service behind a
// typed contract, following the same pattern as ScanProvider in ../scan.ts.
// ---------------------------------------------------------------------------

/**
 * Configuration for an embedding model used by the embedding stage.
 *
 * Persisted alongside each chunk embedding so vectors from different
 * models/dimensions/versions are never silently mixed.
 */
export interface EmbeddingModelConfig {
  /** Provider identifier (e.g. "fake", "openai"). */
  readonly provider: string;
  /** Model name (e.g. "text-embedding-3-small"). */
  readonly model: string;
  /** Expected embedding dimensions. Must match the database CHECK constraint. */
  readonly dimensions: number;
  /** Pipeline version — stored in `embedding_version` column. */
  readonly version: string;
}

/**
 * A single text input to the embedding provider.
 */
export interface EmbeddingInput {
  /** Index of this input in the original batch (used to align results). */
  readonly index: number;
  /** Text content to embed. */
  readonly text: string;
}

/**
 * A single embedding vector result.
 */
export interface EmbeddingResult {
  /** Index matching the original input. */
  readonly index: number;
  /** Float vector of the configured dimensionality. */
  readonly vector: number[];
}

/**
 * Request to generate embeddings for a batch of texts.
 */
export interface EmbeddingRequest {
  /** The model configuration to use. */
  readonly model: EmbeddingModelConfig;
  /** Ordered inputs to embed. */
  readonly inputs: readonly EmbeddingInput[];
}

/**
 * Response containing embedding vectors for the requested inputs.
 */
export interface EmbeddingResponse {
  /** The model configuration that produced these embeddings. */
  readonly model: EmbeddingModelConfig;
  /** Embedding vectors, one per input (may be in any order). */
  readonly results: readonly EmbeddingResult[];
}

/**
 * Provider-neutral embedding service abstraction.
 *
 * Implementations MUST NOT expose SDK types or credentials across the
 * boundary. All provider-specific logic (API keys, SDK imports, network
 * calls) is contained within the adapter implementation.
 *
 * Implementations should be stateless — configuration is provided in each
 * request's {@link EmbeddingModelConfig}.
 */
export interface EmbeddingProvider {
  /**
   * Generate embeddings for a batch of text inputs.
   *
   * @param request - The model config and texts to embed.
   * @returns Embedding vectors aligned by input index.
   * @throws Error on transient failures (network, rate-limit) for retry.
   * @throws Terminal provider errors (auth, unsupported model) for terminal.
   */
  embed(request: EmbeddingRequest): Promise<EmbeddingResponse>;
}
