// ---------------------------------------------------------------------------
// Model gateway module — provider-neutral generation
// ---------------------------------------------------------------------------

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
} from './types.js';
export { ModelGatewayError } from './types.js';

export type { SensitivityPolicy } from './policy.js';
export { createPermissiveSensitivityPolicy } from './policy.js';

export {
  createFakeModelGateway,
  fakeModelGateway,
  fakeModelGatewayConfig,
} from './fake-adapter.js';

export type { OpenAIGatewayOptions } from './openai-adapter.js';
export { createOpenAIGateway } from './openai-adapter.js';
