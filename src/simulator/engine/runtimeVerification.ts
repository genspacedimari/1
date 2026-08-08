import { createContact, createCoil, createTimer, createCounter, createInstructionCoil } from '@/simulator/models/elementFactory';
import { parseLadder } from '@/simulator/parser/parseLadder';
import { runScanCycle } from '@/simulator/engine/scanCycle';
import { createEmptyState, type PlcState } from '@/simulator/types/plcState';
import type { LadderProject, Rung } from '@/simulator/types/ladder';
import type { CompiledLadder } from '@/simulator/types/runtime';

/**
 * Phase 5.5 — Automated Runtime Test.
 *
 * Every test the brief lists (Start/Stop, Self Holding, Series AND,
 * Parallel OR, Nested Branch, TON, TOF, TP, CTU, CTD, RES, SET, RESET,
 * DIFU, DIFD), run against the real, unmodified engine — `parseLadder`,
 * `runScanCycle`, nothing mocked or stubbed. Each test returns PASS/FAIL
 * plus its own execution time, exactly like the brief asks for, so both
 * the CLI script (`examples/runPhase55Example.ts`) and the in-app
 * Debugger's "Run Automated Runtime Test" button share one source of
 * truth instead of two copies of the same assertions.
 */

export interface RuntimeTestResult {
  name: string;
  pass: boolean;
  detail: string;
  executionTimeMs: number;
}

function project(name: string, rungs: Rung[]): LadderProject {
  const now = new Date().toISOString();
  return { id: `p55-${name}`, name, rungs, meta: { createdAt: now, updatedAt: now, engineVersion: '0.1.0' } };
}

function scanN(compiled: CompiledLadder, state: PlcState, n: number, ms = 100): PlcState {
  let s = state;
  for (let i = 0; i < n; i++) s = runScanCycle(compiled, s, ms).state;
  return s;
}

function timed(name: string, fn: () => { pass: boolean; detail: string }): RuntimeTestResult {
  const start = performance.now();
  let result: { pass: boolean; detail: string };
  try {
    result = fn();
  } catch (err) {
    result = { pass: false, detail: err instanceof Error ? err.message : String(err) };
  }
  const executionTimeMs = performance.now() - start;
  return { name, pass: result.pass, detail: result.detail, executionTimeMs };
}

// ── Start / Stop ────────────────────────────────────────────────────────
function testStartStop(): RuntimeTestResult {
  return timed('Start / Stop', () => {
    const c = createContact({ type: 'I', number: 1 }, 'NO', { gridX: 0, gridY: 0 });
    const coil = createCoil({ type: 'O', number: 1 }, { gridX: 1, gridY: 0 });
    c.connectsTo = [coil.id];
    const compiled = parseLadder(project('start-stop', [{ id: 'r1', startIds: [c.id], elements: [c, coil] }]));

    let state = createEmptyState();
    state = scanN(compiled, state, 1); // I1 off -> O1 must be off
    const offOk = state.outputs[1] === false;

    state.inputs[1] = true;
    state = scanN(compiled, state, 1); // I1 on -> O1 must be on
    const onOk = state.outputs[1] === true;

    state.inputs[1] = false;
    state = scanN(compiled, state, 1); // I1 off again -> O1 must drop
    const stopOk = state.outputs[1] === false;

    return {
      pass: offOk && onOk && stopOk,
      detail: `off=${offOk} on=${onOk} stop=${stopOk}`,
    };
  });
}

