// ---------------------------------------------------------------------------
// Evals package barrel exports (P2-T10 retrieval, P3-T10 answer)
// ---------------------------------------------------------------------------

export type {
  EvalCase,
  EvalCaseInput,
  EvalCaseExpected,
  EvalCaseResult,
  EvalDataset,
  EvalMetrics,
  EvalRunMetadata,
  EvalReport,
  FixtureRegistry,
} from './types.js';

export {
  computeRecallAtK,
  computePrecisionAtK,
  computeMRR,
  checkVersionCorrectness,
  checkAuthorizationCorrectness,
  percentile,
  computeAggregateMetrics,
} from './scorer.js';

export { loadDataset, seedFixtures, runEval, type RunEvalOptions } from './runner.js';

// P3-T10 — Answer (grounded-answer) evaluation harness
export type {
  AnswerEvalCase,
  AnswerEvalCaseInput,
  AnswerEvalCaseExpected,
  AnswerEvidenceChunk,
  ClaimedAnswer,
  ClaimedCitation,
  AnswerEvalCaseResult,
  AnswerEvalMetrics,
  AnswerEvalRunMetadata,
  AnswerEvalReport,
  AnswerEvalDataset,
} from './answerTypes.js';

export {
  REFUSAL_MARKERS,
  CONFLICT_MARKERS,
  PROMPT_INJECTION_PATTERNS,
  buildEvidenceIndex,
  isCitationResolved,
  computeClaimSupport,
  tokenize,
  isRefusal,
  mentionsConflict,
  containsPromptInjection,
  scoreAnswerCase,
  computeAnswerAggregateMetrics,
} from './answerScorer.js';

export { loadAnswerDataset, runAnswerEval, type RunAnswerEvalOptions } from './answerRunner.js';
