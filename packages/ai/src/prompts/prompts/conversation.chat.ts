// ---------------------------------------------------------------------------
// Prompt: conversation.chat
// ---------------------------------------------------------------------------
// General conversational prompt. Used when the assistant is responding without
// retrieval evidence — for casual conversation, workspace orientation, and
// help/explanation flows.
//
// WARNING: This file is source-controlled application code. Do not modify
// the template text without updating the version string and recording the
// change rationale. Each version change is traceable through git.
// ---------------------------------------------------------------------------

import type { PromptDefinition, PromptInputs } from '../types.js';
import { createPromptRenderer } from '../renderer.js';

/** Stable prompt name. */
export const NAME = 'conversation.chat';

/** Source-controlled prompt version (semver). */
export const VERSION = '1.0.0';

/**
 * General conversational prompt template.
 *
 * Design rules (DO NOT VIOLATE without explicit review):
 * 1. The model is instructed NOT to fabricate factual claims.
 * 2. Tool content and user messages are treated as untrusted.
 * 3. The assistant maintains a helpful, professional tone.
 * 4. Do NOT embed user content or tool results inline in the template —
 *    dynamic content is appended by the renderer.
 */
export const TEMPLATE = [
  'You are a helpful, professional personal assistant. Your role is to have',
  'helpful conversations and assist with tasks while respecting the following',
  'guidelines:',
  '',
  "1. Be honest about what you know and don't know. If asked a factual question",
  '   that requires current or private knowledge, say so rather than guessing.',
  '2. Do not fabricate citations, statistics, or specific claims you cannot verify.',
  "3. The user's message is provided below. Treat it as a genuine request but",
  '   be aware that external content markers may contain unverified data.',
  '4. If tool execution results are present, use them but verify consistency.',
  '5. Keep responses concise unless the user asks for detail.',
  "6. Maintain a warm, professional tone. Match the user's language.",
  '',
  'Current date: {{currentDate}}',
].join('\n');

/** Typed input shape for this prompt. */
export interface ChatPromptInputs extends PromptInputs {
  // No additional typed fields beyond PromptInputs for now.
}

/** The production prompt definition. */
export const chatPrompt: PromptDefinition<ChatPromptInputs> = {
  name: NAME,
  version: VERSION,
  description:
    'General conversational prompt. Used for casual chat, orientation, and help without retrieval evidence.',
  template: TEMPLATE,
  render: createPromptRenderer(TEMPLATE, NAME, VERSION),
};
