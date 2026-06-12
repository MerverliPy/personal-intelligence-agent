export type {
  ContextSection,
  EvidenceItem,
  ToolDefinition,
  InclusionReason,
  ExclusionReason,
  ItemMetadata,
  ContextItem,
  ContextManifest,
  TokenBudget,
  CompactionPolicy,
  CompilerInput,
  CompilerOutput,
} from './types.js';

export { CONTEXT_SECTION_ORDER } from './types.js';

export { SECTION_LABELS, DEFAULT_COMPACTION_POLICY, estimateTokens } from './policy.js';

export { compileContext } from './compiler.js';
