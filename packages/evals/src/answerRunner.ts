// ---------------------------------------------------------------------------
// Answer evaluation runner — dataset loading and report generation (P3-T10)
// ---------------------------------------------------------------------------
// The runner loads a portable YAML dataset of (evidence + claimed_answer)
// cases, runs the deterministic scorers, and produces a JSON report that
// records dataset version, scorer version, prompt name+version, model
// provider+name, retrieval config version, and Node runtime versions.
//
// Security-critical cases (fabricated source, indirect prompt injection,
// unauthorized cross-tenant citations) must pass — failures cause the
// command to exit non-zero regardless of aggregate score.
// ---------------------------------------------------------------------------

import { parse } from 'yaml';
import { readFileSync } from 'node:fs';
import { scoreAnswerCase, computeAnswerAggregateMetrics } from './answerScorer.js';
import type {
  AnswerEvalDataset,
  AnswerEvalCase,
  AnswerEvalCaseResult,
  AnswerEvalRunMetadata,
  AnswerEvalReport,
} from './answerTypes.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SCORER_VERSION = '1.0.0';
const DEFAULT_RETRIEVAL_CONFIG_VERSION = '1.0.0';
const DEFAULT_PROMPT_NAME = 'conversation.answer';
const DEFAULT_PROMPT_VERSION = '2.0.0';
const DEFAULT_MODEL_PROVIDER = 'fake';
const DEFAULT_MODEL_NAME = 'fake-v1';

// ---------------------------------------------------------------------------
// Dataset loading
// ---------------------------------------------------------------------------

/**
 * Loads and parses an answer evaluation dataset from a YAML file.
 */
export function loadAnswerDataset(filePath: string): AnswerEvalDataset {
  const raw = readFileSync(filePath, 'utf8');
  const parsed = parse(raw) as unknown;
  if (!parsed || typeof parsed !== 'object') {
    throw new Error(`Invalid answer dataset YAML in ${filePath}: expected an object`);
  }
  const dataset = parsed as Record<string, unknown>;
  if (!dataset['name'] || typeof dataset['name'] !== 'string') {
    throw new Error(`Dataset in ${filePath} is missing string "name"`);
  }
  if (!dataset['version'] || typeof dataset['version'] !== 'string') {
    throw new Error(`Dataset in ${filePath} is missing string "version"`);
  }
  if (!Array.isArray(dataset['cases'])) {
    throw new Error(`Dataset in ${filePath} is missing "cases" array`);
  }

  return {
    name: dataset['name'] as string,
    version: dataset['version'] as string,
    description: typeof dataset['description'] === 'string' ? dataset['description'] : undefined,
    cases: dataset['cases'] as AnswerEvalCase[],
  };
}

// ---------------------------------------------------------------------------
// Run options
// ---------------------------------------------------------------------------

/**
 * Options for running an answer evaluation.
 */
export interface RunAnswerEvalOptions {
  /** Path to the dataset YAML file. */
  readonly datasetPath: string;

  /** Retrieval config version (for metadata; default 1.0.0). */
  readonly retrievalConfigVersion?: string;

  /** Prompt name (default: conversation.answer). */
  readonly promptName?: string;

  /** Prompt version (default: 2.0.0). */
  readonly promptVersion?: string;

  /** Model provider (default: fake). */
  readonly modelProvider?: string;

  /** Model name (default: fake-v1). */
  readonly modelName?: string;
}

// ---------------------------------------------------------------------------
// Main runner
// ---------------------------------------------------------------------------

/**
 * Run a full answer evaluation against a dataset.
 *
 * Returns a complete report (also serializable as JSON for artifact storage).
 */
export function runAnswerEval(options: RunAnswerEvalOptions): AnswerEvalReport {
  const startTime = Date.now();
  const dataset = loadAnswerEvalDataset(options.datasetPath);
  const promptName = options.promptName ?? DEFAULT_PROMPT_NAME;
  const promptVersion = options.promptVersion ?? DEFAULT_PROMPT_VERSION;
  const modelProvider = options.modelProvider ?? DEFAULT_MODEL_PROVIDER;
  const modelName = options.modelName ?? DEFAULT_MODEL_NAME;
  const retrievalConfigVersion = options.retrievalConfigVersion ?? DEFAULT_RETRIEVAL_CONFIG_VERSION;

  const caseResults: AnswerEvalCaseResult[] = [];
  for (const evCase of dataset.cases) {
    const result = scoreAnswerCase(evCase);
    caseResults.push(result);
  }

  const metrics = computeAnswerAggregateMetrics(caseResults);

  const securityPassed = metrics.failedSecurityCases === 0;
  const allPassed = metrics.failedCases === 0;
  // Security-critical cases always fail the command regardless of aggregate score
  const passed = allPassed && securityPassed;

  const metadata: AnswerEvalRunMetadata = {
    dataset: dataset.name,
    datasetVersion: dataset.version,
    scorerVersion: SCORER_VERSION,
    retrievalConfigVersion,
    promptName,
    promptVersion,
    modelProvider,
    modelName,
    nodeVersion: process.version,
    platform: `${process.platform} ${process.arch}`,
    timestamp: new Date().toISOString(),
    totalDurationMs: Date.now() - startTime,
  };

  return {
    metadata,
    metrics,
    cases: caseResults,
    passed,
    securityPassed,
  };
}

/**
 * Internal alias so the runner signature stays clean.
 */
function loadAnswerEvalDataset(filePath: string): AnswerEvalDataset {
  return loadAnswerDataset(filePath);
}
