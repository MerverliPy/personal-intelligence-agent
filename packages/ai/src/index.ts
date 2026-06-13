export {
  ModelGatewayError,
  createFakeModelGateway,
  fakeModelGateway,
  fakeModelGatewayConfig,
  createPermissiveSensitivityPolicy,
  createOpenAIGateway,
} from './gateway/index.js';

export type {
  ModelGateway,
  ModelGatewayConfig,
  SensitivityClass,
  Message,
  OutputSchema,
  SafetyConfig,
  BudgetConfig,
  GenerationRequest,
  GenerationResult,
  GenerationEvent,
  Usage,
  FinishReason,
  ErrorCategory,
  SensitivityPolicy,
  OpenAIGatewayOptions,
} from './gateway/index.js';

// ---------------------------------------------------------------------------
// Prompt registry (P3-T02)
// ---------------------------------------------------------------------------

export { renderPrompt, createPromptRenderer, createPromptRegistry } from './prompts/index.js';

export type {
  TemplateHash,
  UntrustedBlocks,
  PromptInputs,
  PromptProvenance,
  PromptRenderResult,
  PromptDefinition,
  PromptRegistry,
  AnswerPromptInputs,
  ChatPromptInputs,
} from './prompts/index.js';

// ---------------------------------------------------------------------------
// Context compiler (P3-T03)
// ---------------------------------------------------------------------------

export {
  compileContext,
  CONTEXT_SECTION_ORDER,
  DEFAULT_COMPACTION_POLICY,
  estimateTokens,
} from './context/index.js';

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
} from './context/index.js';

// ---------------------------------------------------------------------------
// Assistant orchestration (P3-T05)
// ---------------------------------------------------------------------------

export {
  AssistantOrchestrator,
  mapDbRoleToGateway,
  mapGatewayRoleToDb,
} from './assistant/index.js';

export type {
  OrchestratorSseEvent,
  OrchestratorRunOptions,
  AssistantOrchestratorConfig,
  SseRunStartedEvent,
  SseResponseDeltaEvent,
  SseCitationProvisionalEvent,
  SseApprovalRequiredEvent,
  SseResponseCompletedEvent,
  SseRunFailedEvent,
} from './assistant/index.js';
