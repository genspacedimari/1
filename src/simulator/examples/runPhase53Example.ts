/**
 * Phase 5.3 verification — the 8 test cases from the brief, plus the new
 * Timer Reset feature and the new validation rules (Invalid Preset,
 * Invalid Reference), run against the existing (unmodified this phase in
 * terms of public API shape beyond the one additive param) parser + scan
 * cycle. No mocks — every assertion below runs the real engine.
 *
 * Run with: npx tsx src/simulator/examples/runPhase53Example.ts
 */
import { createContact, createCoil, createTimer, createCounter } from '../models/elementFactory';
import { parseLadder } from '../parser/parseLadder';
import { runScanCycle } from '../engine/scanCycle';
import { createEmptyState } from '../types/plcState';
import type { PlcState } from '../types/plcState';
import type { LadderProject, Rung } from '../types/ladder';
import type { CompiledLadder } from '../types/runtime';

function log(title: string) {
  console.log(`\n=== ${title} ===`);
}
function project(name: string, rungs: Rung[]): LadderProject {
  const now = new Date().toISOString();
  return { id: `p53-${name}`, name, rungs, meta: { createdAt: now, updatedAt: now, engineVersion: '0.1.0' } };
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

// ── 1. START -> TON -> OUTPUT ────────────────────────────────────────────
log('1. START -> TON -> OUTPUT');
{
  const start = createContact({ type: 'I', number: 1 }, 'NO', { gridX: 0, gridY: 0 });
  const timer = createTimer({ type: 'TIM', number: 1 }, 500, { gridX: 1, gridY: 0 });
  start.connectsTo = [timer.id];
  const done = createContact({ type: 'TIM', number: 1 }, 'NO', { gridX: 0, gridY: 0 });
  const coil = createCoil({ type: 'O', number: 1 }, { gridX: 1, gridY: 0 });
  done.connectsTo = [coil.id];

  const compiled = parseLadder(
    project('t1', [
      { id: 'r1', startIds: [start.id], elements: [start, timer] },
      { id: 'r2', startIds: [done.id], elements: [done, coil] },
    ])
  );

  let state = createEmptyState();
  state.inputs[1] = true;
  state = scan(compiled, state, 5); // 500ms
  check('TIM1.done after 500ms', state.timers[1]?.done, true);
  state = scan(compiled, state, 1); // rung2 sees it next scan
  check('O1 after TIM1 done propagates', state.outputs[1], true);
}

// ── 2. START -> CTU -> OUTPUT ────────────────────────────────────────────
log('2. START -> CTU -> OUTPUT');
{
  const start = createContact({ type: 'I', number: 1 }, 'NO', { gridX: 0, gridY: 0 });
  const counter = createCounter({ type: 'CTU', number: 1 }, 3, { gridX: 1, gridY: 0 });
  start.connectsTo = [counter.id];
  const done = createContact({ type: 'CTU', number: 1 }, 'NO', { gridX: 0, gridY: 0 });
  const coil = createCoil({ type: 'O', number: 1 }, { gridX: 1, gridY: 0 });
  done.connectsTo = [coil.id];

  const compiled = parseLadder(
    project('t2', [
      { id: 'r1', startIds: [start.id], elements: [start, counter] },
      { id: 'r2', startIds: [done.id], elements: [done, coil] },
    ])
  );

  let state = createEmptyState();
  for (const v of [true, false, true, false, true, false]) {
    state.inputs[1] = v;
    state = scan(compiled, state, 1);
  }
  check('CTU1.done after 3 pulses', state.counters[1]?.done, true);
  state = scan(compiled, state, 1);
  check('O1 after CTU1 done propagates', state.outputs[1], true);
}

// ── 3. TON + Self-Holding ────────────────────────────────────────────────
log('3. TON + Self-Holding (timer output feeds a seal-in latch)');
{
  const start = createContact({ type: 'I', number: 1 }, 'NO', { gridX: 0, gridY: 0 });
  const timer = createTimer({ type: 'TIM', number: 2 }, 300, { gridX: 1, gridY: 0 });
  start.connectsTo = [timer.id];

  const timerDone = createContact({ type: 'TIM', number: 2 }, 'NO', { gridX: 0, gridY: 0 });
  const seal = createContact({ type: 'O', number: 2 }, 'NO', { gridX: 0, gridY: 1 });
  const stop = createContact({ type: 'I', number: 2 }, 'NC', { gridX: 1, gridY: 0 });
  const coil = createCoil({ type: 'O', number: 2 }, { gridX: 2, gridY: 0 });
  timerDone.connectsTo = [stop.id];
  seal.connectsTo = [stop.id];
  stop.connectsTo = [coil.id];

  const compiled = parseLadder(
    project('t3', [
      { id: 'r1', startIds: [start.id], elements: [start, timer] },
      { id: 'r2', startIds: [timerDone.id, seal.id], elements: [timerDone, seal, stop, coil] },
    ])
  );

  let state = createEmptyState();
  state.inputs[1] = true;
  state = scan(compiled, state, 3); // 300ms -> TIM2 done
  check('TIM2.done at 300ms', state.timers[2]?.done, true);
  state = scan(compiled, state, 1); // rung2 latches Q2
  check('Q2 latched via timer done', state.outputs[2], true);

  state.inputs[1] = false; // release start -> TON resets (non-retentive)
  state = scan(compiled, state, 1);
  check('TIM2.done resets after start released', state.timers[2]?.done, false);
  check('Q2 STAYS on via its own seal (not depending on timer anymore)', state.outputs[2], true);

  state.inputs[2] = true; // stop
  state = scan(compiled, state, 1);
  check('Q2 off after stop', state.outputs[2], false);
}

// ── 4. Counter + Reset ───────────────────────────────────────────────────
log('4. Counter + Reset (CTU, external reset bit)');
{
  const start = createContact({ type: 'I', number: 1 }, 'NO', { gridX: 0, gridY: 0 });
  const counter = createCounter({ type: 'CTU', number: 2 }, 3, { gridX: 1, gridY: 0 }, { type: 'I', number: 2 });
  start.connectsTo = [counter.id];
  const compiled = parseLadder(project('t4', [{ id: 'r1', startIds: [start.id], elements: [start, counter] }]));

  let state = createEmptyState();
  for (const v of [true, false, true, false]) {
    state.inputs[1] = v;
    state = scan(compiled, state, 1);
  }
  check('CTU2.accumulated after 2 pulses', state.counters[2]?.accumulatedCount, 2);

  state.inputs[2] = true; // reset
  state = scan(compiled, state, 1);
  check('CTU2.accumulated after reset', state.counters[2]?.accumulatedCount, 0);
  check('CTU2.done after reset', state.counters[2]?.done, false);
}

// ── NEW: Timer Reset ──────────────────────────────────────────────────────
log('NEW: Timer Reset (TON, external reset bit — new in Phase 5.3)');
{
  const start = createContact({ type: 'I', number: 1 }, 'NO', { gridX: 0, gridY: 0 });
  const timer = createTimer({ type: 'TIM', number: 3 }, 1000, { gridX: 1, gridY: 0 }, 'TON', { type: 'I', number: 2 });
  start.connectsTo = [timer.id];
  const compiled = parseLadder(project('t-reset', [{ id: 'r1', startIds: [start.id], elements: [start, timer] }]));

  let state = createEmptyState();
  state.inputs[1] = true;
  state = scan(compiled, state, 5); // 500ms of 1000ms
  check('TIM3.accumulated at 500ms', state.timers[3]?.accumulatedMs, 500);

  state.inputs[2] = true; // reset, while still powered
  state = scan(compiled, state, 1);
  check('TIM3.accumulated snaps to 0 on reset (even while still powered)', state.timers[3]?.accumulatedMs, 0);

  state.inputs[2] = false; // release reset, still powered -> resumes counting
  state = scan(compiled, state, 3); // 300ms
  check('TIM3.accumulated resumes counting after reset released', state.timers[3]?.accumulatedMs, 300);
}

// ── 5. Multiple Timer ────────────────────────────────────────────────────
log('5. Multiple Timer (independent TIM4 @300ms, TIM5 @600ms)');
{
  const c1 = createContact({ type: 'I', number: 1 }, 'NO', { gridX: 0, gridY: 0 });
  const t1 = createTimer({ type: 'TIM', number: 4 }, 300, { gridX: 1, gridY: 0 });
  c1.connectsTo = [t1.id];
  const c2 = createContact({ type: 'I', number: 1 }, 'NO', { gridX: 0, gridY: 1 });
  const t2 = createTimer({ type: 'TIM', number: 5 }, 600, { gridX: 1, gridY: 1 });
  c2.connectsTo = [t2.id];

  const compiled = parseLadder(
    project('t5', [{ id: 'r1', startIds: [c1.id, c2.id], elements: [c1, t1, c2, t2] }])
  );

  let state = createEmptyState();
  state.inputs[1] = true;
  state = scan(compiled, state, 3); // 300ms
  check('TIM4 done at 300ms', state.timers[4]?.done, true);
  check('TIM5 NOT done yet at 300ms (needs 600ms)', state.timers[5]?.done, false);

  state = scan(compiled, state, 3); // +300ms = 600ms total
  check('TIM5 done at 600ms', state.timers[5]?.done, true);
}

// ── 6. Multiple Counter ──────────────────────────────────────────────────
log('6. Multiple Counter (independent CTU3 preset 2, CTU4 preset 5, same pulse source)');
{
  const c1 = createContact({ type: 'I', number: 1 }, 'NO', { gridX: 0, gridY: 0 });
  const ctr1 = createCounter({ type: 'CTU', number: 3 }, 2, { gridX: 1, gridY: 0 });
  c1.connectsTo = [ctr1.id];
  const c2 = createContact({ type: 'I', number: 1 }, 'NO', { gridX: 0, gridY: 1 });
  const ctr2 = createCounter({ type: 'CTU', number: 4 }, 5, { gridX: 1, gridY: 1 });
  c2.connectsTo = [ctr2.id];

  const compiled = parseLadder(
    project('t6', [{ id: 'r1', startIds: [c1.id, c2.id], elements: [c1, ctr1, c2, ctr2] }])
  );

  let state = createEmptyState();
  for (const v of [true, false, true, false]) {
    // 2 pulses
    state.inputs[1] = v;
    state = scan(compiled, state, 1);
  }
  check('CTU3 (preset 2) done after 2 pulses', state.counters[3]?.done, true);
  check('CTU4 (preset 5) NOT done after only 2 pulses', state.counters[4]?.done, false);
}

// ── 7. Nested Branch + Timer ─────────────────────────────────────────────
log('7. Nested Branch + Timer (I1 AND (I2 OR (I3 AND I4)) -> TON -> Output)');
{
  const c1 = createContact({ type: 'I', number: 1 }, 'NO', { gridX: 0, gridY: 0 });
  const c2 = createContact({ type: 'I', number: 2 }, 'NO', { gridX: 1, gridY: 0 });
  const c3 = createContact({ type: 'I', number: 3 }, 'NO', { gridX: 1, gridY: 1 });
  const c4 = createContact({ type: 'I', number: 4 }, 'NO', { gridX: 2, gridY: 1 });
  const timer = createTimer({ type: 'TIM', number: 6 }, 200, { gridX: 3, gridY: 0 });
  c1.connectsTo = [c2.id, c3.id];
  c2.connectsTo = [timer.id];
  c3.connectsTo = [c4.id];
  c4.connectsTo = [timer.id];

  const done = createContact({ type: 'TIM', number: 6 }, 'NO', { gridX: 0, gridY: 0 });
  const coil = createCoil({ type: 'O', number: 3 }, { gridX: 1, gridY: 0 });
  done.connectsTo = [coil.id];

  const compiled = parseLadder(
    project('t7', [
      { id: 'r1', startIds: [c1.id], elements: [c1, c2, c3, c4, timer] },
      { id: 'r2', startIds: [done.id], elements: [done, coil] },
    ])
  );

  let state = createEmptyState();
  state.inputs[1] = true;
  state.inputs[3] = true;
  state.inputs[4] = false; // path B incomplete, path A (I2) also false -> branch condition false
  state = scan(compiled, state, 3);
  check('TIM6 NOT accumulating when nested-branch condition is false', state.timers[6]?.accumulatedMs, 0);

  state.inputs[4] = true; // now path B (I3 AND I4) is satisfied -> branch true
  state = scan(compiled, state, 2); // 200ms
  check('TIM6.done once nested-branch condition becomes true', state.timers[6]?.done, true);
  state = scan(compiled, state, 1);
  check('O3 after TIM6 done propagates', state.outputs[3], true);
}

// ── 8. Nested Branch + Counter ───────────────────────────────────────────
log('8. Nested Branch + Counter (I1 AND (I2 OR (I3 AND I4)) -> CTU -> Output)');
{
  const c1 = createContact({ type: 'I', number: 1 }, 'NO', { gridX: 0, gridY: 0 });
  const c2 = createContact({ type: 'I', number: 2 }, 'NO', { gridX: 1, gridY: 0 });
  const c3 = createContact({ type: 'I', number: 3 }, 'NO', { gridX: 1, gridY: 1 });
  const c4 = createContact({ type: 'I', number: 4 }, 'NO', { gridX: 2, gridY: 1 });
  const counter = createCounter({ type: 'CTU', number: 5 }, 2, { gridX: 3, gridY: 0 });
  c1.connectsTo = [c2.id, c3.id];
  c2.connectsTo = [counter.id];
  c3.connectsTo = [c4.id];
  c4.connectsTo = [counter.id];

  const done = createContact({ type: 'CTU', number: 5 }, 'NO', { gridX: 0, gridY: 0 });
  const coil = createCoil({ type: 'O', number: 4 }, { gridX: 1, gridY: 0 });
  done.connectsTo = [coil.id];

  const compiled = parseLadder(
    project('t8', [
      { id: 'r1', startIds: [c1.id], elements: [c1, c2, c3, c4, counter] },
      { id: 'r2', startIds: [done.id], elements: [done, coil] },
    ])
  );

  let state = createEmptyState();
  state.inputs[1] = true;
  state.inputs[2] = true; // path A satisfies branch condition every scan I2 is true
  // Pulse via path A twice (rising edges of the branch's combined OR result)
  state = scan(compiled, state, 1); // rising edge #1 (branch: false->true)
  state.inputs[2] = false;
  state = scan(compiled, state, 1); // branch true->false
  state.inputs[2] = true;
  state = scan(compiled, state, 1); // rising edge #2
  check('CTU5.accumulated after 2 nested-branch pulses', state.counters[5]?.accumulatedCount, 2);
  check('CTU5.done', state.counters[5]?.done, true);
  state = scan(compiled, state, 1);
  check('O4 after CTU5 done propagates', state.outputs[4], true);
}

// ── Validation: Invalid Preset ───────────────────────────────────────────
log('Validation: Invalid Preset');
{
  const c1 = createContact({ type: 'I', number: 1 }, 'NO', { gridX: 0, gridY: 0 });
  const badTimer = createTimer({ type: 'TIM', number: 7 }, 0, { gridX: 1, gridY: 0 }); // preset 0 -> invalid
  c1.connectsTo = [badTimer.id];
  try {
    parseLadder(project('bad-preset-timer', [{ id: 'r1', startIds: [c1.id], elements: [c1, badTimer] }]));
    console.log('✗ Invalid timer preset NOT rejected (bug)');
  } catch (e) {
    console.log('✓ Invalid timer preset rejected:', (e as Error).message);
  }

  const c2 = createContact({ type: 'I', number: 1 }, 'NO', { gridX: 0, gridY: 0 });
  const badCounter = createCounter({ type: 'CTU', number: 6 }, -1, { gridX: 1, gridY: 0 }); // negative -> invalid
  c2.connectsTo = [badCounter.id];
  try {
    parseLadder(project('bad-preset-counter', [{ id: 'r1', startIds: [c2.id], elements: [c2, badCounter] }]));
    console.log('✗ Invalid counter preset NOT rejected (bug)');
  } catch (e) {
    console.log('✓ Invalid counter preset rejected:', (e as Error).message);
  }
}

// ── Validation: Invalid Reference (reset wired to the wrong address type) ─
log('Validation: Invalid Reference');
{
  const c1 = createContact({ type: 'I', number: 1 }, 'NO', { gridX: 0, gridY: 0 });
  const timer = createTimer({ type: 'TIM', number: 8 }, 1000, { gridX: 1, gridY: 0 }, 'TON', { type: 'O', number: 9 }); // reset from an OUTPUT — invalid
  c1.connectsTo = [timer.id];
  try {
    parseLadder(project('bad-ref', [{ id: 'r1', startIds: [c1.id], elements: [c1, timer] }]));
    console.log('✗ Invalid reset reference NOT rejected (bug)');
  } catch (e) {
    console.log('✓ Invalid reset reference rejected:', (e as Error).message);
  }
}

console.log('\nAll Phase 5.3 test cases executed.\n');
