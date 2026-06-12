// ---------------------------------------------------------------------------
// Evaluation types — portable retrieval evaluation harness (P2-T10)
// ---------------------------------------------------------------------------
// Per docs/07_TEST_EVALUATION_STRATEGY.md#3-ai-evaluation-suites:
//   Metrics: recall@K, precision@K, MRR/nDCG, version correctness,
//   authorization correctness, P50/P95 latency.
//   Security correctness failures always fail the command regardless of
//   aggregate score.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Dataset schema (YAML on-disk format)
// ---------------------------------------------------------------------------

/**
 * A single retrieval evaluation case as stored in YAML.
 *
 * Example:
 * ```yaml
 * id: ret-current-version-001
 * type: retrieval
 * input:
 *   workspace_fixture: alpha
 *   query: current retention policy
 * expected:
 *   must_include_document_versions: [policy-v3]
 *   must_exclude_document_versions: [policy-v1, policy-v2]
 *   max_latency_ms: 1500
 * tags: [retrieval, versioning, regression]
 * ```
 */
export interface EvalCase {
  /** Unique stable identifier for this case. */
  readonly id: string;

  /** Always "retrieval" for this harness. */
  readonly type: 'retrieval';

  /** Input configuration for the retrieval. */
  readonly input: EvalCaseInput;

  /** Expected outcomes (what must or must not appear). */
  readonly expected: EvalCaseExpected;

  /** Optional tags for filtering and categorization. */
  readonly tags?: readonly string[];

  /** Whether this case is security-critical. */
  readonly security_critical?: boolean;
}

/**
 * Input to a single evaluation case.
 */
export interface EvalCaseInput {
  /** Which workspace fixture to use (e.g. "alpha", "ws-security"). */
  readonly workspace_fixture: string;

  /** The natural-language query text. */
  readonly query: string;

  /** Optional project ID fixture name. */
  readonly project_fixture?: string;

  /** Maximum results to retrieve (default 10). */
  readonly max_results?: number;

  /** Whether to include historical (superseded) versions. */
  readonly include_historical?: boolean;

  /** Optional sensitivity filter. */
  readonly sensitivity?: string;

  /** Optional source ID fixture name. */
  readonly source_fixture?: string;
}

/**
 * Expected outcomes for an evaluation case.
 */
export interface EvalCaseExpected {
  /**
   * Document version fixture names that MUST appear in the results.
   * If any of these are missing, the case fails.
   */
  readonly must_include_document_versions?: readonly string[];

  /**
   * Document version fixture names that MUST NOT appear in the results.
   * If any of these appear, the case fails (critical for security).
   */
  readonly must_exclude_document_versions?: readonly string[];

  /**
   * Document fixture names that MUST appear in results.
   */
  readonly must_include_documents?: readonly string[];

  /**
   * Minimum number of distinct document versions expected.
   */
  readonly min_distinct_versions?: number;

  /**
   * Maximum allowable latency in milliseconds.
   */
  readonly max_latency_ms?: number;

  /**
   * Minimum expected recall@K (K = length of must_include_document_versions).
   */
  readonly min_recall?: number;

  /**
   * Minimum expected precision@K.
   */
  readonly min_precision?: number;
}

// ---------------------------------------------------------------------------
// Fixture identifiers (resolved at runtime)
// ---------------------------------------------------------------------------

/**
 * Resolved fixture registry: maps fixture names to actual database IDs.
 */
export interface FixtureRegistry {
  /** Map from workspace fixture name to workspace UUID. */
  readonly workspaces: Record<string, string>;

  /** Map from project fixture name to project UUID. */
  readonly projects: Record<string, string>;

  /** Map from document fixture name to document UUID. */
  readonly documents: Record<string, string>;

  /** Map from document-version fixture name to version UUID. */
  readonly documentVersions: Record<string, string>;

  /** Map from source fixture name to source UUID. */
  readonly sources: Record<string, string>;

  /** Map from user fixture name to user UUID. */
  readonly users: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Per-case result
// ---------------------------------------------------------------------------

/**
 * Result of executing a single evaluation case.
 */
export interface EvalCaseResult {
  /** The case identifier. */
  readonly caseId: string;

  /** Whether this case passed all expectations. */
  readonly passed: boolean;

  /** Whether this is a security-critical case. */
  readonly securityCritical: boolean;

  /** The query that was executed. */
  readonly query: string;

  /** Number of results returned. */
  readonly resultCount: number;

