// ---------------------------------------------------------------------------
// Model-run domain types, state machine, and repository
// ---------------------------------------------------------------------------
// Per P3-T04: run states cover STREAMING, COMPLETED, CANCELLED, FAILED, and
// INTERRUPTED. Hidden chain-of-thought is NOT persisted. Concurrent terminal
// transitions are controlled via optimistic status checks.
// ---------------------------------------------------------------------------

import type { Pool } from 'pg';

/**
 * Valid model-run statuses matching the `model_run_status` PostgreSQL enum.
 *
 * State machine:
 *   CREATED -> STREAMING -> COMPLETED | CANCELLED | FAILED | INTERRUPTED
 *
 * COMPLETED, CANCELLED, FAILED, and INTERRUPTED are terminal states.
 */
export type ModelRunStatus =
  | 'CREATED'
  | 'STREAMING'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'FAILED'
  | 'INTERRUPTED';

/**
 * Terminal model-run statuses. No further transitions are allowed from these states.
 */
const TERMINAL_STATUSES: readonly ModelRunStatus[] = [
  'COMPLETED',
  'CANCELLED',
  'FAILED',
  'INTERRUPTED',
];

/**
 * Checks whether a transition from `current` to `next` is valid.
 */
export function isValidModelRunTransition(current: ModelRunStatus, next: ModelRunStatus): boolean {
  const transitions: Record<ModelRunStatus, readonly ModelRunStatus[]> = {
    CREATED: ['STREAMING'],
    STREAMING: ['COMPLETED', 'CANCELLED', 'FAILED', 'INTERRUPTED'],
    COMPLETED: [], // terminal
    CANCELLED: [], // terminal
    FAILED: [], // terminal
    INTERRUPTED: [], // terminal
  };
  return transitions[current]?.includes(next) ?? false;
}

/**
 * Returns true when the status represents a terminal (non-transitionable) state.
 */
