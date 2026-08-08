export interface TimerState {
  presetMs: number;
  accumulatedMs: number;
  done: boolean;
  /** Tracked so the next scan can tell whether power was just gained/lost. */
  poweredLastScan: boolean;
}

export interface CounterState {
  presetCount: number;
  accumulatedCount: number;
  done: boolean;
  /** Tracked for rising-edge detection on the count input. */
  poweredLastScan: boolean;
}

/**
 * Phase 5.4: one diagnostic entry per instruction-carrying COIL that was
 * powered this scan — this is the data layer behind the brief's "Current
 * Instruction / Instruction Result" live monitor requirement. No UI reads
 * this yet (this phase is logic-only per the brief), but the data is real
 * and rebuilt fresh every scan, ready for a future monitor panel.
 */
export interface InstructionLogEntry {
  elementId: string;
  op: string;
  error: string | null;
}

/**
 * The full I/O + internal state of one simulated PLC, addresses 1-26 for
 * every type. Plain records (not arrays) so `state.inputs[7]` reads exactly
 * like the address it represents ("I7") — no off-by-one indexing.
 */
export interface PlcState {
  inputs: Record<number, boolean>;
  outputs: Record<number, boolean>;
  memory: Record<number, boolean>;
  timers: Record<number, TimerState>;
  counters: Record<number, CounterState>;
  /**
   * Phase 5 addition: one-bit memory per edge-detect CONTACT instance
   * (keyed by that element's id, not its address — matching how real PLC
   * differentiate-up/down instructions each keep independent memory even
   * when watching the same input). Absent for programs that don't use
   * RISING_EDGE/FALLING_EDGE contacts, so existing saved projects are
   * unaffected.
   */
  edgeMemory: Record<string, boolean>;
  /**
   * Phase 5.4: Word Memory, D1-D100 — 16-bit signed integer registers,
   * completely separate from Bit Memory (`memory` above). Every MOV/ADD/
   * SUB/CMP/etc instruction reads and writes here, never `memory` or
   * `inputs`/`outputs` (except CMP's TRUE/FALSE result, which — like a
   * timer/counter Done Bit — is written to an ordinary Bit Memory address
   * so it can be read back by a normal contact).
   */
  words: Record<number, number>;
  /** Phase 5.4 — see InstructionLogEntry above. Rebuilt fresh every scan. */
  instructionLog: InstructionLogEntry[];
  scanCount: number;
  lastScanDurationMs: number;
}

export const ADDRESS_RANGE = Array.from({ length: 26 }, (_, i) => i + 1);
export const WORD_ADDRESS_RANGE = Array.from({ length: 100 }, (_, i) => i + 1);

export function createEmptyState(): PlcState {
  const bits: Record<number, boolean> = {};
  for (const n of ADDRESS_RANGE) bits[n] = false;

  const words: Record<number, number> = {};
  for (const n of WORD_ADDRESS_RANGE) words[n] = 0;

  return {
    inputs: { ...bits },
    outputs: { ...bits },
    memory: { ...bits },
    timers: {},
    counters: {},
    edgeMemory: {},
    words,
    instructionLog: [],
    scanCount: 0,
    lastScanDurationMs: 0,
  };
}
