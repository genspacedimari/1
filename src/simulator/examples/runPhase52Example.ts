/**
 * Phase 5.2 verification — the exact six scenarios requested in the brief,
 * run against the existing (unmodified) parser + scan cycle, plus a
 * multi-branch (3-way parallel) case since the brief also calls out
 * "Multiple Branch" as a requirement. No new parser, no new runtime — this
 * only exercises what Phase 2-5.1 already built, after Phase 5.2's
 * additive validation tightening (floating-element, branch-pairing,
 * duplicate-connection, static cycle detection in validateLadder.ts).
 *
 * Run with: npx tsx src/simulator/examples/runPhase52Example.ts
 */
import { createContact, createCoil } from '../models/elementFactory';
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
  return { id: `p52-${name}`, name, rungs, meta: { createdAt: now, updatedAt: now, engineVersion: '0.1.0' } };
}

function scan(compiled: CompiledLadder, state: PlcState, n = 1, ms = 100): PlcState {
  let s = state;
  for (let i = 0; i < n; i++) s = runScanCycle(compiled, s, ms).state;
  return s;
}

// ── 1. Start -> Output ──────────────────────────────────────────────────
log('1. Start -> Output (I1 -> O1)');
{
  const start = createContact({ type: 'I', number: 1 }, 'NO', { gridX: 0, gridY: 0 });
  const coil = createCoil({ type: 'O', number: 1 }, { gridX: 1, gridY: 0 });
  start.connectsTo = [coil.id];
  const compiled = parseLadder(project('start-output', [{ id: 'r1', startIds: [start.id], elements: [start, coil] }]));

  let state = createEmptyState();
  state = scan(compiled, state, 1);
  console.log('I1=OFF -> O1 =', state.outputs[1], '(expect false)');

  state.inputs[1] = true;
  state = scan(compiled, state, 1);
  console.log('I1=ON  -> O1 =', state.outputs[1], '(expect true)');

  state.inputs[1] = false;
  state = scan(compiled, state, 1);
  console.log('I1=OFF -> O1 =', state.outputs[1], '(expect false — no seal-in here, follows I1 directly)');
}

// ── 2. Start / Stop ──────────────────────────────────────────────────────
log('2. Start / Stop (NO I1 series with NC I2 -> O1, no seal-in)');
{
  const start = createContact({ type: 'I', number: 1 }, 'NO', { gridX: 0, gridY: 0 });
  const stop = createContact({ type: 'I', number: 2 }, 'NC', { gridX: 1, gridY: 0 });
  const coil = createCoil({ type: 'O', number: 1 }, { gridX: 2, gridY: 0 });
  start.connectsTo = [stop.id];
  stop.connectsTo = [coil.id];
  const compiled = parseLadder(project('start-stop', [{ id: 'r1', startIds: [start.id], elements: [start, stop, coil] }]));

  let state = createEmptyState();
  state.inputs[1] = true; // Start held
  state = scan(compiled, state, 1);
  console.log('Start=ON, Stop=OFF -> O1 =', state.outputs[1], '(expect true)');

  state.inputs[2] = true; // Stop pressed
  state = scan(compiled, state, 1);
  console.log('Start=ON, Stop=ON  -> O1 =', state.outputs[1], '(expect false — NC breaks the circuit)');

  state.inputs[2] = false; // Stop released
  state = scan(compiled, state, 1);
  console.log('Start=ON, Stop=OFF -> O1 =', state.outputs[1], '(expect true again — no seal-in means it just follows Start)');
}

// ── 3. Self-Holding (Seal-In) ────────────────────────────────────────────
log('3. Self-Holding (Start I1 parallel with seal contact reading Q1, NC Stop I2, -> Coil Q1)');
{
  const start = createContact({ type: 'I', number: 1 }, 'NO', { gridX: 0, gridY: 0 });
  const seal = createContact({ type: 'O', number: 1 }, 'NO', { gridX: 0, gridY: 1 });
  const stop = createContact({ type: 'I', number: 2 }, 'NC', { gridX: 1, gridY: 0 });
  const coil = createCoil({ type: 'O', number: 1 }, { gridX: 2, gridY: 0 });
  start.connectsTo = [stop.id];
  seal.connectsTo = [stop.id];
  stop.connectsTo = [coil.id];
  const compiled = parseLadder(
    project('self-holding', [{ id: 'r1', startIds: [start.id, seal.id], elements: [start, seal, stop, coil] }])
  );

  let state = createEmptyState();
  state.inputs[1] = true; // press Start
  state = scan(compiled, state, 1);
  console.log('Start pressed      -> Q1 =', state.outputs[1], '(expect true)');

  state.inputs[1] = false; // release Start
  state = scan(compiled, state, 1);
  console.log('Start released     -> Q1 =', state.outputs[1], '(expect true — sealed in via its own Q1 contact)');

  state.inputs[2] = true; // press Stop
  state = scan(compiled, state, 1);
  console.log('Stop pressed       -> Q1 =', state.outputs[1], '(expect false)');

  state.inputs[2] = false;
  state = scan(compiled, state, 1);
  console.log('Stop released      -> Q1 =', state.outputs[1], '(expect false — seal was already broken)');
}