export function isTerminalModelRunStatus(status: ModelRunStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

/**
 * A persisted model-run row.
 */
export interface ModelRunRow {
  id: string;
  workspaceId: string;
  conversationId: string;
  userMessageId: string;
  assistantMessageId: string | null;
  status: ModelRunStatus;
  provider: string;
  model: string;
  modelConfiguration: Record<string, unknown>;
  promptName: string;
  promptVersion: string;
  contextManifest: Record<string, unknown>;
  inputTokens: number | null;
  outputTokens: number | null;
  costMicrounits: number | null;
  latencyMs: number | null;
  errorCode: string | null;
  errorSafeMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

/**
 * Input for creating a new model run.
 * `contextManifest` must NOT contain hidden chain-of-thought content.
 */
export interface CreateModelRunInput {
  conversationId: string;
  userMessageId: string;
  provider: string;
  model: string;
  promptName: string;
  promptVersion: string;
  modelConfiguration?: Record<string, unknown>;
  contextManifest?: Record<string, unknown>;
}

/**
 * Transition error thrown when a concurrent or invalid status change is attempted.
 */
export class ModelRunTransitionError extends Error {
  constructor(
    message: string,
    public readonly currentStatus: ModelRunStatus,
    public readonly requestedStatus: ModelRunStatus,
  ) {
    super(message);
    this.name = 'ModelRunTransitionError';
  }
}

/**
 * Creates a new model run in CREATED state.
 */
export async function createModelRun(
  pool: Pool,
  workspaceId: string,
  input: CreateModelRunInput,
): Promise<ModelRunRow> {
  const result = await pool.query<DbModelRun>(
    `INSERT INTO model_runs
       (workspace_id, conversation_id, user_message_id, provider, model,
        model_configuration, prompt_name, prompt_version, context_manifest)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      workspaceId,
      input.conversationId,
      input.userMessageId,
      input.provider,
      input.model,
      JSON.stringify(input.modelConfiguration ?? {}),
      input.promptName,
      input.promptVersion,
      JSON.stringify(input.contextManifest ?? {}),
    ],
  );
  return toModelRunRow(result.rows[0]!);
}

/**
 * Transitions a model run to STREAMING state.
 * Only valid from CREATED.
 */
export async function startStreaming(
  pool: Pool,
  workspaceId: string,
  runId: string,
): Promise<ModelRunRow> {
  const result = await pool.query<DbModelRun>(
    `UPDATE model_runs
     SET status = 'STREAMING', started_at = now()
     WHERE id = $1 AND workspace_id = $2 AND status = 'CREATED'
     RETURNING *`,
    [runId, workspaceId],
  );
  if (result.rows.length === 0) {
    const current = await getModelRun(pool, workspaceId, runId);
    throw new ModelRunTransitionError(
      `Cannot transition to STREAMING: run ${runId} is not in CREATED state (current: ${current?.status ?? 'not found'}).`,
      (current?.status as ModelRunStatus) ?? 'CREATED',
      'STREAMING',
    );
  }
  return toModelRunRow(result.rows[0]!);
}

/**
 * Transitions a model run to a terminal state (COMPLETED, CANCELLED, FAILED, or
 * INTERRUPTED). Uses optimistic concurrency — only succeeds when the current
 * status is STREAMING, CANCELLED, FAILED, or INTERRUPTED.
 *
 * Optimistic concurrency: the `WHERE status = 'STREAMING'` clause prevents
 * two concurrent workers from both transitioning the same run. The caller
 * that gets zero rows back must re-read the current state.
 */
export async function completeModelRun(
  pool: Pool,
  workspaceId: string,
  runId: string,
  options: {
    status: 'COMPLETED' | 'CANCELLED' | 'FAILED' | 'INTERRUPTED';
    assistantMessageId?: string | null;
    inputTokens?: number | null;
    outputTokens?: number | null;
    costMicrounits?: number | null;
    latencyMs?: number | null;
    errorCode?: string | null;
    errorSafeMessage?: string | null;
  },
): Promise<ModelRunRow> {
  if (!isTerminalModelRunStatus(options.status)) {
    throw new ModelRunTransitionError(
      `completeModelRun requires a terminal status, got ${options.status}.`,
      'STREAMING',
      options.status,
    );
  }

  const setClauses: string[] = [`status = '${options.status}'`, 'completed_at = now()'];
  const params: (string | number | null)[] = [runId, workspaceId];
  let paramIdx = 3;

  if (options.assistantMessageId !== undefined) {
    setClauses.push(`assistant_message_id = $${paramIdx}`);
    params.push(options.assistantMessageId);
    paramIdx++;
  }
  if (options.inputTokens !== undefined) {
    setClauses.push(`input_tokens = $${paramIdx}`);
    params.push(options.inputTokens);
    paramIdx++;
  }
  if (options.outputTokens !== undefined) {
    setClauses.push(`output_tokens = $${paramIdx}`);
    params.push(options.outputTokens);
    paramIdx++;
  }
  if (options.costMicrounits !== undefined) {
    setClauses.push(`cost_microunits = $${paramIdx}`);
    params.push(options.costMicrounits);
    paramIdx++;
  }
  if (options.latencyMs !== undefined) {
    setClauses.push(`latency_ms = $${paramIdx}`);
    params.push(options.latencyMs);
    paramIdx++;
  }
  if (options.errorCode !== undefined) {
    setClauses.push(`error_code = $${paramIdx}`);
    params.push(options.errorCode);
    paramIdx++;
  }
  if (options.errorSafeMessage !== undefined) {
    setClauses.push(`error_safe_message = $${paramIdx}`);
    params.push(options.errorSafeMessage);
    paramIdx++;
  }

  const result = await pool.query<DbModelRun>(
    `UPDATE model_runs
     SET ${setClauses.join(', ')}
     WHERE id = $1 AND workspace_id = $2 AND status = 'STREAMING'
     RETURNING *`,
    params,
  );

  if (result.rows.length === 0) {
    const current = await getModelRun(pool, workspaceId, runId);
    throw new ModelRunTransitionError(
      `Cannot complete run ${runId}: expected status STREAMING, got ${current?.status ?? 'not found'}. ` +
        `Concurrent transition may have already completed this run.`,
      (current?.status as ModelRunStatus) ?? 'STREAMING',
      options.status,
    );
  }

  return toModelRunRow(result.rows[0]!);
}

/**
 * Retrieves a single model run by ID, scoped to the given workspace.
 */
export async function getModelRun(
  pool: Pool,
  workspaceId: string,
  runId: string,
): Promise<ModelRunRow | null> {
  const result = await pool.query<DbModelRun>(
    `SELECT * FROM model_runs
     WHERE id = $1 AND workspace_id = $2`,
    [runId, workspaceId],
  );
  if (result.rows.length === 0) return null;
  return toModelRunRow(result.rows[0]!);
}

/**
 * Links a model run to retrieval traces.
 */
export async function linkRetrievalTraces(
  pool: Pool,
  workspaceId: string,
  modelRunId: string,
  retrievalTraceIds: readonly string[],
): Promise<void> {
  if (retrievalTraceIds.length === 0) return;

  // Verify the model run exists in this workspace
  const run = await getModelRun(pool, workspaceId, modelRunId);
  if (!run) {
    throw new Error(`Model run ${modelRunId} not found in workspace ${workspaceId}.`);
  }

  // Build a multi-value INSERT with ON CONFLICT DO NOTHING for idempotency
  const values: string[] = [];
  const params: string[] = [];
  for (let i = 0; i < retrievalTraceIds.length; i++) {
    const offset = i * 2;
    values.push(`($${offset + 1}, $${offset + 2})`);
    params.push(modelRunId, retrievalTraceIds[i]!);
  }

  await pool.query(
    `INSERT INTO model_run_retrieval_traces (model_run_id, retrieval_trace_id)
     VALUES ${values.join(', ')}
     ON CONFLICT DO NOTHING`,
    params,
  );
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

type DbModelRun = {
  id: string;
  workspace_id: string;
  conversation_id: string;
  user_message_id: string;
  assistant_message_id: string | null;
  status: ModelRunStatus;
  provider: string;
  model: string;
  model_configuration: Record<string, unknown>;
  prompt_name: string;
  prompt_version: string;
  context_manifest: Record<string, unknown>;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_microunits: number | null;
  latency_ms: number | null;
  error_code: string | null;
  error_safe_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
};

function toModelRunRow(row: DbModelRun): ModelRunRow {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    conversationId: row.conversation_id,
    userMessageId: row.user_message_id,
    assistantMessageId: row.assistant_message_id,
    status: row.status,
    provider: row.provider,
    model: row.model,
    modelConfiguration: row.model_configuration,
    promptName: row.prompt_name,
    promptVersion: row.prompt_version,
    contextManifest: row.context_manifest,
    // PostgreSQL bigint columns are returned as strings by the pg driver.
    inputTokens: row.input_tokens !== null ? Number(row.input_tokens) : null,
    outputTokens: row.output_tokens !== null ? Number(row.output_tokens) : null,
    costMicrounits: row.cost_microunits !== null ? Number(row.cost_microunits) : null,
    latencyMs: row.latency_ms !== null ? Number(row.latency_ms) : null,
    errorCode: row.error_code,
    errorSafeMessage: row.error_safe_message,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
  };
}
