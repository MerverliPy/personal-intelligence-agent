// ---------------------------------------------------------------------------
// Context compiler types — deterministic context assembly (P3-T03)
// ---------------------------------------------------------------------------
// Per docs/02_ARCHITECTURE.md#9-context-compiler:
//   The compiler produces a manifest containing every included item, source,
//   version, token estimate, and exclusion reason.
// ---------------------------------------------------------------------------

import type { Message, SensitivityClass } from '../gateway/index.js';
import type { PromptRenderResult } from '../prompts/index.js';

/**
 * Context section identifiers in the deterministic order specified by
 * docs/02_ARCHITECTURE.md#9-context-compiler.
 */
export type ContextSection =
  | 'SYSTEM_RULES'
  | 'MODE_AND_CONTRACT'
  | 'APPLICATION_PROMPT'
  | 'APPROVED_MEMORY'
  | 'RETRIEVED_EVIDENCE'
  | 'CONVERSATION_HISTORY'
  | 'USER_REQUEST'
  | 'TOOL_DEFINITIONS';

/**
 * Deterministic, immutable section ordering.
 */
export const CONTEXT_SECTION_ORDER: readonly ContextSection[] = [
  'SYSTEM_RULES',
  'MODE_AND_CONTRACT',
  'APPLICATION_PROMPT',
  'APPROVED_MEMORY',
  'RETRIEVED_EVIDENCE',
  'CONVERSATION_HISTORY',
  'USER_REQUEST',
  'TOOL_DEFINITIONS',
] as const;

// ---------- Evidence (decoupled from @pia/knowledge) ----------

/**
 * An evidence item extracted from the retrieval pipeline.
 * Decoupled from `@pia/knowledge` so the compiler accepts any provenance-tagged
 * text span — from retrieval, tool output, or test fixtures.
 */
export interface EvidenceItem {
  readonly text: string;
  readonly sourceId: string | null;
  readonly documentId: string;
  readonly documentVersionId: string;
  readonly chunkId: string;
  readonly score: number;
  /** Structural locator within the document version. */
  readonly locator: Record<string, unknown>;
  /** Retrieval trace identifier for provenance (FR-CIT-002). */
  readonly retrievalTraceId: string;
  /** Optional sensitivity classification for policy-based exclusion. */
  readonly sensitivity?: SensitivityClass;
}

// ---------- Tool definition ----------

/**
 * A tool available to the model after policy filtering.
 */
export interface ToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly parameters: Record<string, unknown>;
}

// ---------- Inclusion / exclusion ----------

/**
 * Reason an item was included in the context.
 */
export type InclusionReason = 'ALWAYS_REQUIRED' | 'PROVIDED' | 'ABOVE_THRESHOLD';

/**
 * Reason an item was excluded from the context.
 */
export type ExclusionReason = 'BUDGET_EXCEEDED' | 'SENSITIVITY_POLICY' | 'EMPTY' | 'NOT_PROVIDED';

/**
 * Metadata attached to every context item — included or excluded.
 */
export interface ItemMetadata {
  readonly reason: InclusionReason | ExclusionReason;
  readonly source: string;
  readonly version: string;
}

// ---------- Context item ----------

/**
 * A single item in the context assembly.
 */
export interface ContextItem {
  /** The section this item belongs to. */
  readonly section: ContextSection;
  /** The item's rendered text content. */
  readonly content: string;
  /** Whether the item is included in the final messages. */
  readonly included: boolean;
  /** Inclusion/exclusion reason and provenance reference. */
  readonly metadata: ItemMetadata;
  /** Approximate token count for this item. */
  readonly tokenEstimate: number;
  /** Position within the section (0-based). */
  readonly sectionIndex: number;
}

// ---------- Token budget ----------

/**
 * Token budget for the context assembly.
 */
export interface TokenBudget {
  /** Maximum total tokens allowed in the compiled context. */
  readonly maxTokens: number;
}

// ---------- Compaction policy ----------

/**
 * Determines how items are dropped when the token budget is exceeded.
 */
export interface CompactionPolicy {
  /** Strategy for truncating conversation history. */
  readonly conversationTruncation: 'OLDEST_FIRST' | 'NONE';
  /** Strategy for trimming evidence. */
  readonly evidenceTruncation: 'LOWEST_SCORE' | 'NONE';
  /** Minimum conversation messages to retain after compaction. */
  readonly minConversationMessages: number;
  /** Minimum evidence items to retain after compaction. */
  readonly minEvidenceItems: number;
}

// ---------- Compiler input ----------

/**
 * All inputs available to the context compiler.
 */
export interface CompilerInput {
  /** Immutable system safety and authorization rules (section 1). */
  readonly systemRules?: readonly string[];
  /** Product mode identifier (section 2). */
  readonly mode?: string;
  /** Output contract description (section 2). */
  readonly outputContract?: string;
  /** Rendered application prompt from the prompt registry (section 3). */
  readonly prompt?: PromptRenderResult;
  /** Approved memory items within scope (section 4). */
  readonly approvedMemory?: readonly string[];
  /** Retrieved evidence chunks (section 5). */
  readonly evidence?: readonly EvidenceItem[];
  /** Previous conversation messages (section 6). */
  readonly conversationHistory?: readonly Message[];
  /** The user's current request (section 7). */
  readonly userRequest: string;
  /** Available tool definitions after policy filtering (section 8). */
  readonly toolDefinitions?: readonly ToolDefinition[];
  /** Token budget constraint. */
  readonly tokenBudget: TokenBudget;
  /** Compaction policy (falls back to safe defaults). */
  readonly compactionPolicy?: CompactionPolicy;
  /** Maximum sensitivity class permitted for content inclusion. */
  readonly maximumSensitivity?: SensitivityClass;
}

// ---------- Compiler output ----------

/**
 * The full output of the context compiler: a manifest for traceability and
 * a message array ready for `ModelGateway.generate()`.
 */
export interface CompilerOutput {
  /** Full context manifest with every item, reason, and provenance. */
  readonly manifest: ContextManifest;
  /** Messages ready for the model gateway. */
  readonly messages: readonly Message[];
}

// ---------- Manifest ----------

/**
 * The context manifest — a complete record of what was included, excluded,
 * and why, with token estimates and provenance.
 */
export interface ContextManifest {
  /** All items considered during compilation (included or excluded). */
  readonly items: readonly ContextItem[];
  /** Total approximate tokens across all included items. */
  readonly totalTokens: number;
  /** Whether the token budget was exceeded and compaction was applied. */
  readonly budgetExhausted: boolean;
}