// ── Self Holding: START / Seal-In / STOP / Reset ──────────────────────────
function testSelfHolding(): RuntimeTestResult {
  return timed('Self Holding (Start-Seal-Stop)', () => {
    // START (I1, NO) OR M1 (seal-in) -> AND STOP (I2, NC) -> M1
    const start = createContact({ type: 'I', number: 1 }, 'NO', { gridX: 0, gridY: 0 });
    const seal = createContact({ type: 'M', number: 1 }, 'NO', { gridX: 0, gridY: 1 });
    const stop = createContact({ type: 'I', number: 2 }, 'NC', { gridX: 1, gridY: 0 });
    const coil = createCoil({ type: 'M', number: 1 }, { gridX: 2, gridY: 0 });
    start.connectsTo = [stop.id];
    seal.connectsTo = [stop.id];
    stop.connectsTo = [coil.id];
    const compiled = parseLadder(
      project('self-holding', [{ id: 'r1', startIds: [start.id, seal.id], elements: [start, seal, stop, coil] }])
    );

    let state = createEmptyState();
    state = scanN(compiled, state, 1);
    const initialOff = state.memory[1] === false;

    state.inputs[1] = true; // START pressed
    state = scanN(compiled, state, 1);
    const latchedOnStart = state.memory[1] === true;

    state.inputs[1] = false; // START released — seal-in must hold it
    state = scanN(compiled, state, 1);
    const heldAfterRelease = state.memory[1] === true;

    state.inputs[2] = true; // STOP pressed (NC contact opens)
    state = scanN(compiled, state, 1);
    const droppedOnStop = state.memory[1] === false;

    state.inputs[2] = false; // STOP released — must stay off (no seal-in path anymore)
    state = scanN(compiled, state, 1);
    const staysOffAfterReset = state.memory[1] === false;

    const pass = initialOff && latchedOnStart && heldAfterRelease && droppedOnStop && staysOffAfterReset;
    return {
      pass,
      detail: `initialOff=${initialOff} latchedOnStart=${latchedOnStart} heldAfterRelease=${heldAfterRelease} droppedOnStop=${droppedOnStop} staysOffAfterReset=${staysOffAfterReset}`,
    };
  });
}

// ── Series (AND) ────────────────────────────────────────────────────────
function testSeriesAnd(): RuntimeTestResult {
  return timed('Series (AND)', () => {
    const c1 = createContact({ type: 'I', number: 1 }, 'NO', { gridX: 0, gridY: 0 });
    const c2 = createContact({ type: 'I', number: 2 }, 'NO', { gridX: 1, gridY: 0 });
    const coil = createCoil({ type: 'O', number: 1 }, { gridX: 2, gridY: 0 });
    c1.connectsTo = [c2.id];
    c2.connectsTo = [coil.id];
    const compiled = parseLadder(project('series-and', [{ id: 'r1', startIds: [c1.id], elements: [c1, c2, coil] }]));

    const cases: Array<[boolean, boolean, boolean]> = [
      [false, false, false],
      [true, false, false],
      [false, true, false],
      [true, true, true],
    ];
    let state = createEmptyState();
    let allOk = true;
    for (const [i1, i2, expect] of cases) {
      state.inputs[1] = i1;
      state.inputs[2] = i2;
      state = scanN(compiled, state, 1);
      if (state.outputs[1] !== expect) allOk = false;
    }
    return { pass: allOk, detail: allOk ? 'AND truth table matched' : 'AND truth table mismatch' };
  });
}

// ── Parallel (OR) ───────────────────────────────────────────────────────
function testParallelOr(): RuntimeTestResult {
  return timed('Parallel (OR)', () => {
    const c1 = createContact({ type: 'I', number: 1 }, 'NO', { gridX: 0, gridY: 0 });
    const c2 = createContact({ type: 'I', number: 2 }, 'NO', { gridX: 0, gridY: 1 });
    const coil = createCoil({ type: 'O', number: 1 }, { gridX: 1, gridY: 0 });
    c1.connectsTo = [coil.id];
    c2.connectsTo = [coil.id];
    const compiled = parseLadder(
      project('parallel-or', [{ id: 'r1', startIds: [c1.id, c2.id], elements: [c1, c2, coil] }])
    );

    const cases: Array<[boolean, boolean, boolean]> = [
      [false, false, false],
      [true, false, true],
      [false, true, true],
      [true, true, true],
    ];
    let state = createEmptyState();
    let allOk = true;
    for (const [i1, i2, expect] of cases) {
      state.inputs[1] = i1;
      state.inputs[2] = i2;
      state = scanN(compiled, state, 1);
      if (state.outputs[1] !== expect) allOk = false;
    }
    return { pass: allOk, detail: allOk ? 'OR truth table matched' : 'OR truth table mismatch' };
  });
}

