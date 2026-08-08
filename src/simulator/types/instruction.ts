import type { Address } from './address';

/** D1-D100 — a Word Memory register number. */
export type WordAddress = number;

export type ComparatorOp = 'EQ' | 'NE' | 'GT' | 'LT' | 'GE' | 'LE';

/**
 * Every PLC Instruction Set member from the Phase 5.4 brief that operates
 * on Word Memory. Modeled as a plain data union (not a graph node) so it
 * never has to pass through evaluateRung.ts (the Logic Engine) — see
 * `CoilElement.instruction` in types/ladder.ts and
 * engine/instructionEngine.ts for how these actually execute.
 *
 * CMP is the one exception: comparators produce a TRUE/FALSE result, not a
 * new word value, so it writes to a Bit Memory address instead of a word —
 * exactly like how a Timer/Counter's Done Bit already works. A normal
 * CONTACT elsewhere reads that bit to gate further power flow.
 */
export type InstructionOp =
  | { op: 'MOV'; src: WordAddress; dest: WordAddress }
  | { op: 'MOVL'; value: number; dest: WordAddress }
  | { op: 'ADD'; a: WordAddress; b: WordAddress; dest: WordAddress }
  | { op: 'SUB'; a: WordAddress; b: WordAddress; dest: WordAddress }
  | { op: 'MUL'; a: WordAddress; b: WordAddress; dest: WordAddress }
  | { op: 'DIV'; a: WordAddress; b: WordAddress; dest: WordAddress }
  | { op: 'INC'; dest: WordAddress }
  | { op: 'DEC'; dest: WordAddress }
  | { op: 'NEG'; src: WordAddress; dest: WordAddress }
  | { op: 'ABS'; src: WordAddress; dest: WordAddress }
  | { op: 'MIN'; a: WordAddress; b: WordAddress; dest: WordAddress }
  | { op: 'MAX'; a: WordAddress; b: WordAddress; dest: WordAddress }
  | { op: 'LIMIT'; src: WordAddress; low: WordAddress; high: WordAddress; dest: WordAddress }
  | { op: 'AND'; a: WordAddress; b: WordAddress; dest: WordAddress }
  | { op: 'OR'; a: WordAddress; b: WordAddress; dest: WordAddress }
  | { op: 'XOR'; a: WordAddress; b: WordAddress; dest: WordAddress }
  | { op: 'NOT'; src: WordAddress; dest: WordAddress }
  | { op: 'SHL'; src: WordAddress; positions: number; dest: WordAddress }
  | { op: 'SHR'; src: WordAddress; positions: number; dest: WordAddress }
  | { op: 'ROL'; src: WordAddress; positions: number; dest: WordAddress }
  | { op: 'ROR'; src: WordAddress; positions: number; dest: WordAddress }
  | { op: 'CMP'; a: WordAddress; b: WordAddress; comparator: ComparatorOp; resultAddress: Address };
