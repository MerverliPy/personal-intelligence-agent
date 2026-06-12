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
