import { generateId } from '@/simulator/utils/id';
import type { LadderElement } from '@/simulator/types/ladder';
import type { Address } from '@/simulator/types/address';
import type { EditorDocument, EditorRung } from './types';

export class EditorOperationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EditorOperationError';
  }
}

function cloneDoc(doc: EditorDocument): EditorDocument {
  return {
    ...doc,
    rungOrder: [...doc.rungOrder],
    rungs: Object.fromEntries(
      Object.entries(doc.rungs).map(([id, rung]) => [
        id,
        {
          ...rung,
          rows: rung.rows.map((r) => ({ ...r, cells: [...r.cells] })),
          outputs: [...rung.outputs],
          elements: { ...rung.elements },
        },
      ])
    ),
  };
}

function getRung(doc: EditorDocument, rungId: string): EditorRung {
  const rung = doc.rungs[rungId];
  if (!rung) throw new EditorOperationError(`Rung "${rungId}" not found.`);
  return rung;
}

export function createEmptyEditorDocument(name = 'Untitled Ladder'): EditorDocument {
  const rungId = generateId('rung');
  const rowId = generateId('row');
  return {
    id: generateId('project'),
    name,
    createdAt: new Date().toISOString(),
    rungOrder: [rungId],
    rungs: {
      [rungId]: { id: rungId, rows: [{ id: rowId, cells: [] }], outputs: [], elements: {} },
    },
  };
}

export function addRung(doc: EditorDocument): { doc: EditorDocument; rungId: string } {
  const next = cloneDoc(doc);
  const rungId = generateId('rung');
  const rowId = generateId('row');
  next.rungs[rungId] = { id: rungId, rows: [{ id: rowId, cells: [] }], outputs: [], elements: {} };
  next.rungOrder.push(rungId);
  return { doc: next, rungId };
}

export function deleteRung(doc: EditorDocument, rungId: string): EditorDocument {
  if (doc.rungOrder.length <= 1) {
    throw new EditorOperationError('Cannot delete the last remaining rung.');
  }
  const next = cloneDoc(doc);
  delete next.rungs[rungId];
  next.rungOrder = next.rungOrder.filter((id) => id !== rungId);
  return next;
}

export function addRow(doc: EditorDocument, rungId: string): { doc: EditorDocument; rowId: string } {
  const next = cloneDoc(doc);
  const rung = getRung(next, rungId);
  const rowId = generateId('row');
  rung.rows.push({ id: rowId, cells: [] });
  return { doc: next, rowId };
}

/** Removes elements no longer referenced anywhere in the rung (rows or
 * outputs) — keeps `elements` from silently accumulating orphans every
 * time a cell/row/output is deleted or replaced. */
function pruneOrphanElements(rung: EditorRung): void {
  const referenced = new Set<string>();
  for (const row of rung.rows) for (const id of row.cells) referenced.add(id);
  for (const id of rung.outputs) referenced.add(id);
  for (const id of Object.keys(rung.elements)) {
    if (!referenced.has(id)) delete rung.elements[id];
  }
}

export function deleteRow(doc: EditorDocument, rungId: string, rowId: string): EditorDocument {
  const next = cloneDoc(doc);
  const rung = getRung(next, rungId);
  if (rung.rows.length <= 1) {
    throw new EditorOperationError('A rung needs at least one row — delete the rung instead.');
  }
  rung.rows = rung.rows.filter((r) => r.id !== rowId);
  pruneOrphanElements(rung);
  return next;
}

export const MAX_ROW_CELLS = 8;

export function addElementToRow(
  doc: EditorDocument,
  rungId: string,
  rowId: string,
  element: LadderElement
): EditorDocument {
  const next = cloneDoc(doc);
  const rung = getRung(next, rungId);
  const row = rung.rows.find((r) => r.id === rowId);
  if (!row) throw new EditorOperationError(`Row "${rowId}" not found.`);
  if (row.cells.length >= MAX_ROW_CELLS) {
    throw new EditorOperationError(`A row can hold at most ${MAX_ROW_CELLS} input elements.`);
  }
  row.cells.push(element.id);
  rung.elements[element.id] = element;
  return next;
}

export function removeCell(doc: EditorDocument, rungId: string, rowId: string, index: number): EditorDocument {
  const next = cloneDoc(doc);
  const rung = getRung(next, rungId);
  const row = rung.rows.find((r) => r.id === rowId);
  if (!row) throw new EditorOperationError(`Row "${rowId}" not found.`);
  row.cells.splice(index, 1);
  pruneOrphanElements(rung);
  return next;
}

export const MAX_OUTPUTS = 4;

export function addOutput(doc: EditorDocument, rungId: string, element: LadderElement): EditorDocument {
  const next = cloneDoc(doc);
  const rung = getRung(next, rungId);
  if (rung.outputs.length >= MAX_OUTPUTS) {
    throw new EditorOperationError(`A rung can hold at most ${MAX_OUTPUTS} outputs.`);
  }
  rung.outputs.push(element.id);
  rung.elements[element.id] = element;
  return next;
}

export function removeOutput(doc: EditorDocument, rungId: string, index: number): EditorDocument {
  const next = cloneDoc(doc);
  const rung = getRung(next, rungId);
  rung.outputs.splice(index, 1);
  pruneOrphanElements(rung);
  return next;
}

export function updateElementProperties(
  doc: EditorDocument,
  rungId: string,
  elementId: string,
  updates: { address?: Address; comment?: string; alias?: string }
): EditorDocument {
  const next = cloneDoc(doc);
  const rung = getRung(next, rungId);
  const el = rung.elements[elementId];
  if (!el) throw new EditorOperationError(`Element "${elementId}" not found.`);
  let updated: LadderElement = { ...el };
  if (updates.address !== undefined && 'address' in el) {
    updated = { ...updated, address: updates.address } as LadderElement;
  }
  if (updates.comment !== undefined) updated.comment = updates.comment;
  if (updates.alias !== undefined) updated.alias = updates.alias;
  rung.elements[elementId] = updated;
  return next;
}
