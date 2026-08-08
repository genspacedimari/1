import { create } from 'zustand';
import type { EditorDocument, EditorSelection } from '@/simulator/editor/types';
import {
  createEmptyEditorDocument,
  addRung as addRungOp,
  deleteRung as deleteRungOp,
  addRow as addRowOp,
  deleteRow as deleteRowOp,
  addElementToRow,
  removeCell as removeCellOp,
  addOutput as addOutputOp,
  removeOutput as removeOutputOp,
  updateElementProperties as updateElementPropertiesOp,
} from '@/simulator/editor/operations';
import { createElementFromSpec, type NewComponentSpec } from '@/simulator/editor/componentSpec';
import { exportToLadderJson, type ExportResult } from '@/simulator/editor/exportToLadderJson';
import { importFromLadderJson } from '@/simulator/editor/importFromLadderJson';
import type { Address } from '@/simulator/types/address';
import type { LadderProject } from '@/simulator/types/ladder';

interface LadderEditorStoreState {
  document: EditorDocument;
  selection: EditorSelection | null;
  lastErrors: string[];

  addRung: () => string;
  deleteRung: (rungId: string) => void;
  addRow: (rungId: string) => string | null;
  deleteRow: (rungId: string, rowId: string) => void;

  placeInRow: (rungId: string, rowId: string, spec: NewComponentSpec) => void;
  removeCell: (rungId: string, rowId: string, index: number) => void;

  placeOutput: (rungId: string, spec: NewComponentSpec) => void;
  removeOutput: (rungId: string, index: number) => void;

  updateElement: (
    rungId: string,
    elementId: string,
    updates: { address?: Address; comment?: string; alias?: string }
  ) => void;

  select: (selection: EditorSelection | null) => void;

  resetDocument: (name?: string) => void;
  loadProject: (project: LadderProject) => void;
  clearErrors: () => void;

  exportToLadderJson: () => ExportResult;
}

/** Runs a mutation that might throw EditorOperationError; on failure the
 * document is left untouched and the message recorded in lastErrors. */
function guarded(
  set: (partial: Partial<LadderEditorStoreState>) => void,
  get: () => LadderEditorStoreState,
  fn: () => EditorDocument
): void {
  try {
    set({ document: fn() });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown editor error.';
    set({ lastErrors: [...get().lastErrors, message] });
  }
}

export const useLadderEditorStore = create<LadderEditorStoreState>((set, get) => ({
  document: createEmptyEditorDocument('Untitled Ladder'),
  selection: null,
  lastErrors: [],

  addRung: () => {
    const { doc, rungId } = addRungOp(get().document);
    set({ document: doc });
    return rungId;
  },
  deleteRung: (rungId) => guarded(set, get, () => deleteRungOp(get().document, rungId)),

  addRow: (rungId) => {
    try {
      const { doc, rowId } = addRowOp(get().document, rungId);
      set({ document: doc });
      return rowId;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown editor error.';
      set({ lastErrors: [...get().lastErrors, message] });
      return null;
    }
  },
  deleteRow: (rungId, rowId) => guarded(set, get, () => deleteRowOp(get().document, rungId, rowId)),

  placeInRow: (rungId, rowId, spec) =>
    guarded(set, get, () => {
      const element = createElementFromSpec(spec);
      return addElementToRow(get().document, rungId, rowId, element);
    }),
  removeCell: (rungId, rowId, index) =>
    guarded(set, get, () => removeCellOp(get().document, rungId, rowId, index)),

  placeOutput: (rungId, spec) =>
    guarded(set, get, () => {
      const element = createElementFromSpec(spec);
      return addOutputOp(get().document, rungId, element);
    }),
  removeOutput: (rungId, index) => guarded(set, get, () => removeOutputOp(get().document, rungId, index)),

  updateElement: (rungId, elementId, updates) =>
    guarded(set, get, () => updateElementPropertiesOp(get().document, rungId, elementId, updates)),

  select: (selection) => set({ selection }),

  resetDocument: (name = 'Untitled Ladder') =>
    set({ document: createEmptyEditorDocument(name), selection: null, lastErrors: [] }),

  loadProject: (project) => set({ document: importFromLadderJson(project), selection: null }),

  clearErrors: () => set({ lastErrors: [] }),

  exportToLadderJson: () => {
    const result = exportToLadderJson(get().document);
    if (result.errors.length > 0) set({ lastErrors: result.errors });
    return result;
  },
}));
