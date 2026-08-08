import type { InstructionOp } from '@/simulator/types/instruction';

// 16-bit signed integer range — matches Omron CX-Programmer's D-register
// word size. "Register Overflow" (from the Phase 5.4 validation brief)
// means a result outside this range gets clamped, not silently wrapped or
// crashed.
const WORD_MIN = -32768;
const WORD_MAX = 32767;
const REGISTER_MIN = 1;
const REGISTER_MAX = 100;

export interface InstructionResult {
  /** Word register updates to commit (D-address -> new value). */
  words: Record<number, number>;
  /** Bit updates to commit — only CMP ever populates this (its TRUE/FALSE
   * result), written to Bit Memory exactly like a Timer/Counter Done Bit. */
  bits: Record<number, boolean>;
  /** Null on success. Set (and the write skipped or clamped) on any of the
   * Phase 5.4 validation categories: Invalid Operand, Missing Operand,
   * Invalid Register, Register Overflow, Divide By Zero, Invalid
   * Comparator. These are checked here, at execution time, rather than in
   * the parser — this phase's brief explicitly forbids touching the
   * Parser, so an instruction referencing a bad register fails safely
   * during the scan instead of at load time. */
  error: string | null;
}

function isValidRegister(n: number): boolean {
  return Number.isInteger(n) && n >= REGISTER_MIN && n <= REGISTER_MAX;
}

function clampWord(n: number): { value: number; overflowed: boolean } {
  const truncated = Math.trunc(n);
  if (truncated > WORD_MAX) return { value: WORD_MAX, overflowed: true };
  if (truncated < WORD_MIN) return { value: WORD_MIN, overflowed: true };
  return { value: truncated, overflowed: false };
}

function readWord(words: Record<number, number>, addr: number): number {
  return words[addr] ?? 0;
}

const ok = (words: Record<number, number>): InstructionResult => ({ words, bits: {}, error: null });
const fail = (message: string): InstructionResult => ({ words: {}, bits: {}, error: message });

/**
 * Executes exactly one Word Memory instruction against a read-only
 * snapshot of `words`, returning the updates to commit (never mutates
 * `words` directly — matches the rest of the engine's "solve against a
 * frozen snapshot, commit at the end of the scan" discipline).
 */
