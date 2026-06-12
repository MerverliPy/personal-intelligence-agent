// ---------------------------------------------------------------------------
// Prompt registry types — code-managed, versioned, typed prompt definitions
// ---------------------------------------------------------------------------
// Per P3-T02 / FR-CONV-004: Production prompts are stored and versioned in
// source code. Each prompt has a stable name, a version identifier, typed
// inputs, and a source-controlled template. Dynamic user/evidence/tool content
// is always delimited as untrusted data.
// ---------------------------------------------------------------------------

import type { Message } from '../gateway/index.js';

/**
 * Cryptographic hash of a prompt template at the time of rendering.
 * Used for provenance and change tracking.
 */
export type TemplateHash = string & { readonly __brand: 'TemplateHash' };

/**
 * Untrusted content blocks that may be injected into a rendered prompt.
 *
 * All content in these blocks originates from external sources — retrieval
 * results, user input, tool outputs — and MUST be clearly delimited so the
 * model can distinguish it from trusted system instructions. Per the security
 * checks for P3-T02, prompts must explicitly treat retrieved and tool content
 * as untrusted data.
 */
export interface UntrustedBlocks {
  /**
   * Authorization-filtered evidence chunks from retrieval.
   * Each entry is a single chunk of text with provenance.
   */
  readonly evidence?: readonly string[];

  /**
   * The user's current message content.
   */
  readonly userMessage?: string;

  /**
   * Results from tool executions.
   * Each entry is the serialized output of a tool call.
   */
  readonly toolResults?: readonly string[];
}

/**
 * Inputs for rendering a prompt template.
 *
 * Every prompt render accepts typed inputs that describe what should be
 * substituted into the template. The template text is static and
 * source-controlled; only the `input` object varies at runtime.
 */
export interface PromptInputs {
  /**
   * Trusted context values from the application layer (e.g., current date,
   * workspace name, model personality guidelines). These are NOT user-supplied
   * and are treated as instruction-level content.
   */
  readonly context?: Record<string, string>;

  /**
   * User-provided or externally-sourced content. Always delimited as
   * untrusted data by the renderer.
   */
  readonly untrusted?: UntrustedBlocks;
}

/**
 * Provenance metadata attached to every rendered prompt.
 *
 * Persisted alongside model-run records (FR-CONV-008) so that evaluation,
 * auditing, and debugging can tie an answer back to the exact prompt version
 * and template that produced it.
 */
export interface PromptProvenance {
  /** Stable prompt name (e.g. "conversation.answer"). */
  readonly promptName: string;

  /** Source-controlled version string (semver). */
  readonly promptVersion: string;

  /** Hash of the template text at render time. */
  readonly templateHash: TemplateHash;
}

/**
 * The fully rendered output of a prompt definition.
 *
 * Contains a `Message` ready to be inserted into a `GenerationRequest` and
 * provenance metadata for auditability.
 */
export interface PromptRenderResult {
  /** The fully rendered system message. */
  readonly message: Message;

  /** Name, version, and template hash for traceability. */
  readonly provenance: PromptProvenance;
}

/**
 * A code-managed prompt definition.
 *
 * Each prompt is a module that exports a `PromptDefinition<TInput>` constant.
 * The `render` function is the only entrypoint consumers use — template text
 * is an implementation detail scoped to the module.
 *
 * @typeParam TInput - The typed input shape this prompt accepts.
 */
export interface PromptDefinition<TInput extends PromptInputs = PromptInputs> {
  /** Stable unique name (e.g. "conversation.answer"). */
  readonly name: string;

  /** Source-controlled version string (semver). */
  readonly version: string;

  /** Human-readable description of the prompt's purpose and behavior. */
  readonly description: string;

  /** The immutable prompt template text. Source-controlled; never derived from user input. */
  readonly template: string;

  /**
   * Renders the prompt template with the supplied inputs into a system
   * message with provenance metadata.
   *
   * The renderer MUST:
   * 1. Delimit all untrusted content (evidence, user message, tool results)
   *    so the model can distinguish it from instruction text.
   * 2. Produce a deterministic hash of the template for provenance.
   * 3. Never include raw secrets or credentials in the output.
   */
  readonly render: (inputs: TInput) => PromptRenderResult;
}
