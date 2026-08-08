/**
 * Phase 5.4 verification — every requested test case (MOV, ADD, SUB, INC,
 * DEC, CMP, KEEP, SET/RESET, DIFU, DIFD) plus the new validation
 * categories (Invalid Register, Divide By Zero, Invalid Comparator,
 * Register Overflow), run against the real scan cycle. No mocks.
 *
 * Run with: npx tsx src/simulator/examples/runPhase54Example.ts
 */
import { createContact, createCoil, createInstructionCoil, createKeepPair } from '../models/elementFactory';
import { parseLadder } from '../parser/parseLadder';
import { runScanCycle } from '../engine/scanCycle';
import { createEmptyState } from '../types/plcState';
import type { PlcState } from '../types/plcState';
import type { LadderProject, Rung } from '../types/ladder';
import type { InstructionOp } from '../types/instruction';
import type { CompiledLadder } from '../types/runtime';

function log(title: string) {
  console.log(`\n=== ${title} ===`);
}
function project(name: string, rungs: Rung[]): LadderProject {
  const now = new Date().toISOString();
  return { id: `p54-${name}`, name, rungs, meta: { createdAt: now, updatedAt: now, engineVersion: '0.1.0' } };
}
function scan(compiled: CompiledLadder, state: PlcState, n = 1, ms = 100): PlcState {
  let s = state;
  for (let i = 0; i < n; i++) s = runScanCycle(compiled, s, ms).state;
  return s;
}
function check(label: string, actual: unknown, expected: unknown) {
  const pass = actual === expected;
  console.log(`${pass ? '✓' : '✗ MISMATCH'} ${label}: got ${actual}, expected ${expected}`);
}
function instructionRung(id: string, instr: InstructionOp, address = { type: 'M' as const, number: 20 }): Rung {
  const c = createContact({ type: 'I', number: 1 }, 'NO', { gridX: 0, gridY: 0 });
  const coil = createInstructionCoil(address, instr, { gridX: 1, gridY: 0 });
  c.connectsTo = [coil.id];
  return { id, startIds: [c.id], elements: [c, coil] };
}

// ── MOV D1 D2 ────────────────────────────────────────────────────────────
log('MOV D1 D2');
{
  const compiled = parseLadder(project('mov', [instructionRung('r1', { op: 'MOV', src: 1, dest: 2 })]));
  let state = createEmptyState();
  state.words[1] = 42;
  state.inputs[1] = true;
  state = scan(compiled, state, 1);
  check('D2 after MOV D1 D2', state.words[2], 42);
}

// ── ADD D1 D2 D3 ─────────────────────────────────────────────────────────
log('ADD D1 D2 D3');
{
  const compiled = parseLadder(project('add', [instructionRung('r1', { op: 'ADD', a: 1, b: 2, dest: 3 })]));
  let state = createEmptyState();
  state.words[1] = 10;
  state.words[2] = 5;
  state.inputs[1] = true;
  state = scan(compiled, state, 1);
  check('D3 after ADD D1 D2 D3 (10+5)', state.words[3], 15);
}

// ── SUB D3 D2 D1 ─────────────────────────────────────────────────────────
log('SUB D3 D2 D1');
{
  const compiled = parseLadder(project('sub', [instructionRung('r1', { op: 'SUB', a: 3, b: 2, dest: 1 })]));
  let state = createEmptyState();
  state.words[3] = 15;
  state.words[2] = 5;
  state.inputs[1] = true;
  state = scan(compiled, state, 1);
  check('D1 after SUB D3 D2 D1 (15-5)', state.words[1], 10);
}

