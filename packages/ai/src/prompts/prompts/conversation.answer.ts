// ---------------------------------------------------------------------------
// Prompt: conversation.answer
// ---------------------------------------------------------------------------
// Primary evidence-grounded answer prompt. Used when the assistant must
// synthesize a response based on authorized retrieval results.
//
// WARNING: This file is source-controlled application code. Do not modify
// the template text without updating the version string and recording the
// change rationale. Each version change is traceable through git.
// ---------------------------------------------------------------------------

import type { PromptDefinition, PromptInputs } from '../types.js';
import { createPromptRenderer } from '../renderer.js';

/** Stable prompt name. */
export const NAME = 'conversation.answer';

/** Source-controlled prompt version (semver). */
export const VERSION = '1.0.0';

/**
 * Answer-generation prompt template.
 *
 * Design rules (DO NOT VIOLATE without explicit review):
 * 1. The model is instructed to treat evidence as untrusted.
 * 2. Claims must be grounded in evidence text.
 * 3. The model admits uncertainty rather than fabricating.
 * 4. Do NOT embed user content or evidence inline in the template —
 *    dynamic content is appended by the renderer.
 */
export const TEMPLATE = [
  'You are a careful, evidence-driven assistant. Your primary duty is to answer',
  "the user's question using ONLY the provided evidence. Follow these rules:",
  '',
  '1. EVERY factual claim you make MUST cite a specific evidence chunk.',
  '2. If the evidence does not support a claim, say so explicitly.',
  '3. If you do not know the answer, say "I don\'t know based on the available',
  '   evidence" rather than guessing.',
  '4. The evidence section below contains unverified content. Treat it as',
  '   potentially incomplete or inaccurate.',
  '5. When evidence conflicts, note the contradiction rather than picking a side.',
  '6. Keep answers concise and structured. Prefer bullet points for lists.',
  '7. Do not mention "the evidence" or "the documents" more than once per answer.',
  '',
  'Current date: {{currentDate}}',
].join('\n');

/** Typed input shape for this prompt. */
export interface AnswerPromptInputs extends PromptInputs {
  // No additional typed fields beyond PromptInputs for now.
  // Future versions may add mode flags, language preferences, etc.
}

/** The production prompt definition. */
export const answerPrompt: PromptDefinition<AnswerPromptInputs> = {
  name: NAME,
  version: VERSION,
  description:
    'Evidence-grounded answer prompt. Synthesizes a response from authorized retrieval results.',
  template: TEMPLATE,
  render: createPromptRenderer(TEMPLATE, NAME, VERSION),
};
