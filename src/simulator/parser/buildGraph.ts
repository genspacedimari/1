import type { Rung } from '@/simulator/types/ladder';
import type { CompiledRung, CompiledNode } from '@/simulator/types/runtime';

/**
 * Turns a Rung's flat element list + connectsTo arrays into a graph with
 * predecessors resolved both ways, so the engine never has to scan every
 * element's connectsTo to answer "who feeds into me?" during evaluation.
 */
export function buildGraph(rung: Rung): CompiledRung {
  const nodes = new Map<string, CompiledNode>();

  for (const element of rung.elements) {
    nodes.set(element.id, { element, predecessors: [], successors: [...(element.connectsTo ?? [])] });
  }

  for (const element of rung.elements) {
    for (const targetId of element.connectsTo ?? []) {
      nodes.get(targetId)!.predecessors.push(element.id);
    }
  }

  return { id: rung.id, startIds: rung.startIds, nodes };
}
