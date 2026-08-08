import type { LadderProject } from '@/simulator/types/ladder';
import type { Address } from '@/simulator/types/address';
import type { CompiledLadder } from '@/simulator/types/runtime';
import { createEmptyState, type PlcState } from '@/simulator/types/plcState';
import { parseLadder } from '@/simulator/parser/parseLadder';
import { runScanCycle, DEFAULT_SCAN_INTERVAL_MS } from '@/simulator/engine/scanCycle';
import { ScanStatsTracker, countProgramSize, type ScanStats } from '@/simulator/engine/scanStats';
import { runStaticDiagnostics, collectRuntimeDiagnostics, type Diagnostic } from '@/simulator/engine/runtimeDiagnostics';
import { findUsages, type CrossRefUsage } from '@/simulator/engine/crossReference';

export interface RuntimeSnapshot {
  state: PlcState;
  poweredElements: Record<string, boolean>;
  isRunning: boolean;
  /** Phase 5.5 — Scan Time Monitor: current/average/max/min scan duration
   * over a rolling window, computed from the SAME `durationMs` every
   * `runScanCycle()` call already returns (Phase 2, unchanged) — this adds
   * no new timing source, only a reducer over ones already emitted. */
  scanStats: ScanStats;
  /** Phase 5.5 — "Rung Count" / "Instruction Count" for the Scan Time
   * Monitor, derived from the already-compiled program. */
  programSize: { rungCount: number; instructionCount: number };
  /** Phase 5.5 — Runtime Diagnostics: static (structural) problems from
   * the currently loaded project, re-checked on every load, PLUS this
   * scan's live Instruction Engine errors (Instruction Error / Memory
   * Overflow). Both are produced by engine/runtimeDiagnostics.ts, which
   * only calls the existing validators/instructionLog — nothing new is
   * detected here, only surfaced. */
  diagnostics: Diagnostic[];
}

export type RuntimeListener = (snapshot: RuntimeSnapshot) => void;

/**
 * Framework-agnostic PLC runtime — no React, no Zustand, no Supabase.
 * This is the class src/simulator/hooks/useSimulator.ts and stores/plcStore.ts
 * wrap for the UI. Keeping it framework-agnostic is what makes it directly
 * reusable for a future Arduino/Industrial-simulation runtime — same shape
 * (loadProject/start/stop/reset/step/subscribe), different compiled graph
 * and engine underneath.
 */
export class PlcRuntime {
  private compiled: CompiledLadder | null = null;
  private project: LadderProject | null = null;
  private state: PlcState = createEmptyState();
  private poweredElements: Record<string, boolean> = {};
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<RuntimeListener>();
  private scanIntervalMs: number;

  // Phase 5.5 — Scan Time Monitor. Every step() records its measured
  // duration (already computed by runScanCycle, Phase 2) into this
  // rolling-window reducer; nothing about scan timing itself changes.
  private scanStatsTracker = new ScanStatsTracker();

  // Phase 5.5 — Runtime Diagnostics. Static/structural diagnostics are
  // recomputed once per loadProject() (not per scan — the program
  // structure doesn't change mid-run); live instruction diagnostics are
  // recomputed every step() from that scan's instructionLog.
  private staticDiagnostics: Diagnostic[] = [];

  // Phase 5.5 — Force Mode. Forced bits override the scan-committed value
  // AFTER every step()/scan completes — the Scan Cycle itself still runs
  // completely normally (reads/writes/timers/counters all execute), which
  // is what "Force tidak menghentikan Scan Cycle" (Force does not halt the
  // Scan Cycle) means: this is an override layer, not a different engine
  // path.
  private forcedInputs = new Map<number, boolean>();
  private forcedMemory = new Map<number, boolean>();
  private forcedOutputs = new Map<number, boolean>();

  constructor(scanIntervalMs: number = DEFAULT_SCAN_INTERVAL_MS) {
    this.scanIntervalMs = scanIntervalMs;
  }

  loadProject(project: LadderProject): void {
    this.stop();
    this.compiled = parseLadder(project);
    this.project = project;
    this.state = createEmptyState();
    this.poweredElements = {};
    this.scanStatsTracker.reset();
    this.staticDiagnostics = runStaticDiagnostics(project);
    this.forcedInputs.clear();
    this.forcedMemory.clear();
    this.forcedOutputs.clear();
    this.emit();
  }