// ── 4. Series (AND) ──────────────────────────────────────────────────────
log('4. Series / AND (I1 AND I2 AND I3 -> O1)');
{
  const c1 = createContact({ type: 'I', number: 1 }, 'NO', { gridX: 0, gridY: 0 });
  const c2 = createContact({ type: 'I', number: 2 }, 'NO', { gridX: 1, gridY: 0 });
  const c3 = createContact({ type: 'I', number: 3 }, 'NO', { gridX: 2, gridY: 0 });
  const coil = createCoil({ type: 'O', number: 1 }, { gridX: 3, gridY: 0 });
  c1.connectsTo = [c2.id];
  c2.connectsTo = [c3.id];
  c3.connectsTo = [coil.id];
  const compiled = parseLadder(project('series', [{ id: 'r1', startIds: [c1.id], elements: [c1, c2, c3, coil] }]));

  let state = createEmptyState();
  for (const [i1, i2, i3] of [
    [true, true, false],
    [true, true, true],
  ] as const) {
    state.inputs[1] = i1;
    state.inputs[2] = i2;
    state.inputs[3] = i3;
    state = scan(compiled, state, 1);
    console.log(`I1=${i1} I2=${i2} I3=${i3} -> O1 =`, state.outputs[1], i1 && i2 && i3 ? '(expect true)' : '(expect false)');
  }
}

// ── 5. Parallel (OR) ─────────────────────────────────────────────────────
log('5. Parallel / OR (I1 OR I2 -> O1)');
{
  const c1 = createContact({ type: 'I', number: 1 }, 'NO', { gridX: 0, gridY: 0 });
  const c2 = createContact({ type: 'I', number: 2 }, 'NO', { gridX: 0, gridY: 1 });
  const coil = createCoil({ type: 'O', number: 1 }, { gridX: 1, gridY: 0 });
  c1.connectsTo = [coil.id];
  c2.connectsTo = [coil.id];
  const compiled = parseLadder(
    project('parallel', [{ id: 'r1', startIds: [c1.id, c2.id], elements: [c1, c2, coil] }])
  );

  let state = createEmptyState();
  for (const [i1, i2] of [
    [false, false],
    [true, false],
    [false, true],
  ] as const) {
    state.inputs[1] = i1;
    state.inputs[2] = i2;
    state = scan(compiled, state, 1);
    console.log(`I1=${i1} I2=${i2} -> O1 =`, state.outputs[1], i1 || i2 ? '(expect true)' : '(expect false)');
  }
}

// ── 6. Nested Branch: I1 AND (I2 OR (I3 AND I4)) -> O1 ─────────────────
log('6. Nested Branch (I1 AND (I2 OR (I3 AND I4)) -> O1)');
{
  const c1 = createContact({ type: 'I', number: 1 }, 'NO', { gridX: 0, gridY: 0 });
  // Outer branch: two parallel paths both feeding into the coil.
  const c2 = createContact({ type: 'I', number: 2 }, 'NO', { gridX: 1, gridY: 0 }); // path A (direct)
  const c3 = createContact({ type: 'I', number: 3 }, 'NO', { gridX: 1, gridY: 1 }); // path B, step 1
  const c4 = createContact({ type: 'I', number: 4 }, 'NO', { gridX: 2, gridY: 1 }); // path B, step 2 (nested series)
  const coil = createCoil({ type: 'O', number: 1 }, { gridX: 3, gridY: 0 });

  c1.connectsTo = [c2.id, c3.id]; // fan-out: c1 feeds BOTH parallel paths
  c2.connectsTo = [coil.id]; // path A rejoins directly at the coil
  c3.connectsTo = [c4.id]; // path B is a nested series (c3 AND c4)...
  c4.connectsTo = [coil.id]; // ...which also rejoins at the same coil

  const compiled = parseLadder(
    project('nested-branch', [{ id: 'r1', startIds: [c1.id], elements: [c1, c2, c3, c4, coil] }])
  );

  const cases = [
    { i1: false, i2: true, i3: true, i4: true, expect: false, note: 'I1 gates everything' },
    { i1: true, i2: true, i3: false, i4: false, expect: true, note: 'path A (I2) satisfies the OR' },
    { i1: true, i2: false, i3: true, i4: true, expect: true, note: 'path B (I3 AND I4) satisfies the OR' },
    { i1: true, i2: false, i3: true, i4: false, expect: false, note: 'path B incomplete, path A false' },
  ];

  let state = createEmptyState();
  for (const c of cases) {
    state.inputs[1] = c.i1;
    state.inputs[2] = c.i2;
    state.inputs[3] = c.i3;
    state.inputs[4] = c.i4;
    state = scan(compiled, state, 1);
    const pass = state.outputs[1] === c.expect;
    console.log(
      `I1=${c.i1} I2=${c.i2} I3=${c.i3} I4=${c.i4} -> O1 = ${state.outputs[1]} (expect ${c.expect} — ${c.note}) ${pass ? '✓' : '✗ MISMATCH'}`
    );
  }
}

// ── Bonus: Multi Branch (3-way parallel) ────────────────────────────────
log('Bonus: Multi Branch (I1 OR I2 OR I3 -> O1)');
{
  const c1 = createContact({ type: 'I', number: 1 }, 'NO', { gridX: 0, gridY: 0 });
  const c2 = createContact({ type: 'I', number: 2 }, 'NO', { gridX: 0, gridY: 1 });
  const c3 = createContact({ type: 'I', number: 3 }, 'NO', { gridX: 0, gridY: 2 });
  const coil = createCoil({ type: 'O', number: 1 }, { gridX: 1, gridY: 0 });
  c1.connectsTo = [coil.id];
  c2.connectsTo = [coil.id];
  c3.connectsTo = [coil.id];
  const compiled = parseLadder(
    project('multi-branch', [{ id: 'r1', startIds: [c1.id, c2.id, c3.id], elements: [c1, c2, c3, coil] }])
  );

  let state = createEmptyState();
  state = scan(compiled, state, 1);
  console.log('all OFF -> O1 =', state.outputs[1], '(expect false)');

  state.inputs[3] = true; // only the third (last) parallel path
  state = scan(compiled, state, 1);
  console.log('only I3=ON -> O1 =', state.outputs[1], '(expect true — 3-way OR)');
}

console.log('\nAll Phase 5.2 scenarios executed.\n');
