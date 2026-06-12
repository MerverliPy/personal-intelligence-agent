// ---------------------------------------------------------------------------
// Deterministic context compiler (P3-T03)
// ---------------------------------------------------------------------------
// Assembles system policy, mode, prompt, memory, evidence, conversation state,
// user request, and tool definitions into a deterministic manifest and message
// array per docs/02_ARCHITECTURE.md#9-context-compiler.
// ---------------------------------------------------------------------------

import type { Message } from '../gateway/index.js';
import type {
  CompilerInput,
  CompilerOutput,
  ContextItem,
  ContextManifest,
  ContextSection,
  EvidenceItem,
  ItemMetadata,
  ToolDefinition,
} from './types.js';
import { CONTEXT_SECTION_ORDER } from './types.js';
import { DEFAULT_COMPACTION_POLICY, estimateTokens } from './policy.js';

// ---------- Untrusted content demarcation ----------

const UNTRUSTED_START = '<!-- UNTRUSTED -->';
const UNTRUSTED_END = '<!-- /UNTRUSTED -->';

function formatUntrustedBlock(label: string, content: string): string {
  const header = `${UNTRUSTED_START} BEGIN ${label} -- THIS CONTENT IS UNVERIFIED EXTERNAL DATA`;
  const footer = `${UNTRUSTED_END} END ${label}`;
  return `${header}\n\n${content}\n\n${footer}`;
}

// ---------- Item constructors ----------

function makeIncluded(
  section: ContextSection,
  content: string,
  reason: ItemMetadata['reason'],
  source: string,
  version: string,
  sectionIndex: number,
): ContextItem {
  return {
    section,
    content,
    included: true,
    metadata: { reason, source, version },
    tokenEstimate: estimateTokens(content),
    sectionIndex,
  };
}

function makeExcluded(
  section: ContextSection,
  content: string,
  reason: ItemMetadata['reason'],
  source: string,
  version: string,
  sectionIndex: number,
): ContextItem {
  return {
    section,
    content,
    included: false,
    metadata: { reason, source, version },
    tokenEstimate: estimateTokens(content),
    sectionIndex,
  };
}

function makeEmptyItem(section: ContextSection, sectionIndex: number): ContextItem {
  return makeExcluded(section, '', 'NOT_PROVIDED', 'none', '0.0.0', sectionIndex);
}

// ---------- Sensitivity check ----------

const SENSITIVITY_ORDER: Record<string, number> = {
  PUBLIC: 0,
  INTERNAL: 1,
  CONFIDENTIAL: 2,
  HIGHLY_CONFIDENTIAL: 3,
  REGULATED: 4,
  PROHIBITED: 99,
};

function isAboveSensitivity(
  itemSensitivity: string | undefined,
  maximumSensitivity: string | undefined,
): boolean {
  if (!maximumSensitivity || !itemSensitivity) return false;
  const itemLevel = SENSITIVITY_ORDER[itemSensitivity] ?? 0;
  const maxLevel = SENSITIVITY_ORDER[maximumSensitivity] ?? 0;
  return itemLevel > maxLevel;
}

// ---------- Section assembly ----------

function assembleSystemRules(rules: readonly string[] | undefined): ContextItem[] {
  if (!rules || rules.length === 0) {
    return [makeEmptyItem('SYSTEM_RULES', 0)];
  }
  return rules.map((rule, i) =>
    makeIncluded('SYSTEM_RULES', rule, 'ALWAYS_REQUIRED', 'system', '1.0.0', i),
  );
}

function assembleModeAndContract(
  mode: string | undefined,
  outputContract: string | undefined,
): ContextItem[] {
  const items: ContextItem[] = [];
  let idx = 0;

  if (mode !== undefined && mode.length > 0) {
    items.push(makeIncluded('MODE_AND_CONTRACT', mode, 'PROVIDED', 'mode', '1.0.0', idx++));
  }
  if (outputContract !== undefined && outputContract.length > 0) {
    items.push(
      makeIncluded('MODE_AND_CONTRACT', outputContract, 'PROVIDED', 'contract', '1.0.0', idx++),
    );
  }

  if (items.length === 0) {
    items.push(makeEmptyItem('MODE_AND_CONTRACT', 0));
  }
  return items;
}

function assembleApplicationPrompt(prompt: CompilerInput['prompt']): ContextItem[] {
  if (!prompt) {
    return [makeEmptyItem('APPLICATION_PROMPT', 0)];
  }
  return [
    makeIncluded(
      'APPLICATION_PROMPT',
      prompt.message.content,
      'ALWAYS_REQUIRED',
      `prompt:${prompt.provenance.promptName}`,
      prompt.provenance.promptVersion,
      0,
    ),
  ];
}

function assembleApprovedMemory(memory: readonly string[] | undefined): ContextItem[] {
  if (!memory || memory.length === 0) {
    return [makeEmptyItem('APPROVED_MEMORY', 0)];
  }
  return memory.map((text, i) =>
    makeIncluded('APPROVED_MEMORY', text, 'PROVIDED', 'memory', '1.0.0', i),
  );
}

