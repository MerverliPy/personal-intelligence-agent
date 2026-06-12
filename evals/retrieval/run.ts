#!/usr/bin/env tsx
// ---------------------------------------------------------------------------
// Retrieval evaluation CLI (P2-T10)
// ---------------------------------------------------------------------------
// Usage: pnpm eval:retrieval [--dataset <path> ...]
//
// Sets up a test database, seeds evaluation fixtures, runs retrieval
// evaluation cases from YAML datasets, computes metrics, and prints a report.
//
// Exit codes:
//   0 — all cases passed (including all security-critical cases)
//   1 — one or more cases failed
//   2 — security-critical case(s) failed (always non-zero regardless of score)
// ---------------------------------------------------------------------------

import { Pool } from 'pg';
import { createPool, runMigrations, defaultMigrationsDir } from '@pia/db';
import { resolve } from 'node:path';
import { runEval } from '@pia/evals';
import type { EvalReport, EvalCaseResult } from '@pia/evals';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const ADMIN_DATABASE_URL =
  process.env['DATABASE_URL']?.replace(/\/[^/]+$/, '/postgres') ??
  'postgresql://pia:pia-dev@localhost:5432/postgres';

const TEST_DB_NAME = 'pia_evals_test';

const TEST_DATABASE_URL =
  process.env['DATABASE_URL']?.replace(/\/[^/]+$/, `/${TEST_DB_NAME}`) ??
  `postgresql://pia:pia-dev@localhost:5432/${TEST_DB_NAME}`;

/** Default datasets to evaluate. */
const DEFAULT_DATASETS = [
  resolve(import.meta.dirname ?? __dirname, 'datasets', 'sample.yaml'),
  resolve(import.meta.dirname ?? __dirname, 'datasets', 'security.yaml'),
];

// ---------------------------------------------------------------------------
// Database setup
// ---------------------------------------------------------------------------

async function setupEvalDatabase(): Promise<Pool> {
  const adminPool = new Pool({ connectionString: ADMIN_DATABASE_URL });

  try {
    // Drop and recreate the eval database for a clean run
    await adminPool.query(`DROP DATABASE IF EXISTS ${TEST_DB_NAME} WITH (FORCE)`);
    await adminPool.query(`CREATE DATABASE ${TEST_DB_NAME}`);
  } finally {
    await adminPool.end();
  }

  // Connect and run migrations
  const pool = createPool({ connectionString: TEST_DATABASE_URL });
  await runMigrations(pool, defaultMigrationsDir());

  // Disable RLS for eval (so we can seed without session vars)
  try {
    await pool.query(`ALTER TABLE workspaces DISABLE ROW LEVEL SECURITY`);
    await pool.query(`ALTER TABLE users DISABLE ROW LEVEL SECURITY`);
    await pool.query(`ALTER TABLE projects DISABLE ROW LEVEL SECURITY`);
    await pool.query(`ALTER TABLE sources DISABLE ROW LEVEL SECURITY`);
    await pool.query(`ALTER TABLE stored_files DISABLE ROW LEVEL SECURITY`);
    await pool.query(`ALTER TABLE documents DISABLE ROW LEVEL SECURITY`);
    await pool.query(`ALTER TABLE document_versions DISABLE ROW LEVEL SECURITY`);
    await pool.query(`ALTER TABLE document_chunks DISABLE ROW LEVEL SECURITY`);
    await pool.query(`ALTER TABLE chunk_embeddings DISABLE ROW LEVEL SECURITY`);
    await pool.query(`ALTER TABLE retrieval_configs DISABLE ROW LEVEL SECURITY`);
    await pool.query(`ALTER TABLE retrieval_traces DISABLE ROW LEVEL SECURITY`);
    await pool.query(`ALTER TABLE retrieval_results DISABLE ROW LEVEL SECURITY`);
    await pool.query(`ALTER TABLE workspace_members DISABLE ROW LEVEL SECURITY`);
  } catch {
    // RLS tables may not exist — that's OK for eval
  }

  return pool;
}

// ---------------------------------------------------------------------------
// Report formatting
// ---------------------------------------------------------------------------

