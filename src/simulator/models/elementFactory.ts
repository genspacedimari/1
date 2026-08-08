import { generateId } from '@/simulator/utils/id';
import type {
  Address,
  ContactElement,
  CoilElement,
  TimerElement,
  CounterElement,
  WireElement,
  BranchStartElement,
  BranchEndElement,
  CommentElement,
  ContactMode,
  CoilMode,
} from '@/simulator/types/ladder';
import type { InstructionOp } from '@/simulator/types/instruction';

// Factory helpers so a future drag-and-drop editor never hand-builds the
// LadderElement union directly — it calls one of these, gets sane defaults
// (id, empty connectsTo, grid position), and wires up connectsTo afterward.

interface Placement {
  gridX: number;
  gridY: number;
}

export function createContact(address: Address, mode: ContactMode, at: Placement): ContactElement {
  return { id: generateId('contact'), kind: 'CONTACT', mode, address, connectsTo: [], ...at };
}

/** `coilMode` defaults to 'NORMAL' (unchanged Phase 2-4 behavior) when omitted. */
export function createCoil(address: Address, at: Placement, coilMode: CoilMode = 'NORMAL'): CoilElement {
  return { id: generateId('coil'), kind: 'COIL', address, coilMode, connectsTo: [], ...at };
}

/**
 * Phase 5.4: a coil that also executes a Word Memory instruction (MOV/ADD/
 * CMP/etc) when powered. `address` is still a real O/M bit — see the note
 * on `CoilElement.instruction` in types/ladder.ts for why (it doubles as
 * an "instruction ran this scan" echo, and keeping every coil addressed
 * the same way is what let this feature skip touching evaluateRung.ts
 * entirely).
 */
export function createInstructionCoil(address: Address, instruction: InstructionOp, at: Placement): CoilElement {
  return { id: generateId('coil'), kind: 'COIL', address, coilMode: 'NORMAL', instruction, connectsTo: [], ...at };
}

/**
 * Phase 5.4: Omron's KEEP (SR flip-flop) instruction, expressed as the two
 * ordinary SET/RESET coils that already produce identical behavior (see
 * PHASE5_4.md for the verification proving this). Not a new engine
 * primitive — just a convenience so a caller doesn't have to know that
 * fact to get a KEEP block. The two coils are usually placed in different
 * rungs (one gated by the Set condition, one by the Reset condition); this
 * helper only builds the elements; wiring their `connectsTo` is up to the
 * caller, same as every other factory function here.
 */
export function createKeepPair(
  address: Address,
  setAt: Placement,
  resetAt: Placement
): { setCoil: CoilElement; resetCoil: CoilElement } {
  return {
    setCoil: createCoil(address, setAt, 'SET'),
    resetCoil: createCoil(address, resetAt, 'RESET'),
  };
}

/** `timerType` defaults to 'TON', the only type Phase 2 supported. */
export function createTimer(
  address: Address,
  presetMs: number,
  at: Placement,
  timerType: TimerElement['timerType'] = 'TON',
  resetAddress?: Address
): TimerElement {
  return {
    id: generateId('timer'),
    kind: 'TIMER',
    timerType,
    address,
    presetMs,
    resetAddress,
    connectsTo: [],
    ...at,
  };
}

export function createCounter(
  address: Address,
  presetCount: number,
  at: Placement,
  resetAddress?: Address,
  counterType: CounterElement['counterType'] = 'CTU'
): CounterElement {
  return {
    id: generateId('counter'),
    kind: 'COUNTER',
    counterType,
    address,
    presetCount,
    resetAddress,
    connectsTo: [],
    ...at,
  };
}

export function createWire(at: Placement): WireElement {
  return { id: generateId('wire'), kind: 'WIRE', connectsTo: [], ...at };
}

export function createBranchStart(branchId: string, at: Placement): BranchStartElement {
  return { id: generateId('branch_start'), kind: 'BRANCH_START', branchId, connectsTo: [], ...at };
}

export function createBranchEnd(branchId: string, at: Placement): BranchEndElement {
  return { id: generateId('branch_end'), kind: 'BRANCH_END', branchId, connectsTo: [], ...at };
}

export function createComment(text: string, at: Placement): CommentElement {
  return { id: generateId('comment'), kind: 'COMMENT', text, ...at };
}
