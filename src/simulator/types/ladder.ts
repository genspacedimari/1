import type { Address } from './address';
export type { Address } from './address';
import type { InstructionOp } from './instruction';

// ─── Ladder JSON Structure ───────────────────────────────────────────────
// Design goals (see src/simulator/ARCHITECTURE.md for the full rationale):
//   1. Series is just a chain of `connectsTo` references.
//   2. Parallel/branch needs NO special data — it falls out automatically
//      when two elements share a predecessor (fan-out) and both feed the
//      same successor (fan-in). BRANCH_START/BRANCH_END exist only as
//      visual markers for a future drag-and-drop editor to know where to
//      draw the branch box; the engine does not require them.
//   3. Every element carries gridX/gridY so a future editor can place and
//      re-place elements without the engine caring about pixel layout.

export type ContactMode = 'NO' | 'NC' | 'RISING_EDGE' | 'FALLING_EDGE';

/** NORMAL follows the rung result every scan (existing/default behavior).
 * SET latches the target bit ON when powered, never turns it off itself.
 * RESET latches the target bit OFF when powered, never turns it on itself. */
export type CoilMode = 'NORMAL' | 'SET' | 'RESET';

interface BaseElement {
  id: string;
  gridX: number;
  gridY: number;
  /** ids of elements this one feeds power into (graph edges). */
  connectsTo: string[];
  /** Phase 5: optional human-readable metadata, editable via the
   * double-click Address dialog. Absent on anything created before this
   * phase — every read site treats missing comment/alias as "". */
  comment?: string;
  alias?: string;
}

export interface ContactElement extends BaseElement {
  kind: 'CONTACT';
  /** NO/NC read a level. RISING_EDGE/FALLING_EDGE read a one-scan transition
   * (Phase 5) — see PlcState.edgeMemory for how that's tracked. */
  mode: ContactMode;
  /** Bit this contact reads. I/M/TIM(.DN)/CTU(.DN)/O are all valid sources. */
  address: Address;
}

export interface CoilElement extends BaseElement {
  kind: 'COIL';
  /** Bit this coil writes. Only O or M are valid targets. Still required
   * even when `instruction` is set (see note below) — it doubles as an
   * "instruction executed this scan" echo bit, following normal coil
   * semantics exactly as before. */
  address: Address;
  /** Defaults to 'NORMAL' when absent — every Phase 2-4 coil JSON without
   * this field keeps behaving exactly as before. */
  coilMode?: CoilMode;
  /**
   * Phase 5.4: when present, this coil ALSO executes a Word Memory
   * instruction (MOV/ADD/CMP/etc — see types/instruction.ts) whenever it's
   * powered, in addition to its normal bit write above. Modeled as a plain
   * data field on the existing COIL kind — deliberately NOT a new
   * LadderElement kind — specifically so evaluateRung.ts (the Logic
   * Engine) needs zero changes: it already treats every COIL identically
   * regardless of what extra data rides along on it. Execution itself
   * happens in engine/scanCycle.ts + engine/instructionEngine.ts, which
   * this phase's brief does NOT list as forbidden to extend.
   */
  instruction?: InstructionOp;
}

export interface TimerElement extends BaseElement {
  kind: 'TIMER';
  /** TON (On-Delay) was the only Phase 2 type. TOF (Off-Delay) and TP
   * (Pulse) are Phase 5.1 additions — see engine/timerEngine.ts. */
  timerType: 'TON' | 'TOF' | 'TP';
  address: Address; // type must be 'TIM'
  presetMs: number;
  /** Phase 5.3: optional bit that, while true, forces the timer's current
   * value and done bit back to 0/false regardless of the enable input —
   * mirrors CounterElement.resetAddress below. */
  resetAddress?: Address;
}

export interface CounterElement extends BaseElement {
  kind: 'COUNTER';
  /** CTU (Count Up) was the only Phase 2 type. CTD (Count Down) is a
   * Phase 5 addition — see engine/counterEngine.ts. */
  counterType: 'CTU' | 'CTD';
  address: Address; // type must be 'CTU'
  presetCount: number;
  /** Optional bit that, while true, forces the counter back to 0/not-done
   * — this is the "RES Counter" instruction from the Phase 5 brief. */
  resetAddress?: Address;
}

export interface WireElement extends BaseElement {
  kind: 'WIRE';
}

/** Visual/editor marker only — see design goal #2 above. */
export interface BranchStartElement extends BaseElement {
  kind: 'BRANCH_START';
  branchId: string;
}

/** Visual/editor marker only — see design goal #2 above. */
export interface BranchEndElement extends BaseElement {
  kind: 'BRANCH_END';
  branchId: string;
}

export interface CommentElement extends Omit<BaseElement, 'connectsTo'> {
  kind: 'COMMENT';
  text: string;
  connectsTo?: string[]; // comments never carry power; kept optional/unused
}

export type LadderElement =
  | ContactElement
  | CoilElement
  | TimerElement
  | CounterElement
  | WireElement
  | BranchStartElement
  | BranchEndElement
  | CommentElement;

export interface Rung {
  id: string;
  /** Element ids wired directly to the left power rail (usually just one). */
  startIds: string[];
  elements: LadderElement[];
}

export interface LadderProject {
  id: string;
  name: string;
  rungs: Rung[];
  meta: {
    createdAt: string;
    updatedAt: string;
    engineVersion: string;
  };
}
