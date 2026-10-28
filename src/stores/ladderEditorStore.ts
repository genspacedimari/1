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
  makePlaceholder as makePlaceholderOp,
  restoreFromPlaceholder as restoreFromPlaceholderOp,
  replaceElement as replaceElementOp,
} from '@/simulator/editor/operations';
import { createElementFromSpec, type NewComponentSpec } from '@/simulator/editor/componentSpec';
import { exportToLadderJson, type ExportResult } from '@/simulator/editor/exportToLadderJson';
import { importFromLadderJson } from '@/simulator/editor/importFromLadderJson';
import type { Address } from '@/simulator/types/address';
import type { LadderElement, LadderProject } from '@/simulator/types/ladder';

interface LadderEditorStoreState {
  document: EditorDocument;
  selection: EditorSelection | null;
  lastErrors: string[];
  past: EditorDocument[];
  future: EditorDocument[];

  addRung: () => string;
  deleteRung: (rungId: string) => void;
  addRow: (rungId: string) => string | null;
  deleteRow: (rungId: string, rowId: string) => void;

  placeInRow: (rungId: string, rowId: string, spec: NewComponentSpec) => void;
  removeCell: (rungId: string, rowId: string, index: number) => void;

  placeOutput: (rungId: string, spec: NewComponentSpec) => void;
  removeOutput: (rungId: string, index: number) => void;

  makePlaceholder: (rungId: string, elementId: string) => void;
  restorePlaceholder: (rungId: string, elementId: string) => void;
  replacePlaceholderWithSpec: (rungId: string, elementId: string, spec: NewComponentSpec) => void;
  replaceElement: (rungId: string, elementId: string, element: LadderElement) => void;

  updateElement: (
    rungId: string,
    elementId: string,
    updates: { address?: Address; comment?: string; alias?: string }
  ) => void;

  select: (selection: EditorSelection | null) => void;

  resetDocument: (name?: string) => void;
  loadProject: (project: LadderProject) => void;
  clearErrors: () => void;

  canUndo: () => boolean;
  canRedo: () => boolean;
  undo: () => void;
  redo: () => void;

  exportToLadderJson: (options?: { validate?: boolean }) => ExportResult;
}

/** Runs a mutation with history tracking */
function guarded(
  set: (partial: Partial<LadderEditorStoreState> | ((state: LadderEditorStoreState) => Partial<LadderEditorStoreState>)) => void,
  get: () => LadderEditorStoreState,
  fn: () => EditorDocument
): void {
  try {
    const currentDoc = get().document;
    const nextDoc = fn();
    set((state) => ({
      document: nextDoc,
      past: [...state.past.slice(-20), currentDoc],
      future: [],
    }));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown editor error.';
    set({ lastErrors: [...get().lastErrors, message] });
  }
}

export const useLadderEditorStore = create<LadderEditorStoreState>((set, get) => ({
  document: createEmptyEditorDocument('Untitled Ladder'),
  selection: null,
  lastErrors: [],
  past: [],
  future: [],

  addRung: () => {
    const currentDoc = get().document;
    const { doc, rungId } = addRungOp(currentDoc);
    set((state) => ({
      document: doc,
      past: [...state.past.slice(-20), currentDoc],
      future: [],
    }));
    return rungId;
  },
  deleteRung: (rungId) => guarded(set, get, () => deleteRungOp(get().document, rungId)),

  addRow: (rungId) => {
    try {
      const currentDoc = get().document;
      const { doc, rowId } = addRowOp(currentDoc, rungId);
      set((state) => ({
        document: doc,
        past: [...state.past.slice(-20), currentDoc],
        future: [],
      }));
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

  makePlaceholder: (rungId, elementId) =>
    guarded(set, get, () => makePlaceholderOp(get().document, rungId, elementId)),

  restorePlaceholder: (rungId, elementId) =>
    guarded(set, get, () => restoreFromPlaceholderOp(get().document, rungId, elementId)),

  replacePlaceholderWithSpec: (rungId, elementId, spec) =>
    guarded(set, get, () => {
      const el = createElementFromSpec(spec);
      return replaceElementOp(get().document, rungId, elementId, el);
    }),

  replaceElement: (rungId, elementId, element) =>
    guarded(set, get, () => replaceElementOp(get().document, rungId, elementId, element)),

  updateElement: (rungId, elementId, updates) =>
    guarded(set, get, () => updateElementPropertiesOp(get().document, rungId, elementId, updates)),

  select: (selection) => set({ selection }),

  resetDocument: (name = 'Untitled Ladder') =>
    set({ document: createEmptyEditorDocument(name), selection: null, lastErrors: [], past: [], future: [] }),

  loadProject: (project) =>
    set({ document: importFromLadderJson(project), selection: null, past: [], future: [] }),

  clearErrors: () => set({ lastErrors: [] }),

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,

  undo: () => {
    const { past, document: currentDoc, future } = get();
    if (past.length === 0) return;
    const previousDoc = past[past.length - 1];
    set({
      document: previousDoc,
      past: past.slice(0, past.length - 1),
      future: [currentDoc, ...future],
    });
  },

  redo: () => {
    const { past, document: currentDoc, future } = get();
    if (future.length === 0) return;
    const nextDoc = future[0];
    set({
      document: nextDoc,
      past: [...past, currentDoc],
      future: future.slice(1),
    });
  },

  exportToLadderJson: (options?: { validate?: boolean }) => {
    const result = exportToLadderJson(get().document, options);
    if (result.errors.length > 0) set({ lastErrors: result.errors });
    return result;
  },
}));

