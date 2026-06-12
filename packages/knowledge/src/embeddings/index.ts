// ---------------------------------------------------------------------------
// Embeddings module — provider-neutral vector generation and persistence
// ---------------------------------------------------------------------------

export type {
  EmbeddingProvider,
  EmbeddingModelConfig,
  EmbeddingInput,
  EmbeddingResult,
  EmbeddingRequest,
  EmbeddingResponse,
} from './types.js';

export {
  createFakeEmbeddingProvider,
  fakeEmbeddingProvider,
  defaultFakeModelConfig,
} from './fake-provider.js';

export type { CreateEmbeddingStageOptions } from './embedding-stage.js';
export { createEmbeddingStage } from './embedding-stage.js';