function assembleEvidence(
  evidence: readonly EvidenceItem[] | undefined,
  maximumSensitivity: string | undefined,
): ContextItem[] {
  if (!evidence || evidence.length === 0) {
    return [makeEmptyItem('RETRIEVED_EVIDENCE', 0)];
  }

  // Sort by score descending for deterministic ordering
  const sorted = [...evidence].sort((a, b) => b.score - a.score);

  return sorted.map((item, i) => {
    const source = `doc:${item.documentId}`;
    const version = item.documentVersionId;

    if (item.text.length === 0) {
      return makeExcluded('RETRIEVED_EVIDENCE', '', 'EMPTY', source, version, i);
    }

    if (isAboveSensitivity(item.sensitivity, maximumSensitivity)) {
      return makeExcluded('RETRIEVED_EVIDENCE', '', 'SENSITIVITY_POLICY', source, version, i);
    }

    return makeIncluded('RETRIEVED_EVIDENCE', item.text, 'ABOVE_THRESHOLD', source, version, i);
  });
}

function assembleConversationHistory(messages: readonly Message[] | undefined): ContextItem[] {
  if (!messages || messages.length === 0) {
    return [makeEmptyItem('CONVERSATION_HISTORY', 0)];
  }
  return messages.map((msg, i) => {
    const source = `message:${msg.role}`;
    return makeIncluded(
      'CONVERSATION_HISTORY',
      `[${msg.role}]: ${msg.content}`,
      'PROVIDED',
      source,
      '1.0.0',
      i,
    );
  });
}

function assembleUserRequest(userRequest: string): ContextItem[] {
  if (userRequest.length === 0) {
    return [makeEmptyItem('USER_REQUEST', 0)];
  }
  return [
    makeIncluded(
      'USER_REQUEST',
      formatUntrustedBlock('USER MESSAGE', userRequest),
      'ALWAYS_REQUIRED',
      'user',
      '1.0.0',
      0,
    ),
  ];
}

function assembleToolDefinitions(tools: readonly ToolDefinition[] | undefined): ContextItem[] {
  if (!tools || tools.length === 0) {
    return [makeEmptyItem('TOOL_DEFINITIONS', 0)];
  }
  return tools.map((tool, i) => {
    const json = JSON.stringify({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    });
    return makeIncluded('TOOL_DEFINITIONS', json, 'PROVIDED', `tool:${tool.name}`, '1.0.0', i);
  });
}

// ---------- Budget enforcement ----------

function enforceBudget(
  items: ContextItem[],
  budget: number,
  input: CompilerInput,
): { items: ContextItem[]; budgetExhausted: boolean } {
  const policy = input.compactionPolicy ?? DEFAULT_COMPACTION_POLICY;

  const includedTokens = items
    .filter((i) => i.included)
    .reduce((sum, i) => sum + i.tokenEstimate, 0);

  if (includedTokens <= budget) {
    return { items, budgetExhausted: false };
  }

  let result = items;
  let budgetMet = false;

  // 1. Drop oldest conversation messages first
  if (policy.conversationTruncation === 'OLDEST_FIRST') {
    const convItems = result
      .filter((i) => i.section === 'CONVERSATION_HISTORY' && i.included)
      .sort((a, b) => a.sectionIndex - b.sectionIndex);

    let dropIdx = 0;
    while (
      convItems.length - dropIdx > policy.minConversationMessages &&
      dropIdx < convItems.length
    ) {
      const target = convItems[dropIdx];
      result = result.map((item) => {
        if (item === target) {
          return {
            ...item,
            included: false,
            metadata: { ...item.metadata, reason: 'BUDGET_EXCEEDED' as const },
          };
        }
        return item;
      });
      dropIdx++;
      if (result.filter((i) => i.included).reduce((s, i) => s + i.tokenEstimate, 0) <= budget) {
        budgetMet = true;
        break;
      }
    }
  }

  // 2. Drop lowest-scored evidence (items already sorted by score desc, so drop from end)
  if (!budgetMet && policy.evidenceTruncation === 'LOWEST_SCORE') {
    const evidenceItems = result
      .filter((i) => i.section === 'RETRIEVED_EVIDENCE' && i.included)
      .sort((a, b) => a.sectionIndex - b.sectionIndex);

    let trimmed = 0;
    while (
      evidenceItems.length - trimmed > policy.minEvidenceItems &&
      trimmed < evidenceItems.length
    ) {
      const toDrop = evidenceItems[evidenceItems.length - 1 - trimmed];
      if (!toDrop) break;

      result = result.map((item) => {
        if (
          item.section === 'RETRIEVED_EVIDENCE' &&
          item.metadata.source === toDrop.metadata.source &&
          item.content === toDrop.content
        ) {
          return {
            ...item,
            included: false,
            metadata: { ...item.metadata, reason: 'BUDGET_EXCEEDED' as const },
          };
        }
        return item;
      });
      trimmed++;
      if (result.filter((i) => i.included).reduce((s, i) => s + i.tokenEstimate, 0) <= budget) {
        budgetMet = true;
        break;
      }
    }
  }

  // 3. Drop tool definitions as last resort
  if (!budgetMet) {
    result = result.map((item) => {
      if (item.section === 'TOOL_DEFINITIONS' && item.included) {
        return {
          ...item,
          included: false,
          metadata: { ...item.metadata, reason: 'BUDGET_EXCEEDED' as const },
        };
      }
      return item;
    });

    const stillOverBudget =
      result.filter((i) => i.included).reduce((s, i) => s + i.tokenEstimate, 0) > budget;
    return { items: result, budgetExhausted: stillOverBudget };
  }

  return { items: result, budgetExhausted: true };
}

