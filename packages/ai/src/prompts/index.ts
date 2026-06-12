// ---------------------------------------------------------------------------
// Prompt registry barrel exports
// ---------------------------------------------------------------------------

export type {
  TemplateHash,
  UntrustedBlocks,
  PromptInputs,
  PromptProvenance,
  PromptRenderResult,
  PromptDefinition,
} from './types.js';

export { renderPrompt, createPromptRenderer } from './renderer.js';

export type { PromptRegistry } from './registry.js';
export { createPromptRegistry } from './registry.js';

// Production prompt definitions — import and register these at startup
export {
  NAME as ANSWER_PROMPT_NAME,
  VERSION as ANSWER_PROMPT_VERSION,
  answerPrompt,
} from './prompts/conversation.answer.js';
export type { AnswerPromptInputs } from './prompts/conversation.answer.js';

export {
  NAME as CHAT_PROMPT_NAME,
  VERSION as CHAT_PROMPT_VERSION,
  chatPrompt,
} from './prompts/conversation.chat.js';
export type { ChatPromptInputs } from './prompts/conversation.chat.js';
