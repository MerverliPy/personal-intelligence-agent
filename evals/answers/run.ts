#!/usr/bin/env tsx
// ---------------------------------------------------------------------------
// Answer evaluation CLI (P3-T10)
// ---------------------------------------------------------------------------
// Usage: pnpm eval:answers [--dataset <path> ...] [--report <path>]
//
// Runs grounded-answer evaluation against one or more YAML datasets,
// scores each case deterministically, and prints a report that records
// the dataset version, scorer version, prompt name+version, model
// provider+name, retrieval config version, and runtime versions.
//
// Exit codes:
//   0 — all cases passed (including all security-critical cases)
//   1 — one or more cases failed (non-security)
//   2 — security-critical case(s) failed (always non-zero regardless of score)
// ---------------------------------------------------------------------------

import { resolve, dirname, basename, join } from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';
import { runAnswerEval, type RunAnswerEvalOptions } from '@pia/evals';
import type { AnswerEvalReport } from '@pia/evals';

// ---------------------------------------------------------------------------
// Default datasets
// ---------------------------------------------------------------------------

const DEFAULT_DATASETS = [
  resolve(import.meta.dirname ?? __dirname, 'datasets', 'sample.yaml'),
  resolve(import.meta.dirname ?? __dirname, 'datasets', 'security.yaml'),
  resolve(import.meta.dirname ?? __dirname, 'datasets', 'insufficient-evidence.yaml'),
  resolve(import.meta.dirname ?? __dirname, 'datasets', 'conflicting-sources.yaml'),
];

// ---------------------------------------------------------------------------
// Report formatting
// ---------------------------------------------------------------------------

