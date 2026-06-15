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
 *
 * Implementation note: Playwright creates one reporter instance per
 * project; instance state is therefore unreliable across projects.
 * We use a JSONL file as a sidecar (one line per onTestEnd call) and
 * collapse to per-DPC JSON in onEnd.
 */
import { Reporter, TestCase, TestResult } from '@playwright/test/reporter';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EVIDENCE_DIR = path.resolve(__dirname, '../../../../.ui-redesign/evidence/preflight');
const INTERIM_FILE = path.join(EVIDENCE_DIR, '.interim-results.jsonl');

export default class PreflightReporter implements Reporter {
  onTestEnd(test: TestCase, result: TestResult) {
    try {
      fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
      fs.appendFileSync(
        INTERIM_FILE,
        JSON.stringify({
          test: { title: test.title, titlePath: test.titlePath() },
          result: {
            status: result.status,
            duration: result.duration,
            errors: result.errors.map((e) => e.message ?? ''),
          },
        }) + '\n',
      );
    } catch {
      // Best-effort; never fail the test run from a reporter
    }
  }

  async onEnd() {
    try {
      fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
      const lines = fs.existsSync(INTERIM_FILE)
        ? fs.readFileSync(INTERIM_FILE, 'utf8').split('\n').filter(Boolean)
        : [];

      interface SubTest {
        title: string;
        status: 'PASS' | 'FAIL' | 'BLOCKED' | 'PARTIALLY_VERIFIED';
        durationMs: number;
        errors: string[];
      }
      interface DpcEvidence {
        dpcId: string;
        result: 'PASS' | 'FAIL' | 'BLOCKED' | 'PARTIALLY_VERIFIED';
        subTests: SubTest[];
        timestamp: string;
      }
      const evidenceByDpc: Record<string, DpcEvidence> = {};
      for (const line of lines) {
        const entry = JSON.parse(line) as {
          test: { title: string; titlePath: string[] };
          result: { status: string; duration: number; errors: string[] };
        };
        // The titlePath structure: ['', '<describe>', '<test title>']
        // The first non-empty element is the describe block name (DPC-N: ...).
        const dpcId = entry.test.titlePath.find((s) => s && s.startsWith('DPC-')) ?? 'unknown';
        // Sanitize: lowercase, replace spaces with hyphens, replace any
        // character that's not [a-z0-9._-] with an underscore.
        const safeId = dpcId
          .toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9._-]/g, '_');
        if (!evidenceByDpc[safeId]) {
          evidenceByDpc[safeId] = {
            dpcId,
            result: 'PASS',
            subTests: [],
            timestamp: new Date().toISOString(),
          };
        }
        const status = this.mapStatus(entry.result.status as TestResult['status']);
        evidenceByDpc[safeId].subTests.push({
          title: entry.test.title,
          status,
          durationMs: entry.result.duration,
          errors: entry.result.errors,
        });
        if (status === 'FAIL') evidenceByDpc[safeId].result = 'FAIL';
      }

      for (const [safeId, evidence] of Object.entries(evidenceByDpc)) {
        fs.writeFileSync(
          path.join(EVIDENCE_DIR, `${safeId}.json`),
          JSON.stringify(evidence, null, 2),
        );
      }

      // Clean up the interim file
      try {
        fs.unlinkSync(INTERIM_FILE);
      } catch {
        // ignore
      }

      console.log(
        `[preflight-reporter] wrote ${Object.keys(evidenceByDpc).length} per-DPC evidence files to ${EVIDENCE_DIR}`,
      );
    } catch (err) {
      console.error(`[preflight-reporter] ERROR:`, err);
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
