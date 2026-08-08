import type { LadderProject } from '@/simulator/types/ladder';
import type { PlcState } from '@/simulator/types/plcState';
import { validateRung, validateProjectAddresses, LadderValidationError } from '@/simulator/parser/validateLadder';

/**
 * Phase 5.5 — Runtime Diagnostics.
 *
 * This module deliberately does NOT re-implement validation. `validateRung`
 * and `validateProjectAddresses` (parser/validateLadder.ts, unmodified —
 * zero lines touched) already catch every structural problem the Phase 5.5
 * brief asks the Debugger to surface: Broken Wire (unreachable/"floating"
 * element), Floating Branch (unmatched BRANCH_START/END), Duplicate
 * Address, Invalid Address, Invalid Timer/Counter (bad preset or address
 * type), Invalid Loop (cycle). The problem this module solves is
 * *presentation*, not detection: the parser is load-time and fail-fast
 * (throws on the FIRST problem it meets, one rung at a time, so
 * `parseLadder()` can hand the engine a guaranteed-clean graph). A Debugger
 * needs the OPPOSITE shape — every problem in the whole project, at once,
 * without ever throwing — so it calls the exact same validators per-rung
 * inside try/catch and collects results instead of stopping at the first.
 *
 * "Dead Branch" and "Memory Overflow" are the two categories from the
 * brief that validateLadder.ts doesn't already name explicitly, so they're
 * added here as their own checks (still without touching the parser):
 *  - Dead Branch: a BRANCH_START/BRANCH_END pair with nothing wired
 *    between them — a branch box a user drew but never filled in, which is
 *    valid-but-pointless rather than structurally broken (so
 *    validateRung's floating-element check doesn't catch it: the branch
 *    markers themselves are still reachable).
 *  - Memory Overflow: the Instruction Engine already reports this live,
 *    per scan, via `PlcState.instructionLog[i].error` containing
 *    "overflow" (see engine/instructionEngine.ts's clampWord) — collected
 *    here by `collectRuntimeDiagnostics`, not re-derived.
 */

export type DiagnosticCategory =
  | 'BROKEN_WIRE'
  | 'FLOATING_BRANCH'
  | 'DUPLICATE_ADDRESS'
  | 'INVALID_ADDRESS'
  | 'INSTRUCTION_ERROR'
  | 'MEMORY_OVERFLOW'
  | 'INVALID_TIMER'
  | 'INVALID_COUNTER'
  | 'DEAD_BRANCH'
  | 'INVALID_LOOP'
  | 'OTHER';

export interface Diagnostic {
  category: DiagnosticCategory;
  message: string;
  rungId?: string;
}

/** Classifies a LadderValidationError's message into a brief-named
 * category by matching the same wording validateLadder.ts already emits —
 * this is presentation-layer text sniffing, not new validation logic. */
function classify(message: string): DiagnosticCategory {
  const m = message.toLowerCase();
  if (m.includes('floating') && m.includes('branch')) return 'FLOATING_BRANCH';
  if (m.includes('no matching branch')) return 'FLOATING_BRANCH';
  if (m.includes('floating')) return 'BROKEN_WIRE';
  if (m.includes('no outgoing connection')) return 'BROKEN_WIRE';
  if (m.includes('unknown element')) return 'BROKEN_WIRE';
  if (m.includes('duplicate address')) return 'DUPLICATE_ADDRESS';
  if (m.includes('written by both')) return 'DUPLICATE_ADDRESS';
  if (m.includes('duplicate element ids') || m.includes('duplicate connection')) return 'DUPLICATE_ADDRESS';
  if (m.includes('invalid loop')) return 'INVALID_LOOP';
  if (m.includes('invalid preset') && m.includes('timer')) return 'INVALID_TIMER';
  if (m.includes('invalid preset') && m.includes('counter')) return 'INVALID_COUNTER';
  if (m.includes('timer') && (m.includes('must be type') || m.includes('invalid address') || m.includes('invalid reset'))) return 'INVALID_TIMER';
  if (m.includes('counter') && (m.includes('must be type') || m.includes('invalid address') || m.includes('invalid reset'))) return 'INVALID_COUNTER';
  if (m.includes('invalid address')) return 'INVALID_ADDRESS';
  return 'OTHER';
}

/** Static analysis: every structural problem in the project, collected
 * (not thrown), by running the real validators rung-by-rung. */
export function runStaticDiagnostics(project: LadderProject): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const rung of project.rungs) {
    try {
      validateRung(rung);
    } catch (err) {
      if (err instanceof LadderValidationError) {
        diagnostics.push({ category: classify(err.message), message: err.message, rungId: rung.id });
      } else {
        throw err;
      }
    }
    diagnostics.push(...findDeadBranches(rung));
  }

  try {
    validateProjectAddresses(project);
  } catch (err) {
    if (err instanceof LadderValidationError) {
      diagnostics.push({ category: classify(err.message), message: err.message });
    } else {
      throw err;
    }
  }

  return diagnostics;
}

/** Dead Branch: a BRANCH_START whose matching BRANCH_END is wired as its
 * immediate, only successor — a branch box with nothing inside it. */
function findDeadBranches(rung: LadderProject['rungs'][number]): Diagnostic[] {
  const out: Diagnostic[] = [];
  const startsByBranch = new Map<string, string>();
  const endsByBranch = new Map<string, string>();
  for (const el of rung.elements) {
    if (el.kind === 'BRANCH_START') startsByBranch.set(el.branchId, el.id);
    if (el.kind === 'BRANCH_END') endsByBranch.set(el.branchId, el.id);
  }
  for (const [branchId, startId] of startsByBranch) {
    const endId = endsByBranch.get(branchId);
    if (!endId) continue; // unmatched pair is already reported as FLOATING_BRANCH
    const startEl = rung.elements.find((e) => e.id === startId);
    if (startEl?.connectsTo?.includes(endId)) {
      out.push({
        category: 'DEAD_BRANCH',
        message: `Rung "${rung.id}" branch "${branchId}" is empty — BRANCH_START connects straight to BRANCH_END with nothing wired inside.`,
        rungId: rung.id,
      });
    }
  }
  return out;
}

/** Live analysis: this scan's Instruction Engine errors (Phase 5.4's
 * `PlcState.instructionLog`), re-surfaced as Debugger diagnostics —
 * "Instruction Error" and "Memory Overflow" (a D-register clamp) both come
 * from here, not re-derived. */
export function collectRuntimeDiagnostics(state: PlcState): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const entry of state.instructionLog) {
    if (!entry.error) continue;
    const category: DiagnosticCategory = entry.error.toLowerCase().includes('overflow')
      ? 'MEMORY_OVERFLOW'
      : 'INSTRUCTION_ERROR';
    out.push({ category, message: `[${entry.op} @ ${entry.elementId}] ${entry.error}` });
  }
  return out;
}
