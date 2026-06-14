// ---------------------------------------------------------------------------
// Answer evaluation types — portable grounded-answer harness (P3-T10)
// ---------------------------------------------------------------------------
// Per docs/07_TEST_EVALUATION_STRATEGY.md#3-ai-evaluation-suites (grounded-
// answer suite):
//   - answer correctness against reference or rubric
//   - claim support by retrieved evidence
//   - citation completeness and validity
//   - conflict disclosure
//   - uncertainty behavior when evidence is absent
//   - instruction adherence
//   - fabricated-source rate = 0
//
// This harness is a deterministic scoring layer over pre-generated claimed
// answers. The model-driven eval is scheduled for P6-T01; P3-T10 establishes
// the scoring contracts and a portable dataset format.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Dataset schema (YAML on-disk format)
// ---------------------------------------------------------------------------

/**
 * A single answer evaluation case as stored in YAML.
 *
 * The `claimed_answer` represents the model output that the scorer evaluates.
 * In a production run, this would be the streamed assistant text + parsed
 * citations. In this harness, both are fixtures so the scorers are
 * deterministic and reviewable.
 *
 * Example:
 * ```yaml
 * id: ans-grounded-001
 * type: answer
 * input:
 *   query: "What is the retention policy?"
 *   workspace_fixture: alpha
 *   model_output_provider: fake
 *   model_output_model: fake-v1
 *   model_output_prompt: conversation.answer@2.0.0
 * evidence_chunks:
 *   - id: chunk-policy-1
 *     content: "Records are kept for 7 years."
 *     document_version_id: policy-v3
 * claimed_answer:
 *   text: "Records are kept for 7 years. [chunk-policy-1]"
 *   citations:
 *     - chunk_id: chunk-policy-1
 *       document_version_id: policy-v3
 * expected:
 *   must_include_citations: [chunk-policy-1]
 *   must_not_include_citations: []
 *   must_be_refusal: false
 *   must_disclose_conflict: false
 *   must_mention_keywords: [7 years]
 *   forbidden_keywords: ["I don't have", "insufficient"]
 * tags: [answer, grounded, baseline]
 * ```
 */
export interface AnswerEvalCase {
  /** Unique stable identifier for this case. */
  readonly id: string;

  /** Always "answer" for this harness. */
  readonly type: 'answer';

  /** Input configuration for the case. */
  readonly input: AnswerEvalCaseInput;

  /** Evidence chunks the model was given (fixture). */
  readonly evidence_chunks: readonly AnswerEvidenceChunk[];

  /** The model output under test (fixture). */
  readonly claimed_answer: ClaimedAnswer;

  /** Expected properties for scoring. */
  readonly expected: AnswerEvalCaseExpected;

  /** Optional tags for filtering. */
  readonly tags?: readonly string[];

  /** Security-critical: failures block the run regardless of aggregate score. */
  readonly security_critical?: boolean;
}

/**
 * Input to a single answer evaluation case.
 */
export interface AnswerEvalCaseInput {
  /** The natural-language query. */
  readonly query: string;

  /** Which workspace fixture to use. */
  readonly workspace_fixture: string;

  /** Model provider that produced the claimed answer (for provenance). */
  readonly model_output_provider: string;

  /** Model identifier (for provenance). */
  readonly model_output_model: string;

  /** Prompt name@version used to produce the answer (for provenance). */
  readonly model_output_prompt: string;
}

/**
 * A single evidence chunk as it was provided to the model.
 */
export interface AnswerEvidenceChunk {
  /** Stable chunk ID referenced by citations. */
  readonly id: string;

  /** Chunk text content. */
  readonly content: string;

  /** Document version ID this chunk belongs to. */
  readonly document_version_id: string;
}

/**
 * The claimed model output under test.
 */
export interface ClaimedAnswer {
  /** The full answer text (with citation markers like `[chunk-id]`). */
  readonly text: string;

  /** Citations parsed from the answer. */
  readonly citations: readonly ClaimedCitation[];
}

/**
 * A single citation as parsed from the claimed answer.
 */
export interface ClaimedCitation {
  /** The cited chunk ID. */
  readonly chunk_id: string;

  /** The cited document version ID. */
  readonly document_version_id: string;

  /** Optional claim span (start/end indices into the text). */
  readonly claim_start?: number;
  readonly claim_end?: number;

  /** Optional claim text (the substring being cited). */
  readonly claim_text?: string;
}

/**
 * Expected properties for a single evaluation case.
 */
export interface AnswerEvalCaseExpected {
  /** Chunk IDs whose citations MUST appear in the claimed answer. */
  readonly must_include_citations?: readonly string[];

  /** Chunk IDs that MUST NOT appear as citations (fabricated source test). */
  readonly must_not_include_citations?: readonly string[];

