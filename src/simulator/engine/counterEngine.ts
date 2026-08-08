import type { CounterElement } from '@/simulator/types/ladder';
import type { CounterState, PlcState } from '@/simulator/types/plcState';
import { readResetBit } from './resetBit';

/**
 * Dispatches to the right counter behavior by `element.counterType`. Public
 * signature unchanged from Phase 2 — scanCycle.ts calls this exactly as
 * before; CTU behavior for existing programs is byte-for-byte identical.
 */
export function updateCounter(
  element: CounterElement,
  isPowered: boolean,
  previous: CounterState | undefined,
  state: PlcState
): CounterState {
  switch (element.counterType) {
    case 'CTU':
      return updateCTU(element, isPowered, previous, state);
    case 'CTD':
      return updateCTD(element, isPowered, previous, state);
    default: {
      const _exhaustive: never = element.counterType;
      return _exhaustive;
    }
  }
}

/**
 * CTU — Count Up (Phase 2, unchanged).
 * Increments accumulated by exactly 1 on a rising edge of the count input.
 * done flips true once accumulated reaches preset and stays true (keeps
 * counting past preset) until reset.
 */
function updateCTU(
  element: CounterElement,
  isPowered: boolean,
  previous: CounterState | undefined,
  state: PlcState
): CounterState {
  const preset = element.presetCount;
  const wasPowered = previous?.poweredLastScan ?? false;
  const prevAccumulated = previous?.accumulatedCount ?? 0;

  const resetActive = element.resetAddress ? readResetBit(element.resetAddress, state) : false;
  if (resetActive) {
    return { presetCount: preset, accumulatedCount: 0, done: false, poweredLastScan: isPowered };
  }

  const risingEdge = isPowered && !wasPowered;
  const accumulatedCount = risingEdge ? prevAccumulated + 1 : prevAccumulated;
  const done = accumulatedCount >= preset;

  return { presetCount: preset, accumulatedCount, done, poweredLastScan: isPowered };
}

/**
 * CTD — Count Down (Phase 5).
 * Starts loaded at `preset` (not 0 — there's nothing to count down from
 * otherwise) and decrements by 1 on a rising edge of the count input. done
 * flips true once accumulated reaches 0. Reset reloads accumulated back to
 * `preset`, matching real CTD's "reload" semantics rather than CTU's
 * "clear to zero".
 */
function updateCTD(
  element: CounterElement,
  isPowered: boolean,
  previous: CounterState | undefined,
  state: PlcState
): CounterState {
  const preset = element.presetCount;
  const wasPowered = previous?.poweredLastScan ?? false;
  const prevAccumulated = previous?.accumulatedCount ?? preset;

  const resetActive = element.resetAddress ? readResetBit(element.resetAddress, state) : false;
  if (resetActive) {
    return { presetCount: preset, accumulatedCount: preset, done: false, poweredLastScan: isPowered };
  }

  const risingEdge = isPowered && !wasPowered;
  const accumulatedCount = risingEdge ? Math.max(0, prevAccumulated - 1) : prevAccumulated;
  const done = accumulatedCount <= 0;

  return { presetCount: preset, accumulatedCount, done, poweredLastScan: isPowered };
}
