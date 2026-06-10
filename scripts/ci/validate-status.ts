#!/usr/bin/env node

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

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
  return parseSimpleYaml(text) as unknown as Backlog;
}

function loadStatus(): Status {
  const text = readFileSync(resolve(rootDir, 'planning', 'status.yaml'), 'utf-8');
  const parsed = parseSimpleYaml(text) as Record<string, unknown>;

  return {
    tasks: (parsed['tasks'] as Record<string, string>) ?? {},
    gates: (parsed['gates'] as Record<string, string>) ?? {},
    phases: (parsed['phases'] as Record<string, string>) ?? {},
  };
}

/**
 * Minimal YAML parser sufficient for the flat structure of backlog.yaml
 * and status.yaml. Does not handle complex YAML; only flat key: value and
 * simple sequences.
 */
function parseSimpleYaml(text: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  let currentSection: string | null = null;
  let currentSectionObj: Record<string, unknown> = {};

  for (const line of text.split('\n')) {
    const trimmed = line.trimEnd();

    // Skip empty and comment lines
    if (trimmed.length === 0 || trimmed.startsWith('#')) continue;

    // Top-level mapping
    const topMatch = trimmed.match(/^(\w[\w_-]*):\s*(.*)$/);
    if (topMatch && !trimmed.startsWith(' ')) {
      const key = topMatch[1]!;
      const value = topMatch[2]!.trim();

      if (key === 'tasks' || key === 'gates') {
        currentSection = key;
        currentSectionObj = {};
      } else if (key === 'phases') {
        currentSection = key;
        currentSectionObj = {};
      } else {
        result[key] = value || undefined;
      }
      continue;
    }

    // Indented key: value (inside current section)
    const indentMatch = trimmed.match(/^  (\w[\w_-]*):\s*(.*)$/);
    if (indentMatch && currentSection) {
      const key = indentMatch[1]!;
      const value = indentMatch[2]!.trim();
      currentSectionObj[key] = value || undefined;
      continue;
    }

    // Sequence items (- id: P0-T01)
    const seqMatch = trimmed.match(/^\s*-\s*id:\s*(.*)$/);
    if (seqMatch && currentSection === 'tasks') {
      // Read the next few lines for task properties
      continue;
    }
  }

  if (currentSection) {
    result[currentSection] = currentSectionObj;
  }

  return result;
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
  const phaseMap = new Map(backlog.phases.map((p) => [p.id, p]));
  const reviewsDir = resolve(rootDir, 'planning', 'reviews');

  const reviewsExist = existsSync(reviewsDir);
  const reviewFiles = reviewsExist ? new Set(readdirSync(reviewsDir)) : new Set<string>();

  // 1. Check that DONE tasks have all dependencies DONE or NO_CHANGE_REQUIRED
  for (const task of backlog.tasks) {
    const state = status.tasks[task.id];
    if (state !== 'DONE') continue;

    const deps = task.depends_on ?? [];
    for (const depId of deps) {
      const depState = status.tasks[depId];
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
      // Look for a review file matching the task ID
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

    // Find the phase for this gate
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

  console.log('✅ Transition validation PASSED');
  process.exit(0);
}

main();
