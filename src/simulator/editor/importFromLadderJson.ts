import type { LadderProject, LadderElement } from '@/simulator/types/ladder';
import { generateId } from '@/simulator/utils/id';
import type { EditorDocument, EditorRung, EditorRow } from './types';

const OUTPUT_KINDS = new Set(['COIL', 'TIMER', 'COUNTER']);

function isOutput(el: LadderElement | undefined): boolean {
  return !!el && OUTPUT_KINDS.has(el.kind);
}

/**
 * Inverse of exportToLadderJson's buildRungGraph — reconstructs rows/
 * outputs from the engine's connectsTo graph. Only needs to handle the
 * shape THIS editor itself produces (each row a linear chain whose last
 * cell connects to every output; empty rows represented by an output id
 * appearing directly in startIds) — this is a round-trip helper, not a
 * general importer for hand-authored or legacy free-form ladder JSON.
 */
export function importFromLadderJson(project: LadderProject): EditorDocument {
  const rungs: Record<string, EditorRung> = {};
  const rungOrder: string[] = [];

  for (const projectRung of project.rungs) {
    const elements: Record<string, LadderElement> = {};
    for (const el of projectRung.elements) elements[el.id] = el;

    const outputs = projectRung.elements.filter((el) => isOutput(el)).map((el) => el.id);
    const rows: EditorRow[] = [];

    for (const startId of projectRung.startIds) {
      if (isOutput(elements[startId])) {
        rows.push({ id: generateId('row'), cells: [] });
        continue;
      }
      const cells: string[] = [];
      let current: string | undefined = startId;
      const guard = new Set<string>();
      while (current && !guard.has(current)) {
        guard.add(current);
        const el: LadderElement | undefined = elements[current];
        if (!el || isOutput(el)) break;
        cells.push(current);
        const nextTargets: string[] = (el.connectsTo ?? []).filter((id: string) => !isOutput(elements[id]));
        current = nextTargets[0];
      }
      rows.push({ id: generateId('row'), cells });
    }

    if (rows.length === 0) rows.push({ id: generateId('row'), cells: [] });

    rungs[projectRung.id] = { id: projectRung.id, rows, outputs, elements };
    rungOrder.push(projectRung.id);
  }

  return {
    id: project.id,
    name: project.name,
    createdAt: project.meta.createdAt,
    rungOrder,
    rungs,
  };
}
