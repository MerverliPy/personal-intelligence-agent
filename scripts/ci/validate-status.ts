#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

interface TaskDef {
  id: string;
  phase: string;
  depends_on?: string[];
  required_reviewers?: string[];
}

interface PhaseDef {
  id: string;
  gate: string;
}

interface GateDef {
  id: string;
  phase: string;
  depends_on?: string[];
}

interface Backlog {
  phases: PhaseDef[];
  tasks: TaskDef[];
  gates: GateDef[];
}

interface Status {
  tasks: Record<string, string>;
  gates: Record<string, string>;
  phases: Record<string, string>;
}

type ErrorType =
  | 'schema'
  | 'dependency'
  | 'task-review'
  | 'reviewer-evidence'
  | 'gate-review'
  | 'phase';

interface ValidationError {
  type: ErrorType;
  item: string;
  message: string;
}

const FINAL_TASK_STATES = new Set(['DONE', 'NO_CHANGE_REQUIRED']);
const TASK_STATES = new Set([
  'NOT_STARTED',
  'IN_PROGRESS',
  'DONE',
  'NO_CHANGE_REQUIRED',
  'BLOCKED',
  'FAILED_VERIFICATION',
]);
const PHASE_STATES = new Set(['NOT_STARTED', 'IN_PROGRESS', 'DONE', 'BLOCKED']);
const GATE_STATES = new Set(['NOT_STARTED', 'IN_PROGRESS', 'DONE', 'BLOCKED', 'FAILED_VERIFICATION']);
const REVIEW_RESULTS = new Set(['PASS', 'FAIL', 'UNAVAILABLE']);
const REQUIRED_GATE_EVIDENCE = [
  'all_required_task_reviews',
  'exit_criteria',
  'required_checks',
  'status_consistency',
] as const;

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..', '..');

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be a mapping`);
  }
  return value as Record<string, unknown>;
}

function asStringRecord(value: unknown, label: string): Record<string, string> {
  const record = asRecord(value, label);
  const result: Record<string, string> = {};
  for (const [key, item] of Object.entries(record)) {
    if (typeof item !== 'string') {
      throw new Error(`${label}.${key} must be a string`);
    }
    result[key] = item;
  }
  return result;
}

function loadBacklog(): Backlog {
  const text = readFileSync(resolve(rootDir, 'planning', 'backlog.yaml'), 'utf-8');
  const parsed = asRecord(parseYaml(text), 'backlog');
  return {
    phases: (parsed['phases'] as PhaseDef[] | undefined) ?? [],
    tasks: (parsed['tasks'] as TaskDef[] | undefined) ?? [],
    gates: (parsed['gates'] as GateDef[] | undefined) ?? [],
  };
}

function loadStatus(): Status {
  const text = readFileSync(resolve(rootDir, 'planning', 'status.yaml'), 'utf-8');
  const parsed = asRecord(parseYaml(text), 'status');
  return {
    tasks: asStringRecord(parsed['tasks'] ?? {}, 'status.tasks'),
    gates: asStringRecord(parsed['gates'] ?? {}, 'status.gates'),
    phases: asStringRecord(parsed['phases'] ?? {}, 'status.phases'),
  };
}

function duplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const duplicateValues = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicateValues.add(value);
    seen.add(value);
  }
  return [...duplicateValues].sort();
}

function validateIdentifierSet(
  label: string,
  expected: string[],
  actual: Record<string, string>,
  errors: ValidationError[],
): void {
  const expectedSet = new Set(expected);
  for (const id of expected) {
    if (!(id in actual)) {
      errors.push({ type: 'schema', item: id, message: `${label} is missing ${id}.` });
    }
  }
  for (const id of Object.keys(actual)) {
    if (!expectedSet.has(id)) {
      errors.push({ type: 'schema', item: id, message: `${label} contains unknown identifier ${id}.` });
    }
  }
}

function validateStateValues(
  label: string,
  states: Record<string, string>,
  allowed: Set<string>,
  errors: ValidationError[],
): void {
  for (const [id, state] of Object.entries(states)) {
    if (!allowed.has(state)) {
      errors.push({
        type: 'schema',
        item: id,
        message: `${label}.${id} has invalid state '${state}'. Allowed: ${[...allowed].join(', ')}.`,
      });
    }
  }
}

function extractSection(markdown: string, heading: string): string | undefined {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === `## ${heading}`);
  if (start < 0) return undefined;

  const nextHeadingOffset = lines.slice(start + 1).findIndex((line) => line.startsWith('## '));
  const end = nextHeadingOffset < 0 ? lines.length : start + 1 + nextHeadingOffset;
  return lines.slice(start + 1, end).join('\n').trim();
}

