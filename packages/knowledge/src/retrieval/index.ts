// ---------------------------------------------------------------------------
// Retrieval module barrel exports (P2-T07)
// ---------------------------------------------------------------------------

export type {
  RetrievalQuery,
  RetrievalResult,
  RetrievalCandidate,
  RetrievalConfig,
  RetrievalTrace,
  RetrievalResponse,
} from './types.js';

export { executeLexicalSearch } from './lexical-search.js';
export type { VectorSearchOptions } from './vector-search.js';
export { executeVectorSearch } from './vector-search.js';
export { reciprocalRankFusion, deduplicateByContentHash, computeRrfScores } from './fusion.js';
export type { RetrievalServiceConfig } from './retrieval-service.js';
export { RetrievalService } from './retrieval-service.js';
