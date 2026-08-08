import type { Address } from '@/simulator/types/address';
import type { PlcState } from '@/simulator/types/plcState';

/**
 * Shared by timerEngine.ts and counterEngine.ts (Phase 5.3 — extracted
 * because Timer gained its own optional resetAddress, identical in meaning
 * to Counter's since Phase 5.1, and duplicating the same three-line
 * function twice wasn't worth it). Reset bits only ever come from a
 * physical Input or Internal Memory bit — validateLadder.ts enforces this
 * at load time, so the `false` fallback here is just defense in depth, not
 * the primary guard.
 */
export function readResetBit(address: Address, state: PlcState): boolean {
  if (address.type === 'I') return !!state.inputs[address.number];
  if (address.type === 'M') return !!state.memory[address.number];
  return false;
}