// ── INC D1 / DEC D1 ──────────────────────────────────────────────────────
log('INC D1 / DEC D1');
{
  const compiled = parseLadder(project('inc-dec', [instructionRung('r1', { op: 'INC', dest: 1 })]));
  let state = createEmptyState();
  state.words[1] = 5;
  state.inputs[1] = true;
  state = scan(compiled, state, 1);
  check('D1 after one INC (level-triggered, powered 1 scan)', state.words[1], 6);
  state = scan(compiled, state, 1);
  check('D1 after a 2nd scan still powered (INC re-fires every scan it stays true — as designed, edge-gate it yourself for a single pulse)', state.words[1], 7);

  const compiledDec = parseLadder(project('dec', [instructionRung('r2', { op: 'DEC', dest: 1 })]));
  let state2 = createEmptyState();
  state2.words[1] = 5;
  state2.inputs[1] = true;
  state2 = scan(compiledDec, state2, 1);
  check('D1 after one DEC', state2.words[1], 4);
}
{
  // Realistic usage: gate INC with a RISING_EDGE contact so it increments
  // exactly once per button press, not once per scan while held.
  const start = createContact({ type: 'I', number: 1 }, 'RISING_EDGE', { gridX: 0, gridY: 0 });
  const incCoil = createInstructionCoil({ type: 'M', number: 21 }, { op: 'INC', dest: 5 }, { gridX: 1, gridY: 0 });
  start.connectsTo = [incCoil.id];
  const compiled = parseLadder(project('inc-edge-gated', [{ id: 'r1', startIds: [start.id], elements: [start, incCoil] }]));

  let state = createEmptyState();
  state.words[5] = 0;
  state.inputs[1] = true; // rising edge — increments once
  state = scan(compiled, state, 1);
  state = scan(compiled, state, 5); // held true for 5 more scans — must NOT keep incrementing
  check('Edge-gated INC: held input increments exactly once, not 6 times', state.words[5], 1);
}

// ── CMP D1 D2 ────────────────────────────────────────────────────────────
log('CMP D1 D2 (GT)');
{
  const start = createContact({ type: 'I', number: 1 }, 'NO', { gridX: 0, gridY: 0 });
  const cmpCoil = createInstructionCoil(
    { type: 'M', number: 22 },
    { op: 'CMP', a: 1, b: 2, comparator: 'GT', resultAddress: { type: 'M', number: 1 } },
    { gridX: 1, gridY: 0 }
  );
  start.connectsTo = [cmpCoil.id];

  const readback = createContact({ type: 'M', number: 1 }, 'NO', { gridX: 0, gridY: 0 });
  const coil = createCoil({ type: 'O', number: 1 }, { gridX: 1, gridY: 0 });
  readback.connectsTo = [coil.id];

  const compiled = parseLadder(
    project('cmp', [
      { id: 'r1', startIds: [start.id], elements: [start, cmpCoil] },
      { id: 'r2', startIds: [readback.id], elements: [readback, coil] },
    ])
  );

  let state = createEmptyState();
  state.words[1] = 10;
  state.words[2] = 5;
  state.inputs[1] = true;
  state = scan(compiled, state, 1);
  check('M1 (CMP D1>D2 result) after 10>5', state.memory[1], true);
  state = scan(compiled, state, 1);
  check('O1 after M1 readback propagates', state.outputs[1], true);
}

// ── KEEP (SR latch via createKeepPair) ──────────────────────────────────
log('KEEP (createKeepPair helper — SR flip-flop)');
{
  const { setCoil, resetCoil } = createKeepPair({ type: 'O', number: 5 }, { gridX: 1, gridY: 0 }, { gridX: 1, gridY: 0 });
  const setInput = createContact({ type: 'I', number: 1 }, 'NO', { gridX: 0, gridY: 0 });
  setInput.connectsTo = [setCoil.id];
  const resetInput = createContact({ type: 'I', number: 2 }, 'NO', { gridX: 0, gridY: 0 });
  resetInput.connectsTo = [resetCoil.id];

  const compiled = parseLadder(
    project('keep', [
      { id: 'rSet', startIds: [setInput.id], elements: [setInput, setCoil] },
      { id: 'rReset', startIds: [resetInput.id], elements: [resetInput, resetCoil] },
    ])
  );

  let state = createEmptyState();
  state.inputs[1] = true;
  state = scan(compiled, state, 1);
  check('KEEP: Set pulsed -> O5', state.outputs[5], true);
  state.inputs[1] = false;
  state = scan(compiled, state, 1);
  check('KEEP: Set released -> O5 stays latched', state.outputs[5], true);
  state.inputs[2] = true;
  state = scan(compiled, state, 1);
  check('KEEP: Reset pulsed -> O5', state.outputs[5], false);
}

