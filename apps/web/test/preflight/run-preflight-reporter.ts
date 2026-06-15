/**
 * Custom Playwright reporter that emits per-DPC JSON evidence
 * to `.ui-redesign/evidence/preflight/`.
 *
 * Per PIA-MUR-D-016 §6 (Evidence output):
 *   - Per-DPC JSON: dpc-<NN>-<name>.json containing dpcId, result, measuredValues,
 *                   evidencePaths, axeViolations, timestamp.
 *   - Per-DPC PNG:  dpc-<NN>-<name>.png (393x852pt capture).
 *   - Diff PNGs:    dpc-05-diff-<screen>.png (pixelmatch output).
 *   - Axe report:   axe-report.json.
 */
import { Reporter, TestCase, TestResult } from '@playwright/test/reporter';
import * as fs from 'node:fs';
import * as path from 'node:path';

const EVIDENCE_DIR = path.resolve(__dirname, '../../../.ui-redesign/evidence/preflight');

export default class PreflightReporter implements Reporter {
  private results: TestResult[] = [];

  onTestEnd(test: TestCase, result: TestResult) {
    this.results.push(result);
  }

  async onEnd() {
    if (!fs.existsSync(EVIDENCE_DIR)) {
      fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
    }

    for (const result of this.results) {
      const titlePath = result.test.titlePath();
      const dpcId = titlePath[0] ?? 'unknown';
      const safeId = dpcId.toLowerCase().replace(/\s+/g, '-');
      const evidencePath = path.join(EVIDENCE_DIR, `${safeId}.json`);

      const evidence = {
        dpcId,
        result: this.mapStatus(result.status),
        durationMs: result.duration,
        errors: result.errors.map((e) => ({ message: e.message ?? '' })),
        attachments: result.attachments.map((a) => ({
          name: a.name,
          path: a.path ?? null,
        })),
        timestamp: new Date().toISOString(),
        playwrightVersion: require('@playwright/test/package.json').version,
      };

      fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2));
    }
  }

  private mapStatus(s: TestResult['status']): 'PASS' | 'FAIL' | 'BLOCKED' | 'PARTIALLY_VERIFIED' {
    switch (s) {
      case 'passed':
        return 'PASS';
      case 'failed':
      case 'timedOut':
      case 'interrupted':
        return 'FAIL';
      case 'skipped':
        return 'BLOCKED';
      default:
        return 'FAIL';
    }
  }
}
