import { useLadderEditorStore } from '@/stores/ladderEditorStore';

/**
 * Convenience re-export so future canvas/toolbar components import from
 * simulator/hooks (matching useSimulator.ts) instead of reaching into
 * stores/ directly. No extra behavior yet — this is the seam a future
 * Konva canvas wires its onDragMove/onClick/onDrop handlers through.
 */
export function useLadderEditor() {
  return useLadderEditorStore();
}