  /** Latency in milliseconds. */
  readonly latencyMs: number;

  /** Document version IDs that appeared in results. */
  readonly retrievedVersionIds: readonly string[];

  /** Document version IDs that should have appeared but did not. */
  readonly missingVersionIds: readonly string[];

  /** Document version IDs that appeared but should not have. */
  readonly unexpectedVersionIds: readonly string[];

  /** Recall@K where K = number of expected versions. */
  readonly recallAtK: number | null;

  /** Precision@K. */
  readonly precisionAtK: number | null;

  /** Mean Reciprocal Rank. */
  readonly mrr: number | null;

  /** Whether the version-inclusion expectations were met. */
  readonly versionCorrectnessPassed: boolean;

  /** Whether authorization (exclusion) expectations were met. */
  readonly authorizationCorrectnessPassed: boolean;

  /** Whether the latency was within the expected bound. */
  readonly latencyPassed: boolean;

  /** Human-readable failure reasons, if any. */
  readonly failures: readonly string[];

  /** Any error that occurred during execution. */
  readonly error: string | undefined;
}

// ---------------------------------------------------------------------------
// Aggregate metrics
// ---------------------------------------------------------------------------

/**
 * Aggregate evaluation metrics computed across all cases.
 */
export interface EvalMetrics {
  /** Total number of cases. */
  readonly totalCases: number;

  /** Number of passed cases. */
  readonly passedCases: number;

  /** Number of failed cases. */
  readonly failedCases: number;

  /** Number of security-critical cases. */
  readonly securityCases: number;

  /** Number of passed security-critical cases. */
  readonly passedSecurityCases: number;

  /** Number of failed security-critical cases. */
  readonly failedSecurityCases: number;

  /** Aggregate recall@K (mean across cases where K > 0). */
  readonly meanRecallAtK: number | null;

  /** Aggregate precision@K (mean across cases). */
  readonly meanPrecisionAtK: number | null;

  /** Aggregate MRR (mean across cases where MRR is computable). */
  readonly meanMRR: number | null;

  /** Version correctness rate (fraction of version expectations met). */
  readonly versionCorrectnessRate: number;

  /** Authorization correctness rate (fraction of exclusion expectations met). */
  readonly authorizationCorrectnessRate: number;

  /** P50 latency in milliseconds. */
  readonly latencyP50Ms: number | null;

  /** P95 latency in milliseconds. */
  readonly latencyP95Ms: number | null;

  /** Mean latency in milliseconds. */
  readonly meanLatencyMs: number | null;
}

// ---------------------------------------------------------------------------
// Evaluation run metadata
// ---------------------------------------------------------------------------

/**
 * Metadata about an evaluation run (persisted in the report).
 */
export interface EvalRunMetadata {
  /** Dataset file path or identifier. */
  readonly dataset: string;

  /** Dataset version (derived from file hash or explicit field). */
  readonly datasetVersion: string;

  /** Scorer implementation version. */
  readonly scorerVersion: string;

  /** Retrieval configuration version used. */
  readonly retrievalConfigVersion: string;

  /** Embedding model used. */
  readonly embeddingModel: string;

  /** Embedding version used. */
  readonly embeddingVersion: string;

  /** Timestamp of the run (ISO 8601). */
  readonly timestamp: string;

  /** Duration of the entire run in milliseconds. */
  readonly totalDurationMs: number;
}

// ---------------------------------------------------------------------------
// Full evaluation report
// ---------------------------------------------------------------------------

/**
 * Complete evaluation report, serializable as JSON for artifact storage.
 */
export interface EvalReport {
  /** Run metadata. */
  readonly metadata: EvalRunMetadata;

  /** Aggregate metrics. */
  readonly metrics: EvalMetrics;

  /** Per-case results. */
  readonly cases: readonly EvalCaseResult[];

  /** Whether the run passed overall (all cases, with security non-negotiable). */
  readonly passed: boolean;

  /** Whether all security-critical cases passed. */
  readonly securityPassed: boolean;
}

// ---------------------------------------------------------------------------
// Dataset on disk
// ---------------------------------------------------------------------------

/**
 * Root YAML document containing evaluation cases and metadata.
 */
export interface EvalDataset {
  /** Human-readable name of the dataset. */
  readonly name: string;

  /** Dataset version. */
  readonly version: string;

  /** Description of the dataset contents and purpose. */
  readonly description: string | undefined;

  /** The evaluation cases. */
  readonly cases: readonly EvalCase[];
}
