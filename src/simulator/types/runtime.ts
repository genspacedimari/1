import type { LadderElement } from './ladder';

/** One element plus its resolved graph edges, ready for repeated evaluation
 * without re-walking the raw `connectsTo` arrays every scan. */
export interface CompiledNode {
  element: LadderElement;
  predecessors: string[];
  successors: string[];
}

export interface CompiledRung {
  id: string;
  startIds: string[];
  nodes: Map<string, CompiledNode>;
}

export interface CompiledLadder {
  rungs: CompiledRung[];
}