  /** Simulates flipping a physical input switch, e.g. setInput(1, true) for I1. */
  setInput(number: number, value: boolean): void {
    this.state = { ...this.state, inputs: { ...this.state.inputs, [number]: value } };
    this.emit();
  }

  /** Runs a single scan cycle — useful for manual step-through debugging. */
  step(): void {
    if (!this.compiled) {
      throw new Error('PlcRuntime.step() called with no project loaded — call loadProject() first.');
    }
    const result = runScanCycle(this.compiled, this.state, this.scanIntervalMs);
    this.state = result.state;
    this.poweredElements = result.poweredElements;
    this.scanStatsTracker.record(result.durationMs);
    this.applyForces();
    this.emit();
  }

  start(): void {
    if (this.intervalHandle || !this.compiled) return;
    this.intervalHandle = setInterval(() => this.step(), this.scanIntervalMs);
    this.emit();
  }

  stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
      this.emit();
    }
  }

  reset(): void {
    this.stop();
    this.state = createEmptyState();
    this.poweredElements = {};
    this.scanStatsTracker.reset();
    this.emit();
  }

  isRunning(): boolean {
    return this.intervalHandle !== null;
  }

  // ── Phase 5.5: Force Mode ────────────────────────────────────────────
  // Force ON / Force OFF / Release Force. Applied as an override written
  // directly onto committed state right after each scan — I/Q/M keep
  // being read and written by the real Scan Cycle every cycle; forcing
  // only pins the bit's visible value afterward, exactly like a real
  // PLC's force table.
  forceBit(type: 'I' | 'O' | 'M', number: number, value: boolean): void {
    const map = type === 'I' ? this.forcedInputs : type === 'O' ? this.forcedOutputs : this.forcedMemory;
    map.set(number, value);
    this.applyForces();
    this.emit();
  }

  releaseForce(type: 'I' | 'O' | 'M', number: number): void {
    const map = type === 'I' ? this.forcedInputs : type === 'O' ? this.forcedOutputs : this.forcedMemory;
    map.delete(number);
    this.emit();
  }

  releaseAllForces(): void {
    this.forcedInputs.clear();
    this.forcedOutputs.clear();
    this.forcedMemory.clear();
    this.emit();
  }

  getForcedAddresses(): { inputs: number[]; outputs: number[]; memory: number[] } {
    return {
      inputs: [...this.forcedInputs.keys()],
      outputs: [...this.forcedOutputs.keys()],
      memory: [...this.forcedMemory.keys()],
    };
  }

  private applyForces(): void {
    if (this.forcedInputs.size === 0 && this.forcedOutputs.size === 0 && this.forcedMemory.size === 0) return;
    const inputs = { ...this.state.inputs };
    for (const [n, v] of this.forcedInputs) inputs[n] = v;
    const outputs = { ...this.state.outputs };
    for (const [n, v] of this.forcedOutputs) outputs[n] = v;
    const memory = { ...this.state.memory };
    for (const [n, v] of this.forcedMemory) memory[n] = v;
    this.state = { ...this.state, inputs, outputs, memory };
  }

  // ── Phase 5.5: Cross Reference ───────────────────────────────────────
  /** Find Usage / Find Definition for one address against the currently
   * loaded project — delegates entirely to engine/crossReference.ts. */
  findUsages(address: Address): CrossRefUsage[] {
    if (!this.project) return [];
    return findUsages(this.project, address);
  }

  getSnapshot(): RuntimeSnapshot {
    const liveDiagnostics = collectRuntimeDiagnostics(this.state);
    return {
      state: this.state,
      poweredElements: this.poweredElements,
      isRunning: this.isRunning(),
      scanStats: this.scanStatsTracker.getStats(),
      programSize: this.compiled ? countProgramSize(this.compiled) : { rungCount: 0, instructionCount: 0 },
      diagnostics: [...this.staticDiagnostics, ...liveDiagnostics],
    };
  }

  /** Returns an unsubscribe function, matching the convention React effects expect. */
  subscribe(listener: RuntimeListener): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    const snapshot = this.getSnapshot();
    this.listeners.forEach((listener) => listener(snapshot));
  }
}

/**
 * Single shared instance for the whole app — today there is only ever one
 * active Simulator screen. If multi-project/multi-tab simulation is ever
 * needed, replace this with a keyed registry; nothing above this line
 * would need to change.
 */
export const plcRuntime = new PlcRuntime();