function printReport(report: AnswerEvalReport, datasetName: string): void {
  const { metadata, metrics, cases } = report;
  const line = '─'.repeat(72);

  console.log(`\n${line}`);
  console.log(`  Answer Evaluation Report: ${datasetName}`);
  console.log(`${line}`);
  console.log(`  Dataset version:        ${metadata.datasetVersion}`);
  console.log(`  Scorer version:         ${metadata.scorerVersion}`);
  console.log(`  Prompt:                 ${metadata.promptName}@${metadata.promptVersion}`);
  console.log(`  Model:                  ${metadata.modelProvider}/${metadata.modelName}`);
  console.log(`  Retrieval config:       ${metadata.retrievalConfigVersion}`);
  console.log(`  Node:                   ${metadata.nodeVersion}`);
  console.log(`  Platform:               ${metadata.platform}`);
  console.log(`  Duration:               ${metadata.totalDurationMs}ms`);
  console.log(`  Timestamp:              ${metadata.timestamp}`);

  console.log(`\n${line}`);
  console.log(`  Aggregate Metrics`);
  console.log(`${line}`);
  console.log(`  Total cases:               ${metrics.totalCases}`);
  console.log(`  Passed:                    ${metrics.passedCases}`);
  console.log(`  Failed:                    ${metrics.failedCases}`);
  console.log(`  Security cases:            ${metrics.securityCases}`);
  console.log(`  Security passed:           ${metrics.passedSecurityCases}`);
  console.log(`  Security failed:           ${metrics.failedSecurityCases}`);
  console.log(`  Citation validity rate:    ${(metrics.citationValidityRate * 100).toFixed(1)}%`);
  console.log(`  Groundedness rate:         ${(metrics.groundednessRate * 100).toFixed(1)}%`);
  console.log(`  Refusal behavior rate:     ${(metrics.refusalBehaviorRate * 100).toFixed(1)}%`);
  console.log(`  Conflict disclosure rate:  ${(metrics.conflictDisclosureRate * 100).toFixed(1)}%`);
  console.log(`  Keyword coverage rate:     ${(metrics.keywordCoverageRate * 100).toFixed(1)}%`);
  console.log(
    `  Prompt-injection safe:     ${(metrics.promptInjectionSafeRate * 100).toFixed(1)}%`,
  );
  console.log(`  Total citations:           ${metrics.totalCitations}`);
  console.log(`  Fabricated citations:      ${metrics.fabricatedCitations}`);
  console.log(`  Fabricated source rate:    ${(metrics.fabricatedSourceRate * 100).toFixed(1)}%`);

  console.log(`\n${line}`);
  console.log(`  Per-Case Results`);
  console.log(`${line}`);

  for (const c of cases) {
    const icon = c.passed ? '✓' : '✗';
    const secTag = c.securityCritical ? ' [SECURITY]' : '';
    console.log(`  ${icon} ${c.caseId}${secTag}`);
    if (!c.passed) {
      for (const f of c.failures) {
        console.log(`    → FAIL: ${f}`);
      }
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

function printSummary(reports: readonly AnswerEvalReport[]): void {
  console.log(`\n${'═'.repeat(72)}`);
  console.log(`  OVERALL SUMMARY`);
  console.log(`${'═'.repeat(72)}`);

  const totalCases = reports.reduce((sum, r) => sum + r.metrics.totalCases, 0);
  const totalFailed = reports.reduce((sum, r) => sum + r.metrics.failedCases, 0);
  const totalSecFailed = reports.reduce((sum, r) => sum + r.metrics.failedSecurityCases, 0);
  const totalFabricated = reports.reduce((sum, r) => sum + r.metrics.fabricatedCitations, 0);
  const totalCitations = reports.reduce((sum, r) => sum + r.metrics.totalCitations, 0);
  const overallFabricatedRate = totalCitations > 0 ? totalFabricated / totalCitations : 0;

  console.log(`  Total cases evaluated:     ${totalCases}`);
  console.log(`  Total failed:              ${totalFailed}`);
  console.log(`  Security failures:         ${totalSecFailed}`);
  console.log(`  Total citations:           ${totalCitations}`);
  console.log(`  Fabricated citations:      ${totalFabricated}`);
  console.log(`  Overall fabricated rate:   ${(overallFabricatedRate * 100).toFixed(2)}%`);

  if (totalSecFailed > 0) {
    console.log(`\n  ⛔ SECURITY-CRITICAL FAILURES DETECTED`);
    console.log(`  Evaluation FAILED regardless of aggregate score.`);
  } else if (totalFailed > 0) {
    console.log(`\n  ⚠ Non-security failures detected.`);
  } else {
    console.log(`\n  ✅ All cases passed.`);
  }
  console.log(`${'═'.repeat(72)}\n`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  let datasetPaths: string[] = DEFAULT_DATASETS;
  let reportPath: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dataset' && i + 1 < args.length) {
      if (datasetPaths === DEFAULT_DATASETS) datasetPaths = [];
      datasetPaths.push(resolve(args[++i]!));
    } else if (args[i] === '--report' && i + 1 < args.length) {
      reportPath = resolve(args[++i]!);
    }
  }

  const reports: AnswerEvalReport[] = [];
  let totalSecFailures = 0;

  for (const datasetPath of datasetPaths) {
    console.log(`Running answer evaluation: ${datasetPath}`);
    try {
      const options: RunAnswerEvalOptions = { datasetPath };
      const report = runAnswerEval(options);
      printReport(report, datasetPath);
      reports.push(report);
      totalSecFailures += report.metrics.failedSecurityCases;
    } catch (err) {
      console.error(
        `ERROR running ${datasetPath}:`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  printSummary(reports);

  // Write JSON report if requested
  if (reportPath) {
    mkdirSync(dirname(reportPath), { recursive: true });
    writeFileSync(
      reportPath,
      JSON.stringify(
        {
          datasets: datasetPaths.map((p) => basename(p)),
          reports,
          overall: {
            totalCases: reports.reduce((s, r) => s + r.metrics.totalCases, 0),
            totalFailed: reports.reduce((s, r) => s + r.metrics.failedCases, 0),
            totalSecFailed,
          },
        },
        null,
        2,
      ),
    );
    console.log(`Report written to: ${reportPath}`);
  }

  const anyFailed = reports.some((r) => !r.passed);
  if (totalSecFailures > 0 || anyFailed) {
    process.exit(totalSecFailures > 0 ? 2 : 1);
  }
}

main().catch((err) => {
  console.error('Fatal evaluation error:', err);
  process.exit(2);
});