// ── Nested Branch: I1 AND (I2 OR (I3 AND I4)) -> O1 ─────────────────────
function testNestedBranch(): RuntimeTestResult {
  return timed('Nested Branch', () => {
    const c1 = createContact({ type: 'I', number: 1 }, 'NO', { gridX: 0, gridY: 0 });
    const c2 = createContact({ type: 'I', number: 2 }, 'NO', { gridX: 1, gridY: 0 });
    const c3 = createContact({ type: 'I', number: 3 }, 'NO', { gridX: 1, gridY: 1 });
    const c4 = createContact({ type: 'I', number: 4 }, 'NO', { gridX: 2, gridY: 1 });
    const coil = createCoil({ type: 'O', number: 1 }, { gridX: 3, gridY: 0 });
    c1.connectsTo = [c2.id, c3.id];
    c2.connectsTo = [coil.id];
    c3.connectsTo = [c4.id];
    c4.connectsTo = [coil.id];
    const compiled = parseLadder(
      project('nested-branch', [{ id: 'r1', startIds: [c1.id], elements: [c1, c2, c3, c4, coil] }])
    );

    const cases = [
      { i1: false, i2: true, i3: true, i4: true, expect: false },
      { i1: true, i2: true, i3: false, i4: false, expect: true },
      { i1: true, i2: false, i3: true, i4: true, expect: true },
      { i1: true, i2: false, i3: true, i4: false, expect: false },
    ];
    let state = createEmptyState();
    let allOk = true;
    for (const c of cases) {
      state.inputs[1] = c.i1;
      state.inputs[2] = c.i2;
      state.inputs[3] = c.i3;
      state.inputs[4] = c.i4;
      state = scanN(compiled, state, 1);
      if (state.outputs[1] !== c.expect) allOk = false;
    }
    return { pass: allOk, detail: allOk ? 'nested AND/OR matched' : 'nested AND/OR mismatch' };
  });
}

// ── TON ─────────────────────────────────────────────────────────────────
function testTON(): RuntimeTestResult {
  return timed('Timer TON', () => {
    const c = createContact({ type: 'I', number: 1 }, 'NO', { gridX: 0, gridY: 0 });
    const timer = createTimer({ type: 'TIM', number: 1 }, 300, { gridX: 1, gridY: 0 });
    c.connectsTo = [timer.id];
    const compiled = parseLadder(project('ton', [{ id: 'r1', startIds: [c.id], elements: [c, timer] }]));

    let state = createEmptyState();
    state.inputs[1] = true;
    state = scanN(compiled, state, 2, 100); // 200ms < 300ms preset
    const notDoneYet = state.timers[1].done === false;
    state = scanN(compiled, state, 1, 100); // 300ms reached
    const doneAtPreset = state.timers[1].done === true;
    state.inputs[1] = false;
    state = scanN(compiled, state, 1, 100); // non-retentive reset
    const resetsOnDeenergize = state.timers[1].done === false && state.timers[1].accumulatedMs === 0;

    const pass = notDoneYet && doneAtPreset && resetsOnDeenergize;
    return { pass, detail: `notDoneYet=${notDoneYet} doneAtPreset=${doneAtPreset} resetsOnDeenergize=${resetsOnDeenergize}` };
  });
}

// ── TOF ─────────────────────────────────────────────────────────────────
function testTOF(): RuntimeTestResult {
  return timed('Timer TOF', () => {
    const c = createContact({ type: 'I', number: 1 }, 'NO', { gridX: 0, gridY: 0 });
    const timer = createTimer({ type: 'TIM', number: 1 }, 300, { gridX: 1, gridY: 0 }, 'TOF');
    c.connectsTo = [timer.id];
    const compiled = parseLadder(project('tof', [{ id: 'r1', startIds: [c.id], elements: [c, timer] }]));

    let state = createEmptyState();
    state.inputs[1] = true;
    state = scanN(compiled, state, 1, 100);
    const doneImmediatelyWhilePowered = state.timers[1].done === true;

    state.inputs[1] = false; // off-delay starts
    state = scanN(compiled, state, 2, 100); // 200ms < 300ms
    const stillDoneDuringDelay = state.timers[1].done === true;

    state = scanN(compiled, state, 1, 100); // 300ms reached
    const dropsAfterDelay = state.timers[1].done === false;

    const pass = doneImmediatelyWhilePowered && stillDoneDuringDelay && dropsAfterDelay;
    return {
      pass,
      detail: `doneImmediatelyWhilePowered=${doneImmediatelyWhilePowered} stillDoneDuringDelay=${stillDoneDuringDelay} dropsAfterDelay=${dropsAfterDelay}`,
    };
  });
}

