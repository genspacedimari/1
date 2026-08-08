import type { Rung, LadderProject } from '@/simulator/types/ladder';
import { isValidAddressNumber } from '@/simulator/models/addressRanges';

export class LadderValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LadderValidationError';
  }
}

const TERMINAL_KINDS = new Set(['COIL', 'TIMER', 'COUNTER']);
const ADDRESSED_KINDS = new Set(['CONTACT', 'COIL', 'TIMER', 'COUNTER']);

/**
 * Structural + semantic checks run once, at load time, so the engine can
 * assume a well-formed graph on every scan afterward (no re-validating 100
 * times a second).
 */
export function validateRung(rung: Rung): void {
  const ids = new Set(rung.elements.map((el) => el.id));

  if (ids.size !== rung.elements.length) {
    throw new LadderValidationError(`Rung "${rung.id}" has duplicate element ids.`);
  }

  for (const startId of rung.startIds) {
    if (!ids.has(startId)) {
      throw new LadderValidationError(
        `Rung "${rung.id}" startIds references unknown element "${startId}".`
      );
    }
  }

  const referenced = new Set<string>(); // every id that appears as *someone's* connectsTo target
  const branchStartIds = new Map<string, string>(); // branchId -> element id
  const branchEndIds = new Map<string, string>();

  for (const el of rung.elements) {
    const connections = el.connectsTo ?? [];

    // Phase 5.2: catch a duplicate entry within one element's own
    // connectsTo array (e.g. [x, x]) — almost always a copy/paste bug, and
    // harmless-but-confusing if left in (the OR-merge logic tolerates it,
    // but it should never legitimately happen).
    if (new Set(connections).size !== connections.length) {
      throw new LadderValidationError(
        `Rung "${rung.id}" element "${el.id}" has a duplicate connection to the same target.`
      );
    }

    for (const targetId of connections) {
      if (!ids.has(targetId)) {
        throw new LadderValidationError(
          `Rung "${rung.id}" element "${el.id}" connects to unknown element "${targetId}".`
        );
      }
      referenced.add(targetId);
    }

    if (el.kind === 'BRANCH_START') branchStartIds.set(el.branchId, el.id);
    if (el.kind === 'BRANCH_END') branchEndIds.set(el.branchId, el.id);

    if (el.kind === 'COMMENT') continue;

    // A non-terminal element with nowhere to go is a dead end — very likely
    // an unfinished edit rather than intentional, so we fail loudly.
    if (!TERMINAL_KINDS.has(el.kind) && connections.length === 0) {
      throw new LadderValidationError(
        `Rung "${rung.id}" element "${el.id}" (${el.kind}) has no outgoing connection.`
      );
    }

    if (ADDRESSED_KINDS.has(el.kind)) {
      const address = (el as { address?: { number: number } }).address;
      if (!address || !isValidAddressNumber(address.number)) {
        throw new LadderValidationError(
          `Rung "${rung.id}" element "${el.id}" has an invalid address.`
        );
      }
    }

    if (el.kind === 'COIL' && el.address.type !== 'O' && el.address.type !== 'M') {
      throw new LadderValidationError(
        `Rung "${rung.id}" coil "${el.id}" must target address type O or M, got "${el.address.type}".`
      );
    }

    if (el.kind === 'TIMER' && el.address.type !== 'TIM') {
      throw new LadderValidationError(
        `Rung "${rung.id}" timer "${el.id}" address must be type TIM, got "${el.address.type}".`
      );
    }

    if (el.kind === 'COUNTER' && el.address.type !== 'CTU') {
      throw new LadderValidationError(
        `Rung "${rung.id}" counter "${el.id}" address must be type CTU, got "${el.address.type}".`
      );
    }

    // Phase 5.3: "Invalid Preset" — a timer/counter that can never reach
    // its own Done Bit (preset <= 0) is a configuration mistake, not a
    // valid instruction.
    if (el.kind === 'TIMER' && !(el.presetMs > 0)) {
      throw new LadderValidationError(
        `Rung "${rung.id}" timer "${el.id}" has an invalid preset (${el.presetMs}ms) — preset must be greater than 0.`
      );
    }
    if (el.kind === 'COUNTER' && !(el.presetCount > 0)) {
      throw new LadderValidationError(
        `Rung "${rung.id}" counter "${el.id}" has an invalid preset (${el.presetCount}) — preset must be greater than 0.`
      );
    }

    // Phase 5.3: "Invalid Reference" — a Reset input only ever makes sense
    // wired to a physical Input or an Internal Memory bit; pointing it at
    // an Output/Timer/Counter address would silently never fire (see
    // engine/resetBit.ts's fallback), so it's rejected here instead of
    // failing quietly at runtime.
    if ((el.kind === 'TIMER' || el.kind === 'COUNTER') && el.resetAddress) {
      const { type, number } = el.resetAddress;
      if (type !== 'I' && type !== 'M') {
        throw new LadderValidationError(
          `Rung "${rung.id}" ${el.kind === 'TIMER' ? 'timer' : 'counter'} "${el.id}" has an invalid reset reference: reset must read an Input or Memory bit, got type "${type}".`
        );
      }
      if (!isValidAddressNumber(number)) {
        throw new LadderValidationError(
          `Rung "${rung.id}" ${el.kind === 'TIMER' ? 'timer' : 'counter'} "${el.id}" reset reference has an invalid address number (${number}).`
        );
      }
    }
  }

  if (rung.startIds.length === 0) {
    throw new LadderValidationError(`Rung "${rung.id}" has no startIds — nothing connects to the left rail.`);
  }

  // Phase 5.2: "Floating Wire" / unreachable-island detection — every
  // non-comment element must either be wired straight to the left rail
  // (startIds) or be the target of at least one connection. Anything else
  // is a disconnected fragment that can never carry power.
  const startIdSet = new Set(rung.startIds);
  for (const el of rung.elements) {
    if (el.kind === 'COMMENT') continue;
    if (!startIdSet.has(el.id) && !referenced.has(el.id)) {
      throw new LadderValidationError(
        `Rung "${rung.id}" element "${el.id}" (${el.kind}) is floating — it's not wired to the left rail and nothing connects to it.`
      );
    }
  }

  // Phase 5.2: "Floating Branch" — a BRANCH_START/BRANCH_END must come in a
  // matched pair sharing the same branchId within one rung, or the branch
  // box a future editor draws around them has no real other side.
  for (const [branchId, elementId] of branchStartIds) {
    if (!branchEndIds.has(branchId)) {
      throw new LadderValidationError(
        `Rung "${rung.id}" BRANCH_START "${elementId}" (branch "${branchId}") has no matching BRANCH_END.`
      );
    }
  }
  for (const [branchId, elementId] of branchEndIds) {
    if (!branchStartIds.has(branchId)) {
      throw new LadderValidationError(
        `Rung "${rung.id}" BRANCH_END "${elementId}" (branch "${branchId}") has no matching BRANCH_START.`
      );
    }
  }

  // Phase 5.2: "Invalid Loop" — catch a cycle at load time rather than
  // waiting for the engine to hit it mid-scan (evaluateRung.ts already
  // throws defensively if this slipped through, but failing here means the
  // editor's exportToLadderJson surfaces it as a normal validation error
  // instead of a Run-time crash).
  detectCycle(rung);
}

