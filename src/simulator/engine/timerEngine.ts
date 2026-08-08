import type { TimerElement } from '@/simulator/types/ladder';
import type { TimerState, PlcState } from '@/simulator/types/plcState';
import { readResetBit } from './resetBit';

/**
 * Dispatches to the right timer behavior by `element.timerType`. Public
 * signature gained the `state` parameter in Phase 5.3 (needed to read
 * `resetAddress`, mirroring counterEngine's signature) — scanCycle.ts,
 * the only caller, was updated in the same commit.
 *
 * Reset (Phase 5.3) is checked once here, ahead of any TON/TOF/TP-specific
 * behavior: while the reset bit is true, the timer's current value and
 * done bit are forced to 0/false every scan, regardless of the enable
 * input — matching how a real PLC's timer RES instruction overrides normal
 * timing.
 */
export function updateTimer(
  element: TimerElement,
  isPowered: boolean,
  previous: TimerState | undefined,
  scanIntervalMs: number,
  state: PlcState
): TimerState {
  const resetActive = element.resetAddress ? readResetBit(element.resetAddress, state) : false;
  if (resetActive) {
    return { presetMs: element.presetMs, accumulatedMs: 0, done: false, poweredLastScan: isPowered };
  }

  switch (element.timerType) {
    case 'TON':
      return updateTON(element, isPowered, previous, scanIntervalMs);
    case 'TOF':
      return updateTOF(element, isPowered, previous, scanIntervalMs);
    case 'TP':
      return updateTP(element, isPowered, previous, scanIntervalMs);
    default: {
      const _exhaustive: never = element.timerType;
      return _exhaustive;
    }
  }
}

/**
 * TON — On-Delay Timer, non-retentive (Phase 2, unchanged).
 * While powered (Enable Bit true): accumulated (Current Value) climbs
 * toward preset, capped there. The instant power is lost: accumulated AND
 * done both drop to 0/false. done (Done Bit) flips true once accumulated
 * reaches preset (Preset Value), stays true while powered.
 */
function updateTON(
  element: TimerElement,
  isPowered: boolean,
  previous: TimerState | undefined,
  scanIntervalMs: number
): TimerState {
  const preset = element.presetMs;

  if (!isPowered) {
    return { presetMs: preset, accumulatedMs: 0, done: false, poweredLastScan: false };
  }

  const prevAccumulated = previous?.accumulatedMs ?? 0;
  const accumulatedMs = Math.min(preset, prevAccumulated + scanIntervalMs);
  const done = accumulatedMs >= preset;

  return { presetMs: preset, accumulatedMs, done, poweredLastScan: true };
}

/**
 * TOF — Off-Delay Timer (Phase 5.1).
 * While powered: done is true immediately, accumulated stays reset at 0 —
 * ready for the next off-delay cycle.
 * The instant power is lost: done STAYS true and accumulated starts
 * climbing; done only flips false once accumulated reaches preset. If
 * power returns before that, the delay cancels (done stays true, resets).
 */
function updateTOF(
  element: TimerElement,
  isPowered: boolean,
  previous: TimerState | undefined,
  scanIntervalMs: number
): TimerState {
  const preset = element.presetMs;

  if (isPowered) {
    return { presetMs: preset, accumulatedMs: 0, done: true, poweredLastScan: true };
  }

  const prevAccumulated = previous?.accumulatedMs ?? 0;
  const accumulatedMs = Math.min(preset, prevAccumulated + scanIntervalMs);
  const done = accumulatedMs < preset;

  return { presetMs: preset, accumulatedMs, done, poweredLastScan: false };
}

/**
 * TP — Pulse Timer (Phase 5.1).
 * A rising edge of `isPowered` starts a fixed-length pulse: done goes true
 * for exactly `presetMs`, regardless of what the input does for the rest
 * of that duration (holding it, or releasing it early, doesn't matter —
 * this is what distinguishes TP from TON). Once the pulse completes, done
 * goes false and stays false until the NEXT rising edge.
 */
function updateTP(
  element: TimerElement,
  isPowered: boolean,
  previous: TimerState | undefined,
  scanIntervalMs: number
): TimerState {
  const preset = element.presetMs;
  const wasPowered = previous?.poweredLastScan ?? false;
  const pulseInProgress = previous?.done ?? false;
  const prevAccumulated = previous?.accumulatedMs ?? 0;
  const risingEdge = isPowered && !wasPowered;

  if (pulseInProgress) {
    // Run to completion regardless of the input's current state.
    const accumulatedMs = Math.min(preset, prevAccumulated + scanIntervalMs);
    return { presetMs: preset, accumulatedMs, done: accumulatedMs < preset, poweredLastScan: isPowered };
  }

  if (risingEdge) {
    const accumulatedMs = Math.min(preset, scanIntervalMs);
    return { presetMs: preset, accumulatedMs, done: accumulatedMs < preset, poweredLastScan: isPowered };
  }

  return { presetMs: preset, accumulatedMs: 0, done: false, poweredLastScan: isPowered };
}