// ── TP ──────────────────────────────────────────────────────────────────
function testTP(): RuntimeTestResult {
  return timed('Timer TP', () => {
    const c = createContact({ type: 'I', number: 1 }, 'NO', { gridX: 0, gridY: 0 });
    const timer = createTimer({ type: 'TIM', number: 1 }, 300, { gridX: 1, gridY: 0 }, 'TP');
    c.connectsTo = [timer.id];
    const compiled = parseLadder(project('tp', [{ id: 'r1', startIds: [c.id], elements: [c, timer] }]));

    let state = createEmptyState();
    state.inputs[1] = true;
    state = scanN(compiled, state, 1, 100); // rising edge starts the pulse
    const pulseStarted = state.timers[1].done === true;

    state.inputs[1] = false; // releasing early must NOT cut the pulse short
    state = scanN(compiled, state, 1, 100); // 200ms elapsed
    const pulseContinuesAfterRelease = state.timers[1].done === true;

    state = scanN(compiled, state, 1, 100); // 300ms elapsed -> pulse ends
    const pulseEndsAtPreset = state.timers[1].done === false;

    const pass = pulseStarted && pulseContinuesAfterRelease && pulseEndsAtPreset;
    return { pass, detail: `pulseStarted=${pulseStarted} pulseContinuesAfterRelease=${pulseContinuesAfterRelease} pulseEndsAtPreset=${pulseEndsAtPreset}` };
  });
}

// ── CTU ─────────────────────────────────────────────────────────────────
function testCTU(): RuntimeTestResult {
  return timed('Counter CTU', () => {
    const c = createContact({ type: 'I', number: 1 }, 'NO', { gridX: 0, gridY: 0 });
    const counter = createCounter({ type: 'CTU', number: 1 }, 3, { gridX: 1, gridY: 0 });
    c.connectsTo = [counter.id];
    const compiled = parseLadder(project('ctu', [{ id: 'r1', startIds: [c.id], elements: [c, counter] }]));

    let state = createEmptyState();
    // Two rising edges while held (must NOT count every scan, only edges).
    state.inputs[1] = true;
    state = scanN(compiled, state, 3, 100); // held true for 3 scans -> only 1 edge
    const noCountEverysScan = state.counters[1].accumulatedCount === 1;

    state.inputs[1] = false;
    state = scanN(compiled, state, 1, 100);
    state.inputs[1] = true;
    state = scanN(compiled, state, 1, 100); // 2nd edge
    state.inputs[1] = false;
    state = scanN(compiled, state, 1, 100);
    state.inputs[1] = true;
    state = scanN(compiled, state, 1, 100); // 3rd edge -> reaches preset
    const doneAtPreset = state.counters[1].done === true && state.counters[1].accumulatedCount === 3;

    const pass = noCountEverysScan && doneAtPreset;
    return { pass, detail: `noCountEverysScan=${noCountEverysScan} doneAtPreset=${doneAtPreset}` };
  });
}

// ── CTD ─────────────────────────────────────────────────────────────────
function testCTD(): RuntimeTestResult {
  return timed('Counter CTD', () => {
    const c = createContact({ type: 'I', number: 1 }, 'NO', { gridX: 0, gridY: 0 });
    const counter = createCounter({ type: 'CTU', number: 1 }, 2, { gridX: 1, gridY: 0 }, undefined, 'CTD');
    c.connectsTo = [counter.id];
    const compiled = parseLadder(project('ctd', [{ id: 'r1', startIds: [c.id], elements: [c, counter] }]));

    let state = createEmptyState();
    const startsAtPreset = state.counters[1] === undefined; // not yet initialized until first scan
    state = scanN(compiled, state, 1, 100);
    const loadedAtPreset = state.counters[1].accumulatedCount === 2 && state.counters[1].done === false;

    state.inputs[1] = true;
    state = scanN(compiled, state, 1, 100); // edge 1: 2 -> 1
    const firstDecrement = state.counters[1].accumulatedCount === 1;
    state.inputs[1] = false;
    state = scanN(compiled, state, 1, 100);
    state.inputs[1] = true;
    state = scanN(compiled, state, 1, 100); // edge 2: 1 -> 0
    const doneAtZero = state.counters[1].accumulatedCount === 0 && state.counters[1].done === true;

    const pass = startsAtPreset && loadedAtPreset && firstDecrement && doneAtZero;
    return { pass, detail: `loadedAtPreset=${loadedAtPreset} firstDecrement=${firstDecrement} doneAtZero=${doneAtZero}` };
  });
}

