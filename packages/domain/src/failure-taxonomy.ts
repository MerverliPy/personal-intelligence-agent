// ---------------------------------------------------------------------------
// Failure classification taxonomy per FR-FBK-003
// ---------------------------------------------------------------------------
// Taxonomy of automatic failure classifications for model runs and
// retrieval. Each classification includes a human-readable label and
// a structured code. The taxonomy is stable and versioned so that
// evaluation pipelines can rely on consistent classification names.
// ---------------------------------------------------------------------------

export const FAILURE_CLASSIFICATION = {
  KNOWLEDGE_MISSING: 'knowledge_missing',
  STALE_KNOWLEDGE: 'stale_knowledge',
  RETRIEVAL: 'retrieval',
  RANKING: 'ranking',
  REASONING: 'reasoning',
  CITATION: 'citation',
  TOOL_SELECTION: 'tool_selection',
  TOOL_EXECUTION: 'tool_execution',
  MEMORY: 'memory',
  PERMISSION: 'permission',
  INSTRUCTION: 'instruction',
  SAFETY: 'safety',
  UI: 'ui',
  MODEL_LIMITATION: 'model_limitation',
  INTEGRATION: 'integration',
} as const;

export type FailureClass = (typeof FAILURE_CLASSIFICATION)[keyof typeof FAILURE_CLASSIFICATION];

export const FAILURE_CLASSIFICATION_LABELS: Record<FailureClass, string> = {
  knowledge_missing: 'Knowledge Missing',
  stale_knowledge: 'Stale Knowledge',
  retrieval: 'Retrieval',
  ranking: 'Ranking',
  reasoning: 'Reasoning',
  citation: 'Citation',
  tool_selection: 'Tool Selection',
  tool_execution: 'Tool Execution',
  memory: 'Memory',
  permission: 'Permission',
  instruction: 'Instruction',
  safety: 'Safety',
  ui: 'UI',
  model_limitation: 'Model Limitation',
  integration: 'Integration',
};

export function isValidFailureClass(value: string): value is FailureClass {
  return Object.values(FAILURE_CLASSIFICATION).includes(value as FailureClass);
}
