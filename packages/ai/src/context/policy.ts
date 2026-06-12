// ---------------------------------------------------------------------------
// Compilation policy — default section ordering and budget allocation
// ---------------------------------------------------------------------------

import type { CompactionPolicy, ContextSection } from './types.js';

// ---------- Section labels ----------

/**
 * Human-readable labels for each context section.
 */
export const SECTION_LABELS: Record<ContextSection, string> = {
  SYSTEM_RULES: 'SYSTEM RULES',
  MODE_AND_CONTRACT: 'MODE AND OUTPUT CONTRACT',
  APPLICATION_PROMPT: 'APPLICATION PROMPT',
  APPROVED_MEMORY: 'APPROVED MEMORY',
  RETRIEVED_EVIDENCE: 'RETRIEVED EVIDENCE',
  CONVERSATION_HISTORY: 'CONVERSATION HISTORY',
  USER_REQUEST: 'USER REQUEST',
  TOOL_DEFINITIONS: 'TOOL DEFINITIONS',
};

// ---------- Default compaction policy ----------

/**
 * Safe default compaction policy.
 *
 * - Oldest conversation messages dropped first, retaining at least 2.
 * - Lowest-scored evidence trimmed first, retaining at least 1.
 * - If budget is still exceeded after both, tool definitions are dropped.
 * - System rules, mode, prompt, memory, and user request are never dropped.
 */
export const DEFAULT_COMPACTION_POLICY: CompactionPolicy = {
  conversationTruncation: 'OLDEST_FIRST',
  evidenceTruncation: 'LOWEST_SCORE',
  minConversationMessages: 2,
  minEvidenceItems: 1,
};

// ---------- Budget weight allocation ----------

/**
 * Approximate budget allocation weights per section (out of 1.0).
 * Used only for estimating section caps — the compiler applies compaction
 * across the total budget, not per-section.
 */
export const SECTION_BUDGET_WEIGHTS: Partial<Record<ContextSection, number>> = {
  SYSTEM_RULES: 0.05,
  MODE_AND_CONTRACT: 0.05,
  APPLICATION_PROMPT: 0.15,
  APPROVED_MEMORY: 0.1,
  RETRIEVED_EVIDENCE: 0.4,
  CONVERSATION_HISTORY: 0.15,
  USER_REQUEST: 0.05,
  TOOL_DEFINITIONS: 0.05,
};

// ---------- Token estimation ----------

/**
 * Approximate token count from text length.
 *
 * Uses the standard English heuristic of ~4 characters per token.
 * This is intentionally approximate — exact token counting requires a
 * model-specific tokenizer and will be refined when observability metrics
 * with real provider token counts are available (FR-CONV-008).
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