// ── RES (Timer + Counter external reset) ─────────────────────────────────
function testRES(): RuntimeTestResult {
  return timed('RES (Timer & Counter Reset)', () => {
    const tIn = createContact({ type: 'I', number: 1 }, 'NO', { gridX: 0, gridY: 0 });
    const timer = createTimer({ type: 'TIM', number: 1 }, 300, { gridX: 1, gridY: 0 }, 'TON', { type: 'I', number: 2 });
    tIn.connectsTo = [timer.id];

    const cIn = createContact({ type: 'I', number: 3 }, 'NO', { gridX: 0, gridY: 1 });
    const counter = createCounter({ type: 'CTU', number: 1 }, 3, { gridX: 1, gridY: 1 }, { type: 'I', number: 4 });
    cIn.connectsTo = [counter.id];

    const compiled = parseLadder(
      project('res', [{ id: 'r1', startIds: [tIn.id, cIn.id], elements: [tIn, timer, cIn, counter] }])
    );

    let state = createEmptyState();
    state.inputs[1] = true;
    state.inputs[3] = true;
    state = scanN(compiled, state, 2, 100); // timer accumulating, counter counted 1 edge
    const accumulatingBeforeReset = state.timers[1].accumulatedMs > 0 && state.counters[1].accumulatedCount === 1;

    state.inputs[2] = true; // RES timer
    state.inputs[4] = true; // RES counter
    state = scanN(compiled, state, 1, 100);
    const bothClearedByRes =
      state.timers[1].accumulatedMs === 0 && state.timers[1].done === false &&
      state.counters[1].accumulatedCount === 0 && state.counters[1].done === false;

    const pass = accumulatingBeforeReset && bothClearedByRes;
    return { pass, detail: `accumulatingBeforeReset=${accumulatingBeforeReset} bothClearedByRes=${bothClearedByRes}` };
  });
}

// ── SET / RESET coils ──────────────────────────────────────────────────
function testSetReset(): RuntimeTestResult {
  return timed('SET / RESET', () => {
    const setC = createContact({ type: 'I', number: 1 }, 'NO', { gridX: 0, gridY: 0 });
    const setCoil = createCoil({ type: 'M', number: 1 }, { gridX: 1, gridY: 0 }, 'SET');
    setC.connectsTo = [setCoil.id];
    const resetC = createContact({ type: 'I', number: 2 }, 'NO', { gridX: 0, gridY: 1 });
    const resetCoil = createCoil({ type: 'M', number: 1 }, { gridX: 1, gridY: 1 }, 'RESET');
    resetC.connectsTo = [resetCoil.id];
    const compiled = parseLadder(
      project('set-reset', [{ id: 'r1', startIds: [setC.id, resetC.id], elements: [setC, setCoil, resetC, resetCoil] }])
    );

    let state = createEmptyState();
    state.inputs[1] = true;
    state = scanN(compiled, state, 1);
    const setLatches = state.memory[1] === true;

    state.inputs[1] = false; // SET input released — must stay latched
    state = scanN(compiled, state, 1);
    const staysLatchedAfterSetReleased = state.memory[1] === true;

    state.inputs[2] = true; // RESET
    state = scanN(compiled, state, 1);
    const resetClears = state.memory[1] === false;

    state.inputs[2] = false;
    state = scanN(compiled, state, 1);
    const staysOffAfterResetReleased = state.memory[1] === false;

    const pass = setLatches && staysLatchedAfterSetReleased && resetClears && staysOffAfterResetReleased;
    return {
      pass,
      detail: `setLatches=${setLatches} staysLatchedAfterSetReleased=${staysLatchedAfterSetReleased} resetClears=${resetClears} staysOffAfterResetReleased=${staysOffAfterResetReleased}`,
    };
  });
}