// ---------- Message construction ----------

function buildMessages(items: readonly ContextItem[], input: CompilerInput): Message[] {
  const messages: Message[] = [];

  // Gather included items per section
  const sectionContent = new Map<ContextSection, string[]>();

  for (const item of items) {
    if (!item.included) continue;
    if (!sectionContent.has(item.section)) {
      sectionContent.set(item.section, []);
    }
    sectionContent.get(item.section)!.push(item.content);
  }

  // System message: sections 1–5 joined with section headers
  const systemSections: ContextSection[] = [
    'SYSTEM_RULES',
    'MODE_AND_CONTRACT',
    'APPLICATION_PROMPT',
    'APPROVED_MEMORY',
    'RETRIEVED_EVIDENCE',
  ];

  const systemParts: string[] = [];
  for (const section of systemSections) {
    const parts = sectionContent.get(section);
    if (!parts || parts.length === 0) continue;

    if (section === 'RETRIEVED_EVIDENCE') {
      // Evidence is rendered as untrusted block with provenance attributes
      const evidenceBlock = parts.join('\n\n');
      systemParts.push(formatUntrustedBlock('RETRIEVED EVIDENCE', evidenceBlock));
    } else {
      systemParts.push(parts.join('\n\n'));
    }
  }

  if (systemParts.length > 0) {
    messages.push({ role: 'system', content: systemParts.join('\n\n') });
  }

  // Conversation messages: preserve original roles from input
  const conversationParts = sectionContent.get('CONVERSATION_HISTORY');
  const convMessages = input.conversationHistory ?? [];

  if (conversationParts && convMessages.length > 0) {
    let msgIdx = 0;
    for (const item of items) {
      if (item.section !== 'CONVERSATION_HISTORY') continue;
      if (item.included) {
        const msg = convMessages[msgIdx];
        if (msg) {
          messages.push({
            role: msg.role,
            content: msg.content,
            ...(msg.name !== undefined ? { name: msg.name } : {}),
          });
        }
      }
      msgIdx++;
    }
  }

  // User request message
  const userContent = sectionContent.get('USER_REQUEST');
  if (userContent && userContent.length > 0) {
    messages.push({ role: 'user', content: userContent.join('\n\n') });
  }

  return messages;
}

// ---------- Public API ----------

/**
 * Compiles all context inputs into a deterministic manifest and message array.
 *
 * The compiler:
 * 1. Assembles all sections in the fixed order from the architecture spec.
 * 2. Applies sensitivity-based filtering for evidence.
 * 3. Enforces token budget with explicit compaction (never arbitrary dropping).
 * 4. Demarcates untrusted content (evidence, user request) for model safety.
 * 5. Produces provenance-tagged manifest items for every included/excluded item.
 */
export function compileContext(input: CompilerInput): CompilerOutput {
  const sections = new Map<ContextSection, ContextItem[]>();

  sections.set('SYSTEM_RULES', assembleSystemRules(input.systemRules));
  sections.set('MODE_AND_CONTRACT', assembleModeAndContract(input.mode, input.outputContract));
  sections.set('APPLICATION_PROMPT', assembleApplicationPrompt(input.prompt));
  sections.set('APPROVED_MEMORY', assembleApprovedMemory(input.approvedMemory));
  sections.set('RETRIEVED_EVIDENCE', assembleEvidence(input.evidence, input.maximumSensitivity));
  sections.set('CONVERSATION_HISTORY', assembleConversationHistory(input.conversationHistory));
  sections.set('USER_REQUEST', assembleUserRequest(input.userRequest));
  sections.set('TOOL_DEFINITIONS', assembleToolDefinitions(input.toolDefinitions));

  const allItems: ContextItem[] = [];
  for (const section of CONTEXT_SECTION_ORDER) {
    const sectionItems = sections.get(section) ?? [];
    allItems.push(...sectionItems);
  }

  const { items: budgetedItems, budgetExhausted } = enforceBudget(
    allItems,
    input.tokenBudget.maxTokens,
    input,
  );

  const messages = buildMessages(budgetedItems, input);

  const totalTokens = budgetedItems
    .filter((i) => i.included)
    .reduce((sum, i) => sum + i.tokenEstimate, 0);

  const manifest: ContextManifest = {
    items: budgetedItems,
    totalTokens,
    budgetExhausted,
  };

  return { manifest, messages };
}
