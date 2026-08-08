import type { CompiledRung } from '@/simulator/types/runtime';
import type { LadderElement, Address } from '@/simulator/types/ladder';
import type { PlcState } from '@/simulator/types/plcState';

export interface RungEvaluation {
  /** elementId -> "powered", meaning power reached the OUTPUT side of that
   * element this scan. The Simulator UI uses this to color orange/gray
   * (or green, in live-monitor mode) per element/wire. */
  powered: Map<string, boolean>;
  /** Phase 5: elementId -> this scan's raw bit value, for every
   * RISING_EDGE/FALLING_EDGE contact in the rung. scanCycle.ts commits this
   * into PlcState.edgeMemory so next scan's transition check has something
   * to compare against. Empty for rungs with no edge-detect contacts. */
  edgeMemoryUpdates: Record<string, boolean>;
}

/**
 * Solves power flow for one rung against a frozen state snapshot.
 *
 * The key design decision (see ARCHITECTURE.md): there is no special-cased
 * "parallel" or "branch" logic here. A node's power-in is simply the OR of
 * its predecessors' outputs — series falls out when a node has exactly one
 * predecessor, parallel falls out when it has more than one (a fan-in),
 * and nested branches fall out for free because this is just recursive
 * graph evaluation with memoization. BRANCH_START/BRANCH_END nodes are
 * transparent pass-throughs to this algorithm; they exist only so a future
 * editor can render the branch box.
 */
export function evaluateRung(rung: CompiledRung, state: PlcState): RungEvaluation {
  const poweredAfter = new Map<string, boolean>();
  const edgeMemoryUpdates: Record<string, boolean> = {};
  const visiting = new Set<string>();

  function powerInto(nodeId: string): boolean {
    const node = rung.nodes.get(nodeId);
    if (!node) {
      throw new Error(`Unknown element id "${nodeId}" referenced in rung "${rung.id}".`);
    }
    // No predecessors means it's wired straight to the left power rail,
    // which is always energized.
    if (node.predecessors.length === 0) return true;
    return node.predecessors.some((predId) => evalNode(predId));
  }

  function evalNode(nodeId: string): boolean {
    const cached = poweredAfter.get(nodeId);
    if (cached !== undefined) return cached;

    if (visiting.has(nodeId)) {
      throw new Error(
        `Cycle detected in rung "${rung.id}" at element "${nodeId}". Ladder logic must be a DAG — feedback loops aren't supported by this engine version.`
      );
    }
    visiting.add(nodeId);

    const node = rung.nodes.get(nodeId)!;
    const poweredIn = powerInto(nodeId);
    const result = resolveElementOutput(node.element, poweredIn, state);

    if (node.element.kind === 'CONTACT' && isEdgeMode(node.element.mode)) {
      edgeMemoryUpdates[node.element.id] = readBit(node.element.address, state);
    }

    visiting.delete(nodeId);
    poweredAfter.set(nodeId, result);
    return result;
  }

  for (const id of rung.nodes.keys()) evalNode(id);
  return { powered: poweredAfter, edgeMemoryUpdates };
}

function isEdgeMode(mode: string): boolean {
  return mode === 'RISING_EDGE' || mode === 'FALLING_EDGE';
}

function resolveElementOutput(element: LadderElement, poweredIn: boolean, state: PlcState): boolean {
  switch (element.kind) {
    case 'CONTACT': {
      const bitIsSet = readBit(element.address, state);
      const contactPasses = evaluateContactMode(element, bitIsSet, state);
      return poweredIn && contactPasses;
    }
    case 'WIRE':
    case 'BRANCH_START':
    case 'BRANCH_END':
      // Transparent pass-through — see the design note above.
      return poweredIn;
    case 'COIL':
    case 'TIMER':
    case 'COUNTER':
      // Coils and function blocks are normally terminal (empty connectsTo):
      // they consume poweredIn as "am I energized this scan?" and don't
      // hand power to anything downstream. Their *done bit* (for TIM/CTU)
      // is a separate piece of state, read via its own CONTACT elsewhere —
      // never by chaining an element directly after the block.
      return poweredIn;
    case 'COMMENT':
      return poweredIn;
    default: {
      const _exhaustive: never = element;
      return _exhaustive;
    }
  }
}

/** NO/NC are plain level checks (Phase 2 behavior, unchanged). RISING_EDGE/
 * FALLING_EDGE (Phase 5) pass for exactly one scan — the one where the
 * underlying bit transitions — by comparing against PlcState.edgeMemory,
 * which holds what the bit was as of the *previous* scan's evaluation. */
function evaluateContactMode(
  element: Extract<LadderElement, { kind: 'CONTACT' }>,
  currentBit: boolean,
  state: PlcState
): boolean {
  switch (element.mode) {
    case 'NO':
      return currentBit;
    case 'NC':
      return !currentBit;
    case 'RISING_EDGE': {
      const previousBit = state.edgeMemory[element.id] ?? false;
      return currentBit && !previousBit;
    }
    case 'FALLING_EDGE': {
      const previousBit = state.edgeMemory[element.id] ?? false;
      return !currentBit && previousBit;
    }
    default: {
      const _exhaustive: never = element.mode;
      return _exhaustive;
    }
  }
}

function readBit(address: Address, state: PlcState): boolean {
  switch (address.type) {
    case 'I':
      return !!state.inputs[address.number];
    case 'O':
      return !!state.outputs[address.number];
    case 'M':
      return !!state.memory[address.number];
    case 'TIM':
      return !!state.timers[address.number]?.done;
    case 'CTU':
      return !!state.counters[address.number]?.done;
    default: {
      const _exhaustive: never = address.type;
      return _exhaustive;
    }
  }
}