// ── DIFU (Differentiate Up / One Shot Rising) ────────────────────────────
function testDIFU(): RuntimeTestResult {
  return timed('DIFU (One Shot Rising)', () => {
    const c = createContact({ type: 'I', number: 1 }, 'RISING_EDGE', { gridX: 0, gridY: 0 });
    const coil = createCoil({ type: 'O', number: 1 }, { gridX: 1, gridY: 0 });
    c.connectsTo = [coil.id];
    const compiled = parseLadder(project('difu', [{ id: 'r1', startIds: [c.id], elements: [c, coil] }]));

    let state = createEmptyState();
    state.inputs[1] = true; // rising edge
    state = scanN(compiled, state, 1);
    const pulsesOnRisingEdge = state.outputs[1] === true;

    state = scanN(compiled, state, 1); // still held true — must drop after one scan
    const onlyOneScan = state.outputs[1] === false;

    state.inputs[1] = false;
    state = scanN(compiled, state, 1);
    const staysOffOnFalling = state.outputs[1] === false;

    const pass = pulsesOnRisingEdge && onlyOneScan && staysOffOnFalling;
    return { pass, detail: `pulsesOnRisingEdge=${pulsesOnRisingEdge} onlyOneScan=${onlyOneScan} staysOffOnFalling=${staysOffOnFalling}` };
  });
}

// ── DIFD (Differentiate Down / One Shot Falling) ─────────────────────────
function testDIFD(): RuntimeTestResult {
  return timed('DIFD (One Shot Falling)', () => {
    const c = createContact({ type: 'I', number: 1 }, 'FALLING_EDGE', { gridX: 0, gridY: 0 });
    const coil = createCoil({ type: 'O', number: 1 }, { gridX: 1, gridY: 0 });
    c.connectsTo = [coil.id];
    const compiled = parseLadder(project('difd', [{ id: 'r1', startIds: [c.id], elements: [c, coil] }]));

    let state = createEmptyState();
    state.inputs[1] = true;
    state = scanN(compiled, state, 1);
    const staysOffOnRising = state.outputs[1] === false;

    state.inputs[1] = false; // falling edge
    state = scanN(compiled, state, 1);
    const pulsesOnFallingEdge = state.outputs[1] === true;

    state = scanN(compiled, state, 1); // still held false — must drop after one scan
    const onlyOneScan = state.outputs[1] === false;

    const pass = staysOffOnRising && pulsesOnFallingEdge && onlyOneScan;
    return { pass, detail: `staysOffOnRising=${staysOffOnRising} pulsesOnFallingEdge=${pulsesOnFallingEdge} onlyOneScan=${onlyOneScan}` };
  });
}

// ── Bonus: an instruction-carrying coil, proving Phase 5.4's engine still
//    executes correctly under this phase's verification harness too.
function testInstructionCoil(): RuntimeTestResult {
  return timed('Instruction Coil (MOV, sanity)', () => {
    const c = createContact({ type: 'I', number: 1 }, 'NO', { gridX: 0, gridY: 0 });
    const coil = createInstructionCoil({ type: 'M', number: 5 }, { op: 'MOV', src: 1, dest: 2 }, { gridX: 1, gridY: 0 });
    c.connectsTo = [coil.id];
    const compiled = parseLadder(project('mov-sanity', [{ id: 'r1', startIds: [c.id], elements: [c, coil] }]));

    let state = createEmptyState();
    state.words[1] = 77;
    state.inputs[1] = true;
    state = scanN(compiled, state, 1);
    const pass = state.words[2] === 77;
    return { pass, detail: `D2 after MOV D1 D2 = ${state.words[2]} (expect 77)` };
  });
}

/** Runs every Phase 5.5 required test and returns structured results —
 * consumed by both the CLI script and the in-app Debugger. */
export function runAllRuntimeTests(): RuntimeTestResult[] {
  return [
    testStartStop(),
    testSelfHolding(),
    testSeriesAnd(),
    testParallelOr(),
    testNestedBranch(),
    testTON(),
    testTOF(),
    testTP(),
    testCTU(),
    testCTD(),
    testRES(),
    testSetReset(),
    testDIFU(),
    testDIFD(),
    testInstructionCoil(),
  ];
}
