import type { LadderElement } from '@/simulator/types/ladder';

// ─── Editor Document Model (Phase 6 rebuild) ─────────────────────────────
// Replaces the old free-form graph+gridX/gridY+drag/connect/branch model.
// A rung is now just: one or more parallel ROWS (each a left-to-right
// series chain of CONTACT/TIMER/COUNTER-as-input elements), all OR'd
// together and feeding a shared set of OUTPUTS (COIL/TIMER/COUNTER) drawn
// in the rightmost column. This is the standard shape every real ladder
// editor (CX-Programmer, GX Works, etc.) uses for the common case, and it
// removes an entire class of bugs (dangling wires, unmatched branches,
// cycle-prone manual connect gestures) by construction — the engine JSON
// (connectsTo graph) is *derived* at export time, never hand-wired.

export interface EditorRow {
  id: string;
  /** Ordered left-to-right. No gaps/nulls — inserting/removing always
   * keeps this contiguous, which is what makes export trivial. */
  cells: string[];
}

export interface EditorRung {
  id: string;
  /** Parallel branches (OR'd together). Always has at least one row. */
  rows: EditorRow[];
  /** COIL/TIMER/COUNTER elements stacked in the output column, all fed by
   * the same rows' OR result. */
  outputs: string[];
  /** All elements used anywhere in this rung (rows + outputs), by id. */
  elements: Record<string, LadderElement>;
}

export interface EditorDocument {
  id: string;
  name: string;
  createdAt: string;
  rungOrder: string[];
  rungs: Record<string, EditorRung>;
}

export type EditorSelection =
  | { kind: 'cell'; rungId: string; rowId: string; index: number }
  | { kind: 'output'; rungId: string; index: number };
