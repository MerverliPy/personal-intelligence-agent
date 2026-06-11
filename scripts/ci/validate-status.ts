#!/usr/bin/env node

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

interface Backlog {
  phases: PhaseDef[];
  tasks: TaskDef[];
}

interface Status {
  tasks: Record<string, string>;
  gates: Record<string, string>;
  phases: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..', '..');

function loadBacklog(): Backlog {
  const text = readFileSync(resolve(rootDir, 'planning', 'backlog.yaml'), 'utf-8');
  const parsed = parseYaml(text) as Record<string, unknown>;

  return {
    phases: (parsed['phases'] as PhaseDef[]) ?? [],
    tasks: (parsed['tasks'] as TaskDef[]) ?? [],
  };
}

function loadStatus(): Status {
  const text = readFileSync(resolve(rootDir, 'planning', 'status.yaml'), 'utf-8');
  const parsed = parseYaml(text) as Record<string, unknown>;

  return {
    tasks: (parsed['tasks'] as Record<string, string>) ?? {},
    gates: (parsed['gates'] as Record<string, string>) ?? {},
    phases: (parsed['phases'] as Record<string, string>) ?? {},
  };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

interface ValidationError {
  type: 'dependency' | 'reviewer' | 'gate';
  item: string;
  message: string;
}

function validate(backlog: Backlog, status: Status): ValidationError[] {
  const errors: ValidationError[] = [];
  const taskMap = new Map(backlog.tasks.map((t) => [t.id, t]));
  const reviewsDir = resolve(rootDir, 'planning', 'reviews');

  const reviewsExist = existsSync(reviewsDir);
  const reviewFiles = reviewsExist ? new Set(readdirSync(reviewsDir)) : new Set<string>();

  // 1. Check that DONE tasks have all dependencies DONE or NO_CHANGE_REQUIRED
  for (const task of backlog.tasks) {
    const state = status.tasks[task.id];
    if (state !== 'DONE') continue;

    const deps = task.depends_on ?? [];
    for (const depId of deps) {
      // Dependencies can be tasks or gates — resolve from the correct map.
      const depState = status.tasks[depId] ?? status.gates[depId];
      if (depState !== 'DONE' && depState !== 'NO_CHANGE_REQUIRED') {
        errors.push({
          type: 'dependency',
          item: task.id,
          message: `Task ${task.id} is DONE but depends on ${depId} which is ${depState ?? 'NOT_STARTED'}. Dependencies must be DONE or NO_CHANGE_REQUIRED.`,
        });
      }
    }
  }

  // 2. Check that DONE tasks have reviewer sign-off records
  for (const task of backlog.tasks) {
    const state = status.tasks[task.id];
    if (state !== 'DONE') continue;

    const requiredReviewers = task.required_reviewers ?? [];
    for (const reviewer of requiredReviewers) {
      const reviewFilePath = `${task.id}.md`;
      if (!reviewFiles.has(reviewFilePath)) {
        errors.push({
          type: 'reviewer',
          item: task.id,
          message: `Task ${task.id} is DONE but no review record found for reviewer '${reviewer}'. Expected: planning/reviews/${task.id}.md`,
        });
      }
    }
  }

  // 3. Check that PASS gates have all phase tasks DONE or NO_CHANGE_REQUIRED
  for (const [gateId, gateState] of Object.entries(status.gates)) {
    if (gateState !== 'DONE') continue;

    const phase = backlog.phases.find((p) => p.gate === gateId);
    if (!phase) continue;

    const phaseTasks = backlog.tasks.filter((t) => t.phase === phase.id);
    for (const task of phaseTasks) {
      const taskState = status.tasks[task.id];
      if (taskState !== 'DONE' && taskState !== 'NO_CHANGE_REQUIRED') {
        errors.push({
          type: 'gate',
          item: gateId,
          message: `Gate ${gateId} is DONE but phase task ${task.id} is ${taskState ?? 'NOT_STARTED'}. All phase tasks must be DONE or NO_CHANGE_REQUIRED.`,
        });
      }
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  let backlog: Backlog;
  let status: Status;

  try {
    backlog = loadBacklog();
    status = loadStatus();
  } catch (err) {
    console.error('Failed to parse planning files:', err instanceof Error ? err.message : err);
    process.exit(2);
  }

  const errors = validate(backlog, status);

  if (errors.length > 0) {
    console.error(`\n❌ Transition validation FAILED: ${errors.length} error(s)\n`);
    for (const err of errors) {
      console.error(`  [${err.type}] ${err.message}`);
    }
    console.error();
    process.exit(1);
  }

  console.log(
    `✅ Transition validation PASSED (${backlog.tasks.length} tasks, ${backlog.phases.length} phases checked)`,
  );
  process.exit(0);
}

main();
