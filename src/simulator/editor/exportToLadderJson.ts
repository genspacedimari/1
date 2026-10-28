import type { LadderElement, LadderProject, Rung } from '@/simulator/types/ladder';
import type { EditorDocument, EditorRung } from './types';
import { parseLadder } from '@/simulator/parser/parseLadder';

export interface ExportResult {
  project: LadderProject;
  /** Human-readable validation problems — empty means the export is
   * engine-ready. Non-empty does NOT mean export failed; it means the
   * in-progress diagram isn't runnable yet (e.g. a rung with no output),
   * which is completely normal while still building. */
  errors: string[];
}

/** Turns one rung's rows+outputs into the engine's connectsTo graph:
 *   - each row is a left-to-right series chain
 *   - every row's last element feeds every output (OR into shared outputs)
 *   - an empty row means "wired straight to the rail" — if it's the ONLY
 *     row content wise, that makes the outputs unconditionally powered. */
function buildRungGraph(rung: EditorRung): Rung {
  const elements: Record<string, LadderElement> = {};
  for (const [id, el] of Object.entries(rung.elements)) {
    elements[id] = { ...el, connectsTo: [] };
  }

  const startIds = new Set<string>();

  for (const row of rung.rows) {
    if (row.cells.length === 0) {
      for (const outId of rung.outputs) startIds.add(outId);
      continue;
    }
    startIds.add(row.cells[0]);
    for (let i = 0; i < row.cells.length - 1; i++) {
      const el = elements[row.cells[i]];
      if (el && !el.connectsTo!.includes(row.cells[i + 1])) el.connectsTo!.push(row.cells[i + 1]);
    }
    const last = elements[row.cells[row.cells.length - 1]];
    if (last) {
      for (const outId of rung.outputs) {
        if (!last.connectsTo!.includes(outId)) last.connectsTo!.push(outId);
      }
    }
  }

  // If startIds is empty but elements exist, ensure non-targeted elements become startIds
  if (startIds.size === 0 && Object.keys(elements).length > 0) {
    const targeted = new Set<string>();
    for (const el of Object.values(elements)) {
      for (const t of el.connectsTo ?? []) targeted.add(t);
    }
    for (const el of Object.values(elements)) {
      if (!targeted.has(el.id)) startIds.add(el.id);
    }
    if (startIds.size === 0) {
      const firstId = Object.keys(elements)[0];
      if (firstId) startIds.add(firstId);
    }
  }

  return { id: rung.id, startIds: [...startIds], elements: Object.values(elements) };
}

export function exportToLadderJson(doc: EditorDocument, options: { validate?: boolean } = {}): ExportResult {
  const { validate = true } = options;
  const errors: string[] = [];

  for (const rungId of doc.rungOrder) {
    const rung = doc.rungs[rungId];
    const isTotallyBlank = rung.outputs.length === 0 && rung.rows.every((r) => r.cells.length === 0);
    if (!isTotallyBlank && rung.outputs.length === 0) {
      errors.push(`Rung tidak punya output (coil/timer/counter) — tambahkan minimal satu.`);
    }
  }

  const rungs: Rung[] = doc.rungOrder.map((rungId) => buildRungGraph(doc.rungs[rungId]));

  const project: LadderProject = {
    id: doc.id,
    name: doc.name,
    rungs,
    meta: { createdAt: doc.createdAt, updatedAt: new Date().toISOString(), engineVersion: '0.1.0' },
  };

  if (validate && errors.length === 0) {
    try {
      parseLadder(project);
    } catch (err) {
      errors.push(err instanceof Error ? err.message : 'Unknown validation error.');
    }
  }

  return { project, errors };
}