// ── DIFU / DIFD (rising/falling-edge contact + NORMAL coil) ────────────
log('DIFU / DIFD (one-shot on transition)');
{
  const difu = createContact({ type: 'I', number: 1 }, 'RISING_EDGE', { gridX: 0, gridY: 0 });
  const difuCoil = createCoil({ type: 'O', number: 6 }, { gridX: 1, gridY: 0 });
  difu.connectsTo = [difuCoil.id];

  const difd = createContact({ type: 'I', number: 1 }, 'FALLING_EDGE', { gridX: 0, gridY: 0 });
  const difdCoil = createCoil({ type: 'O', number: 7 }, { gridX: 1, gridY: 0 });
  difd.connectsTo = [difdCoil.id];

  const compiled = parseLadder(
    project('difu-difd', [
      { id: 'rU', startIds: [difu.id], elements: [difu, difuCoil] },
      { id: 'rD', startIds: [difd.id], elements: [difd, difdCoil] },
    ])
  );

  let state = createEmptyState();
  state.inputs[1] = true; // rising edge
  state = scan(compiled, state, 1);
  check('DIFU fires on rising edge', state.outputs[6], true);
  state = scan(compiled, state, 1);
  check('DIFU stays off next scan even though input still held', state.outputs[6], false);

  state.inputs[1] = false; // falling edge
  state = scan(compiled, state, 1);
  check('DIFD fires on falling edge', state.outputs[7], true);
  state = scan(compiled, state, 1);
  check('DIFD stays off next scan', state.outputs[7], false);
}

// ── Validation: Invalid Register ────────────────────────────────────────
log('Validation: Invalid Register');
{
  const compiled = parseLadder(project('bad-register', [instructionRung('r1', { op: 'MOV', src: 1, dest: 999 })]));
  let state = createEmptyState();
  state.inputs[1] = true;
  state = scan(compiled, state, 1);
  const entry = state.instructionLog.find((e) => e.op === 'MOV');
  console.log(entry?.error ? `✓ Invalid register caught: ${entry.error}` : '✗ Invalid register NOT caught (bug)');
}

// ── Validation: Divide By Zero ───────────────────────────────────────────
log('Validation: Divide By Zero');
{
  const compiled = parseLadder(project('div-zero', [instructionRung('r1', { op: 'DIV', a: 1, b: 2, dest: 3 })]));
  let state = createEmptyState();
  state.words[1] = 10;
  state.words[2] = 0; // divisor is zero
  state.words[3] = 999; // sentinel — should remain untouched
  state.inputs[1] = true;
  state = scan(compiled, state, 1);
  check('D3 left unchanged on divide-by-zero', state.words[3], 999);
  const entry = state.instructionLog.find((e) => e.op === 'DIV');
  console.log(entry?.error ? `✓ Divide-by-zero caught: ${entry.error}` : '✗ Divide-by-zero NOT caught (bug)');
}

// ── Validation: Register Overflow ────────────────────────────────────────
log('Validation: Register Overflow');
{
  const compiled = parseLadder(project('overflow', [instructionRung('r1', { op: 'ADD', a: 1, b: 2, dest: 3 })]));
  let state = createEmptyState();
  state.words[1] = 32000;
  state.words[2] = 1000; // 33000 > 32767 (16-bit signed max)
  state.inputs[1] = true;
  state = scan(compiled, state, 1);
  check('D3 clamped to word max on overflow', state.words[3], 32767);
  const entry = state.instructionLog.find((e) => e.op === 'ADD');
  console.log(entry?.error ? `✓ Overflow logged: ${entry.error}` : '✗ Overflow NOT logged (bug)');
}

// ── Validation: Invalid Comparator ───────────────────────────────────────
log('Validation: Invalid Comparator (malformed data, as if loaded from a hand-edited JSON)');
{
  const badInstr = { op: 'CMP', a: 1, b: 2, comparator: 'BOGUS', resultAddress: { type: 'M', number: 1 } } as unknown as InstructionOp;
  const compiled = parseLadder(project('bad-comparator', [instructionRung('r1', badInstr)]));
  let state = createEmptyState();
  state.inputs[1] = true;
  state = scan(compiled, state, 1);
  const entry = state.instructionLog.find((e) => e.op === 'CMP');
  console.log(entry?.error ? `✓ Invalid comparator caught: ${entry.error}` : '✗ Invalid comparator NOT caught (bug)');
}

console.log('\nAll Phase 5.4 test cases executed.\n');
