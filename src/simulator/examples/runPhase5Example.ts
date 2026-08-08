/**
 * Phase 5 verification script — proves the new engine behaviors against
 * the REAL parser + scan cycle (no mocks, no placeholders): self-holding
 * (seal-in) with a stop button, SET/RESET latching coils, TOF, TP, CTD,
 * edge-detect contacts, and the new duplicate-address validation.
 *
 * Run with: npx tsx src/simulator/examples/runPhase5Example.ts
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
  return { id: `p5-${name}`, name, rungs, meta: { createdAt: now, updatedAt: now, engineVersion: '0.1.0' } };
}

function scan(compiled: CompiledLadder, state: PlcState, n = 1, ms = 100): PlcState {
  let s = state;
  for (let i = 0; i < n; i++) s = runScanCycle(compiled, s, ms).state;
  return s;
}

// ── 1. Self-Holding (Seal-In) + Stop Button ─────────────────────────────
log('Self-Holding / Seal-In with Stop Button');
{
  const start = createContact({ type: 'I', number: 1 }, 'NO', { gridX: 0, gridY: 0 });
  const seal = createContact({ type: 'O', number: 1 }, 'NO', { gridX: 0, gridY: 1 });
  const stop = createContact({ type: 'I', number: 2 }, 'NC', { gridX: 1, gridY: 0 });
  const coil = createCoil({ type: 'O', number: 1 }, { gridX: 2, gridY: 0 });

  start.connectsTo = [stop.id];
  seal.connectsTo = [stop.id];
  stop.connectsTo = [coil.id];

  const rung: Rung = { id: 'r1', startIds: [start.id, seal.id], elements: [start, seal, stop, coil] };
  const compiled = parseLadder(project('seal-in', [rung]));

  let state = createEmptyState();
  state = scan(compiled, state, 1);
  console.log('idle -> O1 =', state.outputs[1], '(expect false)');

  state.inputs[1] = true; // press Start
  state = scan(compiled, state, 1);
  console.log('Start pressed -> O1 =', state.outputs[1], '(expect true)');

  state.inputs[1] = false; // release Start
  state = scan(compiled, state, 1);
  console.log('Start released -> O1 =', state.outputs[1], '(expect true — sealed in by its own contact)');

  state.inputs[2] = true; // press Stop
  state = scan(compiled, state, 1);
  console.log('Stop pressed -> O1 =', state.outputs[1], '(expect false)');

  state.inputs[2] = false; // release Stop
  state = scan(compiled, state, 1);
  console.log('Stop released -> O1 =', state.outputs[1], '(expect false — seal was already broken)');
}

// ── 2. SET / RESET Latching Coils ───────────────────────────────────────
log('SET / RESET Coils');
{
  const setContact = createContact({ type: 'I', number: 1 }, 'NO', { gridX: 0, gridY: 0 });
  const setCoil = createCoil({ type: 'O', number: 2 }, { gridX: 1, gridY: 0 }, 'SET');
  setContact.connectsTo = [setCoil.id];
  const rungSet: Rung = { id: 'rSet', startIds: [setContact.id], elements: [setContact, setCoil] };

  const resetContact = createContact({ type: 'I', number: 2 }, 'NO', { gridX: 0, gridY: 0 });
  const resetCoil = createCoil({ type: 'O', number: 2 }, { gridX: 1, gridY: 0 }, 'RESET');
  resetContact.connectsTo = [resetCoil.id];
  const rungReset: Rung = { id: 'rReset', startIds: [resetContact.id], elements: [resetContact, resetCoil] };

  const compiled = parseLadder(project('set-reset', [rungSet, rungReset]));
  let state = createEmptyState();

  state.inputs[1] = true;
  state = scan(compiled, state, 1);
  console.log('SET pulsed -> O2 =', state.outputs[2], '(expect true)');

  state.inputs[1] = false;
  state = scan(compiled, state, 1);
  console.log('SET released -> O2 =', state.outputs[2], '(expect true — latched, unlike a NORMAL coil)');

  state.inputs[2] = true;
  state = scan(compiled, state, 1);
  console.log('RESET pulsed -> O2 =', state.outputs[2], '(expect false)');

  state.inputs[2] = false;
  state = scan(compiled, state, 1);
  console.log('RESET released -> O2 =', state.outputs[2], '(expect false — stays reset)');
}

// ── 3. TOF (Off-Delay Timer) ────────────────────────────────────────────
log('TOF Timer (preset 1000ms, 100ms/scan)');
{
  const c1 = createContact({ type: 'I', number: 1 }, 'NO', { gridX: 0, gridY: 0 });
  const timer = createTimer({ type: 'TIM', number: 1 }, 1000, { gridX: 1, gridY: 0 }, 'TOF');
  c1.connectsTo = [timer.id];
  const rung: Rung = { id: 'r1', startIds: [c1.id], elements: [c1, timer] };
  const compiled = parseLadder(project('tof', [rung]));

  let state = createEmptyState();
  state.inputs[1] = true;
  state = scan(compiled, state, 1);
  console.log('powered -> TIM1.done =', state.timers[1]?.done, '(expect true — TOF is instant-on)');

  state.inputs[1] = false;
  state = scan(compiled, state, 9);
  console.log('9 scans after power lost (900ms of 1000ms) -> done =', state.timers[1]?.done, '(expect true — still delaying)');

  state = scan(compiled, state, 1);
  console.log('10th scan (1000ms elapsed) -> done =', state.timers[1]?.done, '(expect false)');
}

// ── 4. TP (Pulse Timer) ─────────────────────────────────────────────────
log('TP Timer (preset 500ms, 100ms/scan = 5 scans)');
{
  const c1 = createContact({ type: 'I', number: 1 }, 'NO', { gridX: 0, gridY: 0 });
  const timer = createTimer({ type: 'TIM', number: 2 }, 500, { gridX: 1, gridY: 0 }, 'TP');
  c1.connectsTo = [timer.id];
  const rung: Rung = { id: 'r1', startIds: [c1.id], elements: [c1, timer] };
  const compiled = parseLadder(project('tp', [rung]));

  let state = createEmptyState();
  state.inputs[1] = true; // rising edge -> pulse starts
  state = scan(compiled, state, 1);
  console.log('rising edge -> TIM2.done =', state.timers[2]?.done, '(expect true — pulse started)');

  state.inputs[1] = false; // released early, mid-pulse
  state = scan(compiled, state, 2);
  console.log('released early, 2 more scans (300ms of 500ms) -> done =', state.timers[2]?.done, '(expect true — pulse ignores early release)');

  state = scan(compiled, state, 2);
  console.log('2 more scans (500ms total) -> done =', state.timers[2]?.done, '(expect false — pulse complete)');
}

// ── 5. CTD (Count Down Counter) ─────────────────────────────────────────
log('CTD Counter (preset 3)');
{
  const c1 = createContact({ type: 'I', number: 1 }, 'NO', { gridX: 0, gridY: 0 });
  const counter = createCounter({ type: 'CTU', number: 1 }, 3, { gridX: 1, gridY: 0 }, { type: 'I', number: 2 }, 'CTD');
  c1.connectsTo = [counter.id];
  const rung: Rung = { id: 'r1', startIds: [c1.id], elements: [c1, counter] };
  const compiled = parseLadder(project('ctd', [rung]));

  let state = createEmptyState();
  console.log('initial accumulated =', state.counters[1]?.accumulatedCount, '(expect undefined — not yet scanned once)');
  state = scan(compiled, state, 1);
  console.log('after 1st scan (no pulse yet) -> accumulated =', state.counters[1]?.accumulatedCount, '(expect 3 — CTD loads full)');

  for (const v of [true, false, true, false, true, false]) {
    state.inputs[1] = v;
    state = scan(compiled, state, 1);
  }
  console.log('after 3 pulses -> accumulated =', state.counters[1]?.accumulatedCount, 'done =', state.counters[1]?.done, '(expect 0, true)');

  state.inputs[2] = true; // reset
  state = scan(compiled, state, 1);
  console.log('reset -> accumulated =', state.counters[1]?.accumulatedCount, 'done =', state.counters[1]?.done, '(expect 3, false — reloaded)');
}

// ── 6. Edge Detection (RISING_EDGE / FALLING_EDGE contacts) ─────────────
log('Edge Detection Contacts');
{
  const rising = createContact({ type: 'I', number: 1 }, 'RISING_EDGE', { gridX: 0, gridY: 0 });
  const coilRising = createCoil({ type: 'O', number: 5 }, { gridX: 1, gridY: 0 });
  rising.connectsTo = [coilRising.id];
  const rungRising: Rung = { id: 'rRising', startIds: [rising.id], elements: [rising, coilRising] };

  const falling = createContact({ type: 'I', number: 1 }, 'FALLING_EDGE', { gridX: 0, gridY: 0 });
  const coilFalling = createCoil({ type: 'O', number: 6 }, { gridX: 1, gridY: 0 });
  falling.connectsTo = [coilFalling.id];
  const rungFalling: Rung = { id: 'rFalling', startIds: [falling.id], elements: [falling, coilFalling] };

  const compiled = parseLadder(project('edge', [rungRising, rungFalling]));
  let state = createEmptyState();

  state.inputs[1] = true; // rising edge
  state = scan(compiled, state, 1);
  console.log('I1 rising edge -> O5 =', state.outputs[1] === undefined ? state.outputs[5] : state.outputs[5], '(expect true, one-shot)');

  state = scan(compiled, state, 1);
  console.log('next scan, I1 still true -> O5 =', state.outputs[5], '(expect false — one-shot already consumed)');

  state.inputs[1] = false; // falling edge
  state = scan(compiled, state, 1);
  console.log('I1 falling edge -> O6 =', state.outputs[6], '(expect true, one-shot)');

  state = scan(compiled, state, 1);
  console.log('next scan, I1 still false -> O6 =', state.outputs[6], '(expect false)');
}

// ── 7. Duplicate Address Validation ─────────────────────────────────────
log('Duplicate Address Validation');
{
  // Two NORMAL coils on the same output, different rungs -> must reject.
  const c1 = createContact({ type: 'I', number: 1 }, 'NO', { gridX: 0, gridY: 0 });
  const coilA = createCoil({ type: 'O', number: 9 }, { gridX: 1, gridY: 0 });
  c1.connectsTo = [coilA.id];
  const rungA: Rung = { id: 'rA', startIds: [c1.id], elements: [c1, coilA] };

  const c2 = createContact({ type: 'I', number: 2 }, 'NO', { gridX: 0, gridY: 0 });
  const coilB = createCoil({ type: 'O', number: 9 }, { gridX: 1, gridY: 0 });
  c2.connectsTo = [coilB.id];
  const rungB: Rung = { id: 'rB', startIds: [c2.id], elements: [c2, coilB] };

  try {
    parseLadder(project('dup-normal-coil', [rungA, rungB]));
    console.log('ERROR: duplicate NORMAL coil was NOT rejected (bug)');
  } catch (err) {
    console.log('duplicate NORMAL coil correctly rejected:', (err as Error).message);
  }

  // Two Timer blocks claiming the same TIM address -> must reject.
  const ci = createContact({ type: 'I', number: 1 }, 'NO', { gridX: 0, gridY: 0 });
  const timerX = createTimer({ type: 'TIM', number: 9 }, 1000, { gridX: 1, gridY: 0 });
  ci.connectsTo = [timerX.id];
  const rungX: Rung = { id: 'rX', startIds: [ci.id], elements: [ci, timerX] };

  const cj = createContact({ type: 'I', number: 2 }, 'NO', { gridX: 0, gridY: 0 });
  const timerY = createTimer({ type: 'TIM', number: 9 }, 2000, { gridX: 1, gridY: 0 });
  cj.connectsTo = [timerY.id];
  const rungY: Rung = { id: 'rY', startIds: [cj.id], elements: [cj, timerY] };

  try {
    parseLadder(project('dup-timer', [rungX, rungY]));
    console.log('ERROR: duplicate Timer address was NOT rejected (bug)');
  } catch (err) {
    console.log('duplicate Timer address correctly rejected:', (err as Error).message);
  }

  // SET + RESET sharing the same address -> must NOT reject (valid pattern).
  const cs = createContact({ type: 'I', number: 1 }, 'NO', { gridX: 0, gridY: 0 });
  const setC = createCoil({ type: 'O', number: 10 }, { gridX: 1, gridY: 0 }, 'SET');
  cs.connectsTo = [setC.id];
  const rungS: Rung = { id: 'rS', startIds: [cs.id], elements: [cs, setC] };

  const cr = createContact({ type: 'I', number: 2 }, 'NO', { gridX: 0, gridY: 0 });
  const resetC = createCoil({ type: 'O', number: 10 }, { gridX: 1, gridY: 0 }, 'RESET');
  cr.connectsTo = [resetC.id];
  const rungR: Rung = { id: 'rR', startIds: [cr.id], elements: [cr, resetC] };

  try {
    parseLadder(project('set-reset-same-address', [rungS, rungR]));
    console.log('SET+RESET sharing one address correctly ALLOWED (valid latching pattern)');
  } catch (err) {
    console.log('ERROR: SET+RESET pattern was wrongly rejected (bug):', (err as Error).message);
  }
}

console.log('\nAll Phase 5 examples executed.\n');
