// ---------------------------------------------------------------------------
// Evals package barrel exports (P2-T10)
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