function extractSingleVerdict(markdown: string): string | undefined {
  const matches = [...markdown.matchAll(/^## Verdict:\s*([A-Z_]+)\s*$/gm)].map((match) => match[1]);
  return matches.length === 1 ? matches[0] : undefined;
}

function parseEvidenceLines(section: string | undefined): Map<string, string> {
  const evidence = new Map<string, string>();
  if (section === undefined) return evidence;
  for (const match of section.matchAll(/^-\s+([a-z][a-z0-9_-]*):\s+(PASS|FAIL|UNAVAILABLE)\s*$/gm)) {
    const name = match[1];
    const result = match[2];
    if (name !== undefined && result !== undefined && !evidence.has(name)) {
      evidence.set(name, result);
    }
  }
  return evidence;
}

function readReview(relativePath: string): string | undefined {
  const path = resolve(rootDir, relativePath);
  return existsSync(path) ? readFileSync(path, 'utf-8') : undefined;
}

function validateTaskReview(task: TaskDef, errors: ValidationError[]): void {
  const relativePath = `planning/reviews/${task.id}.md`;
  const markdown = readReview(relativePath);
  if (markdown === undefined) {
    errors.push({
      type: 'task-review',
      item: task.id,
      message: `Final task ${task.id} has no review record at ${relativePath}.`,
    });
    return;
  }

  const verdict = extractSingleVerdict(markdown);
  if (verdict !== 'PASS') {
    errors.push({
      type: 'task-review',
      item: task.id,
      message: `Final task ${task.id} requires exactly one '## Verdict: PASS'; found ${verdict ?? 'missing or multiple verdicts'}.`,
    });
  }

  const evidence = parseEvidenceLines(extractSection(markdown, 'Required Reviewer Evidence'));
  const requiredReviewers = task.required_reviewers ?? [];
  for (const reviewer of requiredReviewers) {
    const result = evidence.get(reviewer);
    if (result !== 'PASS') {
      errors.push({
        type: 'reviewer-evidence',
        item: task.id,
        message: `Final task ${task.id} requires structured PASS evidence for reviewer '${reviewer}'; found ${result ?? 'missing'}.`,
      });
    }
  }

  for (const [reviewer, result] of evidence) {
    if (!REVIEW_RESULTS.has(result)) {
      errors.push({
        type: 'reviewer-evidence',
        item: task.id,
        message: `Task ${task.id} has invalid reviewer result '${result}' for '${reviewer}'.`,
      });
    }
    if (!requiredReviewers.includes(reviewer)) {
      errors.push({
        type: 'reviewer-evidence',
        item: task.id,
        message: `Task ${task.id} contains reviewer evidence for unrequired role '${reviewer}'.`,
      });
    }
  }
}

function validateGateReview(gate: GateDef, errors: ValidationError[]): void {
  const relativePath = `planning/reviews/${gate.id}.md`;
  const markdown = readReview(relativePath);
  if (markdown === undefined) {
    errors.push({
      type: 'gate-review',
      item: gate.id,
      message: `DONE gate ${gate.id} has no gate review at ${relativePath}.`,
    });
    return;
  }

  const verdict = extractSingleVerdict(markdown);
  if (verdict !== 'PASS') {
    errors.push({
      type: 'gate-review',
      item: gate.id,
      message: `DONE gate ${gate.id} requires exactly one '## Verdict: PASS'; found ${verdict ?? 'missing or multiple verdicts'}.`,
    });
  }

  const evidence = parseEvidenceLines(extractSection(markdown, 'Gate Evidence'));
  for (const name of REQUIRED_GATE_EVIDENCE) {
    const result = evidence.get(name);
    if (result !== 'PASS') {
      errors.push({
        type: 'gate-review',
        item: gate.id,
        message: `DONE gate ${gate.id} requires '${name}: PASS' in Gate Evidence; found ${result ?? 'missing'}.`,
      });
    }
  }
}

function validate(backlog: Backlog, status: Status): ValidationError[] {
  const errors: ValidationError[] = [];
  const taskIds = backlog.tasks.map((task) => task.id);
  const phaseIds = backlog.phases.map((phase) => phase.id);
  const gateIds = backlog.gates.map((gate) => gate.id);

  for (const [label, ids] of [
    ['task', taskIds],
    ['phase', phaseIds],
    ['gate', gateIds],
  ] as const) {
    for (const id of duplicates(ids)) {
      errors.push({ type: 'schema', item: id, message: `Backlog contains duplicate ${label} identifier ${id}.` });
    }
  }

  validateIdentifierSet('status.tasks', taskIds, status.tasks, errors);
  validateIdentifierSet('status.phases', phaseIds, status.phases, errors);
  validateIdentifierSet('status.gates', gateIds, status.gates, errors);
  validateStateValues('status.tasks', status.tasks, TASK_STATES, errors);
  validateStateValues('status.phases', status.phases, PHASE_STATES, errors);
  validateStateValues('status.gates', status.gates, GATE_STATES, errors);

  for (const task of backlog.tasks) {
    const state = status.tasks[task.id];
    if (state === undefined || !FINAL_TASK_STATES.has(state)) continue;

    for (const dependencyId of task.depends_on ?? []) {
      const dependencyState = status.tasks[dependencyId] ?? status.gates[dependencyId];
      if (dependencyState === undefined || !FINAL_TASK_STATES.has(dependencyState)) {
        errors.push({
          type: 'dependency',
          item: task.id,
          message: `Final task ${task.id} depends on ${dependencyId}, which is ${dependencyState ?? 'missing'} instead of DONE or NO_CHANGE_REQUIRED.`,
        });
      }
    }
    validateTaskReview(task, errors);
  }

  for (const gate of backlog.gates) {
    const gateState = status.gates[gate.id];
    const phaseState = status.phases[gate.phase];

    if (phaseState === 'DONE' && gateState !== 'DONE') {
      errors.push({
        type: 'phase',
        item: gate.phase,
        message: `Phase ${gate.phase} is DONE but gate ${gate.id} is ${gateState ?? 'missing'}.`,
      });
    }
    if (gateState !== 'DONE') continue;

    if (phaseState !== 'DONE') {
      errors.push({
        type: 'phase',
        item: gate.phase,
        message: `Gate ${gate.id} is DONE but phase ${gate.phase} is ${phaseState ?? 'missing'}.`,
      });
    }

    const phaseTasks = backlog.tasks.filter((task) => task.phase === gate.phase);
    for (const task of phaseTasks) {
      const taskState = status.tasks[task.id];
      if (taskState === undefined || !FINAL_TASK_STATES.has(taskState)) {
        errors.push({
          type: 'dependency',
          item: gate.id,
          message: `DONE gate ${gate.id} includes task ${task.id} in state ${taskState ?? 'missing'}.`,
        });
      }
    }
    validateGateReview(gate, errors);
  }

  return errors;
}

function main(): void {
  let backlog: Backlog;
  let status: Status;

  try {
    backlog = loadBacklog();
    status = loadStatus();
  } catch (error) {
    console.error('Failed to parse planning files:', error instanceof Error ? error.message : error);
    process.exit(2);
  }

  const errors = validate(backlog, status);
  if (errors.length > 0) {
    console.error(`\n❌ Transition validation FAILED: ${errors.length} error(s)\n`);
    for (const error of errors) {
      console.error(`  [${error.type}] ${error.message}`);
    }
    console.error();
    process.exit(1);
  }

  console.log(
    `✅ Transition validation PASSED (${backlog.tasks.length} tasks, ${backlog.phases.length} phases, ${backlog.gates.length} gates checked)`,
  );
}

main();
