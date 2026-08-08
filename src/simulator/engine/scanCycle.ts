import type { CompiledLadder } from '@/simulator/types/runtime';
import type { PlcState } from '@/simulator/types/plcState';
import type { CoilMode } from '@/simulator/types/ladder';
import type { InstructionOp } from '@/simulator/types/instruction';
import { evaluateRung } from './evaluateRung';
import { updateTimer } from './timerEngine';
import { updateCounter } from './counterEngine';
import { executeInstruction } from './instructionEngine';
import { deepClone } from '@/simulator/utils/clone';

export interface ScanResult {
  state: PlcState;
  /** elementId -> powered this scan. UI uses this for orange/gray (or
   * green, in live-monitor mode) rendering. */
  poweredElements: Record<string, boolean>;
  durationMs: number;
}

export const DEFAULT_SCAN_INTERVAL_MS = 100;

interface CoilWrite {
  addressType: 'O' | 'M';
  number: number;
  /** Whether the rung powered this coil THIS scan — for a NORMAL coil this
   * directly becomes the new bit value; for SET/RESET it's only a trigger
   * (see applyCoilWrite). */
  poweredIn: boolean;
  mode: CoilMode;
}

interface PendingInstruction {
  elementId: string;
  instruction: InstructionOp;
  poweredIn: boolean;
}

/**
 * Runs exactly one PLC scan cycle. This is a 7-step pipeline that maps
 * directly onto the 8-step description a real PLC scan is usually taught
 * with — "Read Physical Inputs" + "Update Input Memory" collapse into one
 * step here because this is a simulator with no separate physical I/O
 * layer, and "Execute Output Instruction" + "Write Physical Outputs"
 * likewise collapse into one commit step:
 *
 *   1. Read Inputs        — the live input image, frozen for this scan
 *   2. Execute Logic       — solve every rung's power flow against that snapshot
 *   3. Update Timers       — advance TON/TOF/TP accumulators (Phase 5.1: 3 types)
 *   4. Update Counters     — edge-detect and advance CTU/CTD accumulators (Phase 5.1: 2 types)
 *   5. Execute Instructions — run MOV/ADD/CMP/etc Word Memory ops (Phase 5.4)
 *   6. Update Memories     — commit this scan's M coil writes (honors SET/RESET latch)
 *   7. Write Outputs       — commit this scan's O coil writes (honors SET/RESET latch)
 *
 * Steps 3-7 are deliberately deferred until every rung has finished step 2,
 * instead of committing rung-by-rung as we go. Real PLCs update their input
 * and output image tables once per scan for exactly this reason: the result
 * stays independent of rung order, and a coil in Rung 5 can never see a
 * half-updated memory bit that Rung 1 wrote earlier in the *same* scan —
 * every rung reads the *previous* scan's values, consistently. Rungs are
 * still walked top-to-bottom in array order (deterministic, not random or
 * async) — that ordering is what makes SET/RESET writes to the *same*
 * address resolve predictably when more than one rung targets it.
 */