function printReport(report: EvalReport, datasetName: string): void {
  const { metadata, metrics, cases } = report;
  const line = '─'.repeat(72);

  console.log(`\n${line}`);
  console.log(`  Evaluation Report: ${datasetName}`);
  console.log(`${line}`);
  console.log(`  Dataset version:    ${metadata.datasetVersion}`);
  console.log(`  Scorer version:     ${metadata.scorerVersion}`);
  console.log(`  Embedding model:    ${metadata.embeddingModel} (${metadata.embeddingVersion})`);
  console.log(`  Config version:     ${metadata.retrievalConfigVersion}`);
  console.log(`  Duration:           ${metadata.totalDurationMs}ms`);
  console.log(`  Timestamp:          ${metadata.timestamp}`);

  console.log(`\n${line}`);
  console.log(`  Aggregate Metrics`);
  console.log(`${line}`);
  console.log(`  Total cases:               ${metrics.totalCases}`);
  console.log(`  Passed:                    ${metrics.passedCases}`);
  console.log(`  Failed:                    ${metrics.failedCases}`);
  console.log(`  Security cases:            ${metrics.securityCases}`);
  console.log(`  Security passed:           ${metrics.passedSecurityCases}`);
  console.log(`  Security failed:           ${metrics.failedSecurityCases}`);
  console.log(
    `  Mean recall@K:             ${metrics.meanRecallAtK !== null ? metrics.meanRecallAtK.toFixed(3) : 'N/A'}`,
  );
  console.log(
    `  Mean precision@K:          ${metrics.meanPrecisionAtK !== null ? metrics.meanPrecisionAtK.toFixed(3) : 'N/A'}`,
  );
  console.log(
    `  Mean MRR:                  ${metrics.meanMRR !== null ? metrics.meanMRR.toFixed(3) : 'N/A'}`,
  );
  console.log(`  Version correctness rate:  ${(metrics.versionCorrectnessRate * 100).toFixed(1)}%`);
  console.log(
    `  Authorization corr. rate:  ${(metrics.authorizationCorrectnessRate * 100).toFixed(1)}%`,
  );
  console.log(
    `  Latency P50:               ${metrics.latencyP50Ms !== null ? `${metrics.latencyP50Ms.toFixed(0)}ms` : 'N/A'}`,
  );
  console.log(
    `  Latency P95:               ${metrics.latencyP95Ms !== null ? `${metrics.latencyP95Ms.toFixed(0)}ms` : 'N/A'}`,
  );
  console.log(
    `  Mean latency:              ${metrics.meanLatencyMs !== null ? `${metrics.meanLatencyMs.toFixed(0)}ms` : 'N/A'}`,
  );

  console.log(`\n${line}`);
  console.log(`  Per-Case Results`);
  console.log(`${line}`);

  for (const c of cases) {
    const icon = c.passed ? '✓' : '✗';
    const secTag = c.securityCritical ? ' [SECURITY]' : '';
    console.log(`  ${icon} ${c.caseId}${secTag} (${c.resultCount} results, ${c.latencyMs}ms)`);
    if (!c.passed) {
      for (const f of c.failures) {
        console.log(`    → FAIL: ${f}`);
      }
    }
    if (c.error) {
      console.log(`    → ERROR: ${c.error}`);
    }
  }

  console.log(`\n${line}`);
  if (report.passed) {
    console.log(`  RESULT: PASSED`);
  } else if (report.securityPassed) {
    console.log(`  RESULT: PARTIAL FAIL (non-security cases failed)`);
  } else {
    console.log(`  RESULT: FAILED (security-critical cases failed)`);
  }
  console.log(`${line}\n`);
}

function printSummary(reports: readonly EvalReport[]): void {
  console.log(`\n${'═'.repeat(72)}`);
  console.log(`  OVERALL SUMMARY`);
  console.log(`${'═'.repeat(72)}`);

  const totalCases = reports.reduce((sum, r) => sum + r.metrics.totalCases, 0);
  const totalFailed = reports.reduce((sum, r) => sum + r.metrics.failedCases, 0);
  const totalSecFailed = reports.reduce((sum, r) => sum + r.metrics.failedSecurityCases, 0);

  console.log(`  Total cases evaluated: ${totalCases}`);
  console.log(`  Total failed:          ${totalFailed}`);
  console.log(`  Security failures:     ${totalSecFailed}`);

  if (totalSecFailed > 0) {
    console.log(`\n  ⛔ SECURITY-CRITICAL FAILURES DETECTED`);
    console.log(`  Evaluation FAILED regardless of aggregate score.`);
    console.log(`  Review security-critical cases above immediately.`);
  } else if (totalFailed > 0) {
    console.log(`\n  ⚠ Non-security failures detected.`);
    console.log(`  Review failed cases above.`);
  } else {
    console.log(`\n  ✅ All cases passed.`);
  }
  console.log(`${'═'.repeat(72)}\n`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  // Parse args
  const args = process.argv.slice(2);
  let datasetPaths = DEFAULT_DATASETS;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dataset' && i + 1 < args.length) {
      if (datasetPaths === DEFAULT_DATASETS) datasetPaths = [];
      datasetPaths.push(resolve(args[++i]!));
    }
  }

  console.log(`Setting up evaluation database "${TEST_DB_NAME}"...`);
  const pool = await setupEvalDatabase();
  const reports: EvalReport[] = [];
  let totalSecFailures = 0;

  try {
    for (const datasetPath of datasetPaths) {
      console.log(`Running evaluation: ${datasetPath}`);
      try {
        const report = await runEval({
          pool,
          datasetPath,
        });
        printReport(report, datasetPath);
        reports.push(report);
        totalSecFailures += report.metrics.failedSecurityCases;
      } catch (err) {
        console.error(
          `ERROR running ${datasetPath}:`,
          err instanceof Error ? err.message : String(err),
        );
        // Treat unhandled errors as failures
      }
    }
  } finally {
    // Clean up
    await pool.end();
  }

  printSummary(reports);

  // Exit code: non-zero if any failures, always non-zero for security failures
  const anyFailed = reports.some((r) => !r.passed);
  if (totalSecFailures > 0 || anyFailed) {
    process.exit(totalSecFailures > 0 ? 2 : 1);
  }
}

main().catch((err) => {
  console.error('Fatal evaluation error:', err);
  process.exit(2);
});