export function executeInstruction(instr: InstructionOp, words: Record<number, number>): InstructionResult {
  switch (instr.op) {
    case 'MOV': {
      if (!isValidRegister(instr.src) || !isValidRegister(instr.dest)) {
        return fail(`MOV: invalid register (src D${instr.src}, dest D${instr.dest}) — must be D1-D100.`);
      }
      return ok({ [instr.dest]: readWord(words, instr.src) });
    }

    case 'MOVL': {
      if (!isValidRegister(instr.dest)) return fail(`MOVL: invalid register D${instr.dest}.`);
      const { value, overflowed } = clampWord(instr.value);
      const result = ok({ [instr.dest]: value });
      if (overflowed) result.error = `MOVL: literal ${instr.value} overflowed word range, clamped to ${value}.`;
      return result;
    }

    case 'ADD':
    case 'SUB':
    case 'MUL': {
      if (!isValidRegister(instr.a) || !isValidRegister(instr.b) || !isValidRegister(instr.dest)) {
        return fail(`${instr.op}: invalid register reference.`);
      }
      const a = readWord(words, instr.a);
      const b = readWord(words, instr.b);
      const raw = instr.op === 'ADD' ? a + b : instr.op === 'SUB' ? a - b : a * b;
      const { value, overflowed } = clampWord(raw);
      const result = ok({ [instr.dest]: value });
      if (overflowed) result.error = `${instr.op}: result ${raw} overflowed word range, clamped to ${value}.`;
      return result;
    }

    case 'DIV': {
      if (!isValidRegister(instr.a) || !isValidRegister(instr.b) || !isValidRegister(instr.dest)) {
        return fail('DIV: invalid register reference.');
      }
      const divisor = readWord(words, instr.b);
      if (divisor === 0) {
        return fail(`DIV: divide by zero (D${instr.b} is 0) — destination left unchanged.`);
      }
      const { value, overflowed } = clampWord(readWord(words, instr.a) / divisor);
      const result = ok({ [instr.dest]: value });
      if (overflowed) result.error = 'DIV: result overflowed word range, clamped.';
      return result;
    }

    case 'INC':
    case 'DEC': {
      if (!isValidRegister(instr.dest)) return fail(`${instr.op}: invalid register D${instr.dest}.`);
      const current = readWord(words, instr.dest);
      const { value, overflowed } = clampWord(instr.op === 'INC' ? current + 1 : current - 1);
      const result = ok({ [instr.dest]: value });
      if (overflowed) result.error = `${instr.op}: overflowed word range, clamped to ${value}.`;
      return result;
    }

    case 'NEG': {
      if (!isValidRegister(instr.src) || !isValidRegister(instr.dest)) return fail('NEG: invalid register reference.');
      const { value, overflowed } = clampWord(-readWord(words, instr.src));
      const result = ok({ [instr.dest]: value });
      if (overflowed) result.error = 'NEG: overflowed word range, clamped.';
      return result;
    }

    case 'ABS': {
      if (!isValidRegister(instr.src) || !isValidRegister(instr.dest)) return fail('ABS: invalid register reference.');
      return ok({ [instr.dest]: clampWord(Math.abs(readWord(words, instr.src))).value });
    }

    case 'MIN':
    case 'MAX': {
      if (!isValidRegister(instr.a) || !isValidRegister(instr.b) || !isValidRegister(instr.dest)) {
        return fail(`${instr.op}: invalid register reference.`);
      }
      const a = readWord(words, instr.a);
      const b = readWord(words, instr.b);
      return ok({ [instr.dest]: instr.op === 'MIN' ? Math.min(a, b) : Math.max(a, b) });
    }

    case 'LIMIT': {
      if (![instr.src, instr.low, instr.high, instr.dest].every(isValidRegister)) {
        return fail('LIMIT: invalid register reference.');
      }
      const value = readWord(words, instr.src);
      const low = readWord(words, instr.low);
      const high = readWord(words, instr.high);
      if (low > high) return fail(`LIMIT: low (D${instr.low}=${low}) is greater than high (D${instr.high}=${high}).`);
      return ok({ [instr.dest]: Math.min(high, Math.max(low, value)) });
    }

    case 'AND':
    case 'OR':
    case 'XOR': {
      if (!isValidRegister(instr.a) || !isValidRegister(instr.b) || !isValidRegister(instr.dest)) {
        return fail(`${instr.op}: invalid register reference.`);
      }
      const a = readWord(words, instr.a) & 0xffff;
      const b = readWord(words, instr.b) & 0xffff;
      const raw = instr.op === 'AND' ? a & b : instr.op === 'OR' ? a | b : a ^ b;
      return ok({ [instr.dest]: toSigned16(raw) });
    }

    case 'NOT': {
      if (!isValidRegister(instr.src) || !isValidRegister(instr.dest)) return fail('NOT: invalid register reference.');
      const raw = ~readWord(words, instr.src) & 0xffff;
      return ok({ [instr.dest]: toSigned16(raw) });
    }

    case 'SHL':
    case 'SHR':
    case 'ROL':
    case 'ROR': {
      if (!isValidRegister(instr.src) || !isValidRegister(instr.dest)) return fail(`${instr.op}: invalid register reference.`);
      if (!Number.isInteger(instr.positions) || instr.positions < 0 || instr.positions > 16) {
        return fail(`${instr.op}: invalid shift/rotate amount (${instr.positions}) — must be 0-16.`);
      }
      const raw = readWord(words, instr.src) & 0xffff;
      const n = instr.positions % 16;
      let shifted: number;
      switch (instr.op) {
        case 'SHL':
          shifted = (raw << n) & 0xffff;
          break;
        case 'SHR':
          shifted = raw >>> n;
          break;
        case 'ROL':
          shifted = ((raw << n) | (raw >>> (16 - n))) & 0xffff;
          break;
        case 'ROR':
          shifted = ((raw >>> n) | (raw << (16 - n))) & 0xffff;
          break;
      }
      return ok({ [instr.dest]: toSigned16(shifted) });
    }

    case 'CMP': {
      if (!isValidRegister(instr.a) || !isValidRegister(instr.b)) return fail('CMP: invalid register reference.');
      if (instr.resultAddress.type !== 'M') {
        return fail(`CMP: result must be written to a Memory (M) bit, got type "${instr.resultAddress.type}".`);
      }
      const a = readWord(words, instr.a);
      const b = readWord(words, instr.b);
      let result: boolean;
      switch (instr.comparator) {
        case 'EQ':
          result = a === b;
          break;
        case 'NE':
          result = a !== b;
          break;
        case 'GT':
          result = a > b;
          break;
        case 'LT':
          result = a < b;
          break;
        case 'GE':
          result = a >= b;
          break;
        case 'LE':
          result = a <= b;
          break;
        default: {
          const _exhaustive: never = instr.comparator;
          return fail(`CMP: invalid comparator "${_exhaustive}".`);
        }
      }
      return { words: {}, bits: { [instr.resultAddress.number]: result }, error: null };
    }

    default: {
      const _exhaustive: never = instr;
      return fail(`Unknown instruction: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

/** Reinterprets a 16-bit unsigned bit pattern as a signed word — needed
 * after any bitwise op (AND/OR/XOR/NOT/SHL/SHR/ROL/ROR), since JS's bitwise
 * operators work in 32-bit and D-registers are 16-bit signed. */
function toSigned16(u16: number): number {
  return u16 >= 0x8000 ? u16 - 0x10000 : u16;
}

// Only used internally above; exported for the verification script so it
// can construct expected values the same way the engine does, without
// duplicating the bit-width logic.
export { WORD_MIN, WORD_MAX, REGISTER_MIN, REGISTER_MAX };