  /** Whether the answer is required to be a refusal (insufficient evidence). */
  readonly must_be_refusal?: boolean;

  /** Whether the answer must disclose a conflict between sources. */
  readonly must_disclose_conflict?: boolean;

  /** Substrings that must appear in the answer text (case-insensitive). */
  readonly must_mention_keywords?: readonly string[];

  /** Substrings that must NOT appear in the answer text. */
  readonly forbidden_keywords?: readonly string[];

  /** Minimum number of distinct evidence chunks cited. */
  readonly min_citations?: number;

  /** Maximum allowable answer length in characters. */
  readonly max_answer_length?: number;

  /** Whether citation must equal one of the must_include chunks (zero-tolerance on fabricated). */
  readonly zero_tolerance_on_fabricated?: boolean;
}

// ---------------------------------------------------------------------------
// Per-case result
// ---------------------------------------------------------------------------

/**
 * Result of executing a single answer evaluation case.
 */
export interface AnswerEvalCaseResult {
  /** The case identifier. */
  readonly caseId: string;

  /** Whether this case passed all expectations. */
  readonly passed: boolean;

  /** Security-critical flag. */
  readonly securityCritical: boolean;

  /** Number of citations claimed in the answer. */
  readonly citationCount: number;

  /** Number of citations that resolved to evidence chunks. */
  readonly resolvedCitationCount: number;

  /** Number of citations that did NOT resolve to evidence chunks (fabricated). */
  readonly fabricatedCitationCount: number;

  /** Whether every citation resolved to a real evidence chunk. */
  readonly citationValidityPassed: boolean;

  /** Whether the answer text is grounded in the cited evidence. */
  readonly groundednessPassed: boolean;

  /** Whether the refusal-vs-answer behavior is correct. */
  readonly refusalBehaviorPassed: boolean;

  /** Whether the conflict disclosure expectation is met. */
  readonly conflictDisclosurePassed: boolean;

  /** Whether keyword expectations are met. */
  readonly keywordCoveragePassed: boolean;

  /** Whether the answer contains prompt-injection-like text. */
  readonly promptInjectionSafe: boolean;

  /** Whether every must-include citation is present. */
  readonly requiredCitationsPresent: boolean;

  /** Whether every must-exclude citation is absent. */
  readonly fabricatedCitationsAbsent: boolean;

  /** Human-readable failure reasons, if any. */
  readonly failures: readonly string[];

  /** Any error during execution. */
  readonly error: string | undefined;
}

// ---------------------------------------------------------------------------
// Aggregate metrics
// ---------------------------------------------------------------------------

/**
 * Aggregate metrics for an answer evaluation run.
 */
export interface AnswerEvalMetrics {
  readonly totalCases: number;
  readonly passedCases: number;
  readonly failedCases: number;
  readonly securityCases: number;
  readonly passedSecurityCases: number;
  readonly failedSecurityCases: number;
  readonly totalCitations: number;
  readonly fabricatedCitations: number;
  readonly fabricatedSourceRate: number;
  readonly groundednessRate: number;
  readonly refusalBehaviorRate: number;
  readonly conflictDisclosureRate: number;
  readonly keywordCoverageRate: number;
  readonly promptInjectionSafeRate: number;
  readonly citationValidityRate: number;
}

// ---------------------------------------------------------------------------
// Run metadata (persisted in the report)
// ---------------------------------------------------------------------------

/**
 * Metadata about an answer evaluation run.
 */
export interface AnswerEvalRunMetadata {
  readonly dataset: string;
  readonly datasetVersion: string;
  readonly scorerVersion: string;
  readonly retrievalConfigVersion: string;
  readonly promptName: string;
  readonly promptVersion: string;
  readonly modelProvider: string;
  readonly modelName: string;
  readonly nodeVersion: string;
  readonly platform: string;
  readonly timestamp: string;
  readonly totalDurationMs: number;
}

// ---------------------------------------------------------------------------
// Full report
// ---------------------------------------------------------------------------

/**
 * Complete answer evaluation report, serializable as JSON for artifact storage.
 */
export interface AnswerEvalReport {
  readonly metadata: AnswerEvalRunMetadata;
  readonly metrics: AnswerEvalMetrics;
  readonly cases: readonly AnswerEvalCaseResult[];
  readonly passed: boolean;
  readonly securityPassed: boolean;
}

// ---------------------------------------------------------------------------
// Dataset on disk
// ---------------------------------------------------------------------------

/**
 * Root YAML document containing answer evaluation cases and metadata.
 */
export interface AnswerEvalDataset {
  readonly name: string;
  readonly version: string;
  readonly description: string | undefined;
  readonly cases: readonly AnswerEvalCase[];
}
