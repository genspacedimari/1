import type { Address, ContactMode, LadderElement, CoilMode, TimerElement, CounterElement } from '@/simulator/types/ladder';
import type { InstructionOp } from '@/simulator/types/instruction';
import {
  createContact,
  createCoil,
  createInstructionCoil,
  createTimer,
  createCounter,
  createWire,
  createComment,
} from '@/simulator/models/elementFactory';

interface Placement {
  gridX: number;
  gridY: number;
}

/**
 * What a future "Add Component" toolbar/palette hands the editor — one spec
 * per component type, matching exactly what a Konva palette drag-drop would
 * know at drop time (kind + address + position). Dispatches straight to the
 * Phase 2 elementFactory (untouched) so the editor never hand-builds the
 * LadderElement union itself. `coilMode`/`timerType`/`counterType` are
 * Phase 5 additions — all optional, defaulting exactly as elementFactory.ts
 * already defaults them (NORMAL / TON / CTU), so nothing that specified
 * these fields before this phase needs to change.
 */
export type NewComponentSpec =
  | { kind: 'CONTACT'; mode: ContactMode; address: Address; at: Placement }
  | { kind: 'COIL'; address: Address; at: Placement; coilMode?: CoilMode; instruction?: InstructionOp }
  | {
      kind: 'TIMER';
      address: Address;
      presetMs: number;
      at: Placement;
      timerType?: TimerElement['timerType'];
      resetAddress?: Address;
    }
  | {
      kind: 'COUNTER';
      address: Address;
      presetCount: number;
      resetAddress?: Address;
      at: Placement;
      counterType?: CounterElement['counterType'];
    }
  | { kind: 'WIRE'; at: Placement }
  | { kind: 'COMMENT'; text: string; at: Placement };

export function createElementFromSpec(spec: NewComponentSpec): LadderElement {
  switch (spec.kind) {
    case 'CONTACT':
      return createContact(spec.address, spec.mode, spec.at);
    case 'COIL':
      return spec.instruction
        ? createInstructionCoil(spec.address, spec.instruction, spec.at)
        : createCoil(spec.address, spec.at, spec.coilMode ?? 'NORMAL');
    case 'TIMER':
      return createTimer(spec.address, spec.presetMs, spec.at, spec.timerType ?? 'TON', spec.resetAddress);
    case 'COUNTER':
      return createCounter(spec.address, spec.presetCount, spec.at, spec.resetAddress, spec.counterType ?? 'CTU');
    case 'WIRE':
      return createWire(spec.at);
    case 'COMMENT':
      return createComment(spec.text, spec.at);
    default: {
      const _exhaustive: never = spec;
      return _exhaustive;
    }
  }
}
