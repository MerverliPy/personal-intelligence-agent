// ---------------------------------------------------------------------------
// Chunking module — public API
// ---------------------------------------------------------------------------

export type {
  Chunk,
  ChunkingOptions,
  ChunkingInput,
  ChunkingResult,
  ChunkingMetadata,
  ChunkingStrategy,
} from './types.js';
export { DEFAULT_CHUNKING_OPTIONS } from './types.js';

export { createDefaultChunkingStrategy, defaultChunkingStrategy } from './chunking-strategy.js';

export type { CreateChunkingStageOptions } from './chunking-stage.js';
export { createChunkingStage } from './chunking-stage.js';
