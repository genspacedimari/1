/**
 * Example Simulation — a standalone script (no React, no browser) that
 * exercises the engine end-to-end: parse -> scan -> inspect state.
 *
 * Run it directly with:  npx tsx src/simulator/examples/runExample.ts
 *
 * Uses relative imports (not the '@/' alias) so it can run standalone under
 * tsx/ts-node without depending on Vite's resolver.
 */
import { parseLadder } from '../parser/parseLadder';
import { runScanCycle } from '../engine/scanCycle';
import { createEmptyState } from '../types/plcState';
import type { PlcState } from '../types/plcState';
import { EXAMPLES } from '../models/examples';

function log(title: string) {
  console.log(`\n=== ${title} ===`);
}

function scanUntil(
  compiled: ReturnType<typeof parseLadder>,
  state: PlcState,
  scans: number,
  scanIntervalMs = 100
): PlcState {
  let current = state;
  for (let i = 0; i < scans; i++) {
    const result = runScanCycle(compiled, current, scanIntervalMs);
    current = result.state;
  }
  return current;
}

// ── 1. Simple: I1 -> O1 ────────────────────────────────────────────────
log('Simple (I1 -> O1)');
{
  const compiled = parseLadder(EXAMPLES.simple);
  let state = createEmptyState();
  state.inputs[1] = false;
  state = scanUntil(compiled, state, 1);
  console.log('I1=false ->', 'O1 =', state.outputs[1], '(expect false)');

  state.inputs[1] = true;
  state = scanUntil(compiled, state, 1);
  console.log('I1=true  ->', 'O1 =', state.outputs[1], '(expect true)');
}

// ── 2. Series: I1 AND I2 -> O1 ─────────────────────────────────────────
log('Series (I1 AND I2 -> O1)');
{
  const compiled = parseLadder(EXAMPLES.series);
  let state = createEmptyState();

  state.inputs[1] = true;
  state.inputs[2] = false;
  state = scanUntil(compiled, state, 1);
  console.log('I1=T I2=F ->', 'O1 =', state.outputs[1], '(expect false)');

  state.inputs[2] = true;
  state = scanUntil(compiled, state, 1);
  console.log('I1=T I2=T ->', 'O1 =', state.outputs[1], '(expect true)');
}

// ── 3. Parallel: I1 OR I2 -> O1 ────────────────────────────────────────
log('Parallel (I1 OR I2 -> O1)');
{
  const compiled = parseLadder(EXAMPLES.parallel);
  let state = createEmptyState();

  state.inputs[1] = false;
  state.inputs[2] = false;
  state = scanUntil(compiled, state, 1);
  console.log('I1=F I2=F ->', 'O1 =', state.outputs[1], '(expect false)');

  state.inputs[2] = true;
  state = scanUntil(compiled, state, 1);
  console.log('I1=F I2=T ->', 'O1 =', state.outputs[1], '(expect true, via parallel path)');
}

// ── 4. Timer: TON 2000ms ───────────────────────────────────────────────
log('Timer (TON 2000ms, 100ms/scan)');
{
  const compiled = parseLadder(EXAMPLES.timer);
  let state = createEmptyState();
  state.inputs[1] = true;

  state = scanUntil(compiled, state, 10); // 10 * 100ms = 1000ms — not done yet
  console.log(
    `after 1000ms -> TIM1.accumulated=${state.timers[1]?.accumulatedMs} done=${state.timers[1]?.done} O1=${state.outputs[1]} (expect done=false, O1=false)`
  );

  state = scanUntil(compiled, state, 10); // another 1000ms -> total 2000ms
  console.log(
    `after 2000ms -> TIM1.accumulated=${state.timers[1]?.accumulatedMs} done=${state.timers[1]?.done} O1=${state.outputs[1]} (expect done=true; O1 lags one scan behind DN, see note below)`
  );

  state = scanUntil(compiled, state, 1); // one more scan lets rung 2 see the now-true DN bit
  console.log(`after 1 more scan -> O1=${state.outputs[1]} (expect true)`);

  state.inputs[1] = false;
  state = scanUntil(compiled, state, 1);
  console.log(
    `I1 released -> TIM1.accumulated=${state.timers[1]?.accumulatedMs} done=${state.timers[1]?.done} (expect 0, false — non-retentive)`
  );
}

// ── 5. Counter: CTU preset 3, with reset ───────────────────────────────
log('Counter (CTU preset 3)');
{
  const compiled = parseLadder(EXAMPLES.counter);
  let state = createEmptyState();

  // Three rising edges on I1: off->on->off->on->off->on
  const pulses = [true, false, true, false, true, false];
  for (const value of pulses) {
    state.inputs[1] = value;
    state = scanUntil(compiled, state, 1);
  }
  console.log(
    `after 3 pulses -> CTU1.accumulated=${state.counters[1]?.accumulatedCount} done=${state.counters[1]?.done} (expect 3, true)`
  );

  state = scanUntil(compiled, state, 1);
  console.log(`one more scan -> O1=${state.outputs[1]} (expect true)`);

  state.inputs[2] = true; // reset
  state = scanUntil(compiled, state, 1);
  console.log(
    `I2 (reset)=true -> CTU1.accumulated=${state.counters[1]?.accumulatedCount} done=${state.counters[1]?.done} (expect 0, false)`
  );
}

// ── 6. Memory latch: I1 -> M1, M1 -> O1 ────────────────────────────────
log('Memory (I1 -> M1 -> O1, cross-rung)');
{
  const compiled = parseLadder(EXAMPLES.memory);
  let state = createEmptyState();

  state.inputs[1] = true;
  state = scanUntil(compiled, state, 1);
  console.log(`I1=true, 1 scan -> M1=${state.memory[1]} O1=${state.outputs[1]} (expect M1=true, O1 still false — one scan behind)`);

  state = scanUntil(compiled, state, 1);
  console.log(`1 more scan -> O1=${state.outputs[1]} (expect true)`);

  state.inputs[1] = false;
  state = scanUntil(compiled, state, 2);
  console.log(`I1=false, 2 scans -> M1=${state.memory[1]} O1=${state.outputs[1]} (expect both false)`);
}

console.log('\nAll examples executed.\n');