export function runScanCycle(
  compiled: CompiledLadder,
  previousState: PlcState,
  scanIntervalMs: number = DEFAULT_SCAN_INTERVAL_MS
): ScanResult {
  const startedAt = Date.now();

  // Step 1: Read Inputs — previousState.inputs IS this scan's frozen image;
  // we only ever read it below, never mutate it mid-scan.
  const snapshot = previousState;

  // Step 2: Execute Ladder Logic — solve every rung, top to bottom, collect
  // (but do not yet commit) coil writes, timer/counter power-in signals,
  // and edge-detect memory updates.
  const poweredElements: Record<string, boolean> = {};
  const pendingCoilWrites: CoilWrite[] = [];
  const pendingInstructions: PendingInstruction[] = [];
  const timerPowerIn: Record<number, boolean> = {};
  const counterPowerIn: Record<number, boolean> = {};
  const edgeMemoryUpdates: Record<string, boolean> = {};

  for (const rung of compiled.rungs) {
    const result = evaluateRung(rung, snapshot);
    Object.assign(edgeMemoryUpdates, result.edgeMemoryUpdates);

    for (const [id, powered] of result.powered.entries()) {
      poweredElements[id] = powered;
      const element = rung.nodes.get(id)!.element;

      if (element.kind === 'COIL') {
        pendingCoilWrites.push({
          addressType: element.address.type as 'O' | 'M',
          number: element.address.number,
          poweredIn: powered,
          mode: element.coilMode ?? 'NORMAL',
        });
        // Phase 5.4: an instruction-carrying coil ALSO queues its Word
        // Memory instruction — the normal bit write above still happens
        // unchanged, so `address` keeps doubling as an "instruction ran
        // this scan" echo bit exactly like any other coil.
        if (element.instruction) {
          pendingInstructions.push({ elementId: element.id, instruction: element.instruction, poweredIn: powered });
        }
      } else if (element.kind === 'TIMER') {
        timerPowerIn[element.address.number] = powered;
      } else if (element.kind === 'COUNTER') {
        counterPowerIn[element.address.number] = powered;
      }
    }
  }

  // Nothing above this line has mutated state — everything from here works
  // on a fresh copy, so `snapshot` stays a true "previous scan" reference
  // for counter edge-detection and reset-bit reads below.
  const nextState = deepClone(snapshot);

  // Step 3: Update Timers
  for (const rung of compiled.rungs) {
    for (const node of rung.nodes.values()) {
      if (node.element.kind !== 'TIMER') continue;
      const element = node.element;
      const isPowered = timerPowerIn[element.address.number] ?? false;
      nextState.timers[element.address.number] = updateTimer(
        element,
        isPowered,
        previousState.timers[element.address.number],
        scanIntervalMs,
        snapshot
      );
    }
  }

  // Step 4: Update Counters
  for (const rung of compiled.rungs) {
    for (const node of rung.nodes.values()) {
      if (node.element.kind !== 'COUNTER') continue;
      const element = node.element;
      const isPowered = counterPowerIn[element.address.number] ?? false;
      nextState.counters[element.address.number] = updateCounter(
        element,
        isPowered,
        previousState.counters[element.address.number],
        snapshot
      );
    }
  }

  // Step 5: Execute Instructions (Phase 5.4) — run each powered
  // instruction-coil's Word Memory operation against the frozen snapshot's
  // words, exactly once per scan, same discipline as every other step:
  // read the snapshot, collect updates, commit once at the end.
  const wordUpdates: Record<number, number> = {};
  const instructionBitUpdates: Record<number, boolean> = {};
  const instructionLog: PlcState['instructionLog'] = [];
  for (const pending of pendingInstructions) {
    if (!pending.poweredIn) continue;
    const result = executeInstruction(pending.instruction, snapshot.words);
    Object.assign(wordUpdates, result.words);
    Object.assign(instructionBitUpdates, result.bits);
    instructionLog.push({ elementId: pending.elementId, op: pending.instruction.op, error: result.error });
  }

  // Step 6: Update Memories — commit M coil writes, then instruction bit
  // results (CMP), in that order — an instruction's result wins if it
  // happens to target the same address a coil wrote this scan.
  for (const write of pendingCoilWrites) {
    if (write.addressType === 'M') applyCoilWrite(nextState.memory, write);
  }
  Object.assign(nextState.memory, instructionBitUpdates);
  Object.assign(nextState.words, wordUpdates);
  nextState.instructionLog = instructionLog;

  // Step 7: Write Outputs — commit O coil writes only, in rung order.
  for (const write of pendingCoilWrites) {
    if (write.addressType === 'O') applyCoilWrite(nextState.outputs, write);
  }

  // Commit this scan's edge-detect memory (Phase 5) so next scan's
  // RISING_EDGE/FALLING_EDGE contacts have last scan's raw value to compare.
  nextState.edgeMemory = { ...nextState.edgeMemory, ...edgeMemoryUpdates };

  nextState.scanCount = previousState.scanCount + 1;
  nextState.lastScanDurationMs = Date.now() - startedAt;

  return { state: nextState, poweredElements, durationMs: nextState.lastScanDurationMs };
}

/**
 * Applies one coil's result to the target bit table, honoring coilMode:
 *  - NORMAL: the bit simply follows the rung result every scan (Phase 2-4
 *    behavior — a normal coil is never "sticky").
 *  - SET: only ever turns the bit ON (when powered this scan); when not
 *    powered, the bit is left exactly as it was — this is the latch.
 *  - RESET: only ever turns the bit OFF (when powered this scan); when not
 *    powered, likewise left untouched.
 * `bits` here is always a slice of `nextState` (already a clone of the
 * previous scan's committed values), which is what makes "leave untouched"
 * automatically mean "retain last scan's latched value".
 */
function applyCoilWrite(bits: Record<number, boolean>, write: CoilWrite): void {
  switch (write.mode) {
    case 'NORMAL':
      bits[write.number] = write.poweredIn;
      return;
    case 'SET':
      if (write.poweredIn) bits[write.number] = true;
      return;
    case 'RESET':
      if (write.poweredIn) bits[write.number] = false;
      return;
    default: {
      const _exhaustive: never = write.mode;
      return _exhaustive;
    }
  }
}
