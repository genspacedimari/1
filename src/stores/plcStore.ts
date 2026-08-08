import { create } from 'zustand';
import { createEmptyState, type PlcState } from '@/simulator/types/plcState';
import type { LadderProject } from '@/simulator/types/ladder';
import type { Address } from '@/simulator/types/address';
import { plcRuntime } from '@/simulator/runtime/plcRuntime';
import type { ScanStats } from '@/simulator/engine/scanStats';
import type { Diagnostic } from '@/simulator/engine/runtimeDiagnostics';
import type { CrossRefUsage } from '@/simulator/engine/crossReference';

interface PlcStoreState {
  state: PlcState;
  poweredElements: Record<string, boolean>;
  isRunning: boolean;
  // Phase 5.5 — Debugger reactive slices, all sourced from plcRuntime's
  // snapshot exactly like state/poweredElements/isRunning already were.
  scanStats: ScanStats;
  programSize: { rungCount: number; instructionCount: number };
  diagnostics: Diagnostic[];
  loadProject: (project: LadderProject) => void;
  start: () => void;
  stop: () => void;
  reset: () => void;
  step: () => void;
  setInput: (number: number, value: boolean) => void;
  // Phase 5.5 — Force Mode
  forceBit: (type: 'I' | 'O' | 'M', number: number, value: boolean) => void;
  releaseForce: (type: 'I' | 'O' | 'M', number: number) => void;
  releaseAllForces: () => void;
  getForcedAddresses: () => { inputs: number[]; outputs: number[]; memory: number[] };
  // Phase 5.5 — Cross Reference
  findUsages: (address: Address) => CrossRefUsage[];
}

/**
 * Reactive mirror of the framework-agnostic PlcRuntime (see
 * simulator/runtime/plcRuntime.ts). This store owns no simulation logic
 * itself — every action just delegates to `plcRuntime`, and the
 * subscription below keeps this store's `state`/`poweredElements`/
 * `isRunning` (and, as of Phase 5.5, `scanStats`/`programSize`/
 * `diagnostics`) in sync so any component can read them without prop
 * drilling.
 */
export const usePlcStore = create<PlcStoreState>((set) => {
  plcRuntime.subscribe(({ state, poweredElements, isRunning, scanStats, programSize, diagnostics }) => {
    set({ state, poweredElements, isRunning, scanStats, programSize, diagnostics });
  });

  return {
    state: createEmptyState(),
    poweredElements: {},
    isRunning: false,
    scanStats: { currentMs: 0, averageMs: 0, maxMs: 0, minMs: 0, sampleCount: 0 },
    programSize: { rungCount: 0, instructionCount: 0 },
    diagnostics: [],
    loadProject: (project) => plcRuntime.loadProject(project),
    start: () => plcRuntime.start(),
    stop: () => plcRuntime.stop(),
    reset: () => plcRuntime.reset(),
    step: () => plcRuntime.step(),
    setInput: (number, value) => plcRuntime.setInput(number, value),
    forceBit: (type, number, value) => plcRuntime.forceBit(type, number, value),
    releaseForce: (type, number) => plcRuntime.releaseForce(type, number),
    releaseAllForces: () => plcRuntime.releaseAllForces(),
    getForcedAddresses: () => plcRuntime.getForcedAddresses(),
    findUsages: (address) => plcRuntime.findUsages(address),
  };
});
