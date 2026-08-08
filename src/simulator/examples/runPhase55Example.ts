/**
 * Phase 5.5 — PLC Runtime Verification & Debugger.
 *
 * Runs every required Automated Runtime Test from the brief (Start/Stop,
 * Self Holding, Series AND, Parallel OR, Nested Branch, TON, TOF, TP,
 * CTU, CTD, RES, SET, RESET, DIFU, DIFD) against the real, unmodified
 * engine and prints PASS/FAIL + execution time for each — the same
 * `runAllRuntimeTests()` the in-app Debugger's "Run Automated Runtime
 * Test" panel calls, so the CLI and the UI can never drift apart.
 *
 * Run with: npx tsx src/simulator/examples/runPhase55Example.ts
 */
import { runAllRuntimeTests } from '../engine/runtimeVerification';

console.log('\n=== GENSPACE PLC — Phase 5.5 Automated Runtime Test ===\n');

const results = runAllRuntimeTests();

for (const r of results) {
  const status = r.pass ? 'PASS' : 'FAIL';
  const icon = r.pass ? '✓' : '✗';
  console.log(`${icon} [${status}] ${r.name} — ${r.executionTimeMs.toFixed(3)}ms`);
  if (!r.pass) console.log(`    ${r.detail}`);
}

const passCount = results.filter((r) => r.pass).length;
const totalMs = results.reduce((sum, r) => sum + r.executionTimeMs, 0);

console.log(`\n${passCount}/${results.length} tests PASSED — total ${totalMs.toFixed(3)}ms\n`);
