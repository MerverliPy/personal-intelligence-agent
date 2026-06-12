// ---------------------------------------------------------------------------
// Prompt registry — in-memory collection of code-managed prompt definitions
// ---------------------------------------------------------------------------
// The registry is a simple, side-effect-free container for PromptDefinition
// instances. It provides lookup by name and validation that all registered
// prompts have the required metadata.
//
// Design decisions:
// - The registry is an in-memory map, not a hosted service. This satisfies
//   the acceptance criterion: "No hosted reusable-prompt object is required."
// - Registration happens at application startup by importing prompt modules.
//   There is no runtime prompt upload, modification, or resolution against a
//   remote service.
// - The registry enforces that every prompt name is unique and that all
//   required provenance fields are present.
// ---------------------------------------------------------------------------

import type { PromptDefinition } from './types.js';

/**
 * A read-only collection of registered prompt definitions.
 *
 * Prompts are registered by importing their module files. The registry exposes
 * lookup (get by name) and inspection (list all) operations. No mutation
 * operations are available — all prompts come from source code.
 */
export interface PromptRegistry {
  /**
   * Retrieves a prompt definition by its stable name.
   *
   * @param name - The prompt name (e.g. "conversation.answer").
   * @returns The prompt definition, or `undefined` if not found.
   */
  get(name: string): PromptDefinition | undefined;

  /**
   * Returns all registered prompt names and versions.
   * Useful for audit logging and startup health checks.
   */
  list(): ReadonlyArray<{ readonly name: string; readonly version: string }>;
}

/**
 * Creates an empty prompt registry.
 *
 * Prompts must be registered via `registerPrompt` before use. The registry
 * validates that every prompt has a non-empty name, version, and template.
 */
export function createPromptRegistry(): {
  readonly registry: PromptRegistry;
  readonly register: (prompt: PromptDefinition) => void;
} {
  const prompts = new Map<string, PromptDefinition>();

  function register(prompt: PromptDefinition): void {
    // Validate required fields
    if (!prompt.name || prompt.name.length === 0) {
      throw new Error('Prompt registration failed: name is required');
    }
    if (!prompt.version || prompt.version.length === 0) {
      throw new Error(`Prompt registration failed: version is required (name=${prompt.name})`);
    }
    if (!prompt.template || prompt.template.length === 0) {
      throw new Error(`Prompt registration failed: template is required (name=${prompt.name})`);
    }
    if (prompts.has(prompt.name)) {
      throw new Error(
        `Prompt registration failed: duplicate name "${prompt.name}". ` +
          `Existing version=${prompts.get(prompt.name)!.version}, ` +
          `New version=${prompt.version}`,
      );
    }
    prompts.set(prompt.name, prompt);
  }

  const registry: PromptRegistry = {
    get(name: string): PromptDefinition | undefined {
      return prompts.get(name);
    },

    list(): ReadonlyArray<{ readonly name: string; readonly version: string }> {
      return Array.from(prompts.values()).map((p) => ({
        name: p.name,
        version: p.version,
      }));
    },
  };

  return { registry, register };
}