/** Static DFS cycle check over the whole rung graph (as opposed to
 * evaluateRung's lazy, memoized version which only walks nodes it actually
 * needs to evaluate for a given scan). */
function detectCycle(rung: Rung): void {
  const bySource = new Map<string, string[]>();
  for (const el of rung.elements) bySource.set(el.id, el.connectsTo ?? []);

  const visited = new Set<string>();
  const inStack = new Set<string>();

  function visit(id: string): void {
    if (inStack.has(id)) {
      throw new LadderValidationError(`Rung "${rung.id}" contains an invalid loop at element "${id}".`);
    }
    if (visited.has(id)) return;
    visited.add(id);
    inStack.add(id);
    for (const next of bySource.get(id) ?? []) visit(next);
    inStack.delete(id);
  }

  for (const el of rung.elements) visit(el.id);
}

interface CoilWriters {
  normal: string[];
  setOrReset: string[];
}

/**
 * Phase 5 addition: checks address ownership across the WHOLE project —
 * validateRung() above only ever sees one rung at a time, but "duplicate
 * address" is inherently a cross-rung concern (e.g. two separate Timer
 * blocks both claiming TIM3, or two NORMAL coils in different rungs both
 * writing O0 and silently fighting over it every scan).
 *
 * Multiple SET/RESET coils sharing one address is the NORMAL, correct way
 * to write a self-holding/latching circuit (SET in one rung, RESET in
 * another) — only NORMAL-vs-NORMAL and NORMAL-vs-SET/RESET on the same
 * address are flagged, since a NORMAL coil unconditionally overwrites the
 * bit every scan and would fight with either.
 */
export function validateProjectAddresses(project: LadderProject): void {
  const timerOwners = new Map<number, string>();
  const counterOwners = new Map<number, string>();
  const outputCoilWriters = new Map<number, CoilWriters>();
  const memoryCoilWriters = new Map<number, CoilWriters>();

  for (const rung of project.rungs) {
    for (const el of rung.elements) {
      if (el.kind === 'TIMER') {
        const n = el.address.number;
        const existing = timerOwners.get(n);
        if (existing && existing !== el.id) {
          throw new LadderValidationError(
            `Duplicate address TIM${n}: used by both "${existing}" and "${el.id}". Each timer address can only back one Timer block.`
          );
        }
        timerOwners.set(n, el.id);
      }

      if (el.kind === 'COUNTER') {
        const n = el.address.number;
        const existing = counterOwners.get(n);
        if (existing && existing !== el.id) {
          throw new LadderValidationError(
            `Duplicate address CTU${n}: used by both "${existing}" and "${el.id}". Each counter address can only back one Counter block.`
          );
        }
        counterOwners.set(n, el.id);
      }

      if (el.kind === 'COIL' && (el.address.type === 'O' || el.address.type === 'M')) {
        const map = el.address.type === 'O' ? outputCoilWriters : memoryCoilWriters;
        const n = el.address.number;
        const entry = map.get(n) ?? { normal: [], setOrReset: [] };
        if ((el.coilMode ?? 'NORMAL') === 'NORMAL') entry.normal.push(el.id);
        else entry.setOrReset.push(el.id);
        map.set(n, entry);
      }
    }
  }

  const checkCoilMap = (map: Map<number, CoilWriters>, prefix: 'O' | 'M') => {
    for (const [n, entry] of map.entries()) {
      if (entry.normal.length > 1) {
        throw new LadderValidationError(
          `Duplicate address ${prefix}${n}: ${entry.normal.length} NORMAL coils target it (${entry.normal.join(', ')}). Each scan, whichever rung runs last silently overwrites the others — use SET/RESET coils if multiple rungs should share control of this output.`
        );
      }
      if (entry.normal.length === 1 && entry.setOrReset.length > 0) {
        throw new LadderValidationError(
          `Address ${prefix}${n} is written by both a NORMAL coil and a SET/RESET coil — mixing these on the same address gives unpredictable results.`
        );
      }
    }
  };

  checkCoilMap(outputCoilWriters, 'O');
  checkCoilMap(memoryCoilWriters, 'M');
}
