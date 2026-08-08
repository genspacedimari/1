import type { CompiledLadder } from '@/simulator/types/runtime';

/**
 * Phase 5.5 — Scan Time Monitor.
 *
 * Pure over data the Runtime already has: `runScanCycle`'s `ScanResult`
 * already returns `durationMs` every scan (unchanged, Phase 2). This
 * module just keeps a rolling window of those durations and reduces them
 * — no engine change needed, the Scan Cycle already measures itself.
 */

const HISTORY_LIMIT = 500;

export interface ScanStats {
  currentMs: number;
  averageMs: number;
  maxMs: number;
  minMs: number;
  sampleCount: number;
}

export class ScanStatsTracker {
  private history: number[] = [];

  record(durationMs: number): void {
    this.history.push(durationMs);
    if (this.history.length > HISTORY_LIMIT) this.history.shift();
  }

  reset(): void {
    this.history = [];
  }

  getStats(): ScanStats {
    if (this.history.length === 0) {
      return { currentMs: 0, averageMs: 0, maxMs: 0, minMs: 0, sampleCount: 0 };
    }
    const sum = this.history.reduce((a, b) => a + b, 0);
    return {
      currentMs: this.history[this.history.length - 1],
      averageMs: sum / this.history.length,
      maxMs: Math.max(...this.history),
      minMs: Math.min(...this.history),
      sampleCount: this.history.length,
    };
  }
}

/** Counts every rung and every instruction-carrying coil in the compiled
 * program — the two figures the brief's Scan Time Monitor asks for
 * alongside timing ("Instruction Count", "Rung Count"). Rung Count here
 * means executable rungs (compiled), Instruction Count means every
 * ladder element the Logic Engine evaluates per scan (contacts, coils,
 * timers, counters, wires, branch markers) — i.e. the real per-scan
 * workload, not just Phase 5.4 word instructions. */
export function countProgramSize(compiled: CompiledLadder): { rungCount: number; instructionCount: number } {
  let instructionCount = 0;
  for (const rung of compiled.rungs) {
    instructionCount += rung.nodes.size;
  }
  return { rungCount: compiled.rungs.length, instructionCount };
}
