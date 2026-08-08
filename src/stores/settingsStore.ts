import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AutoSaveInterval = 'off' | '30s' | '1m' | '5m' | '10m';
export type Language = 'id' | 'en';
export type ScanTime = 20 | 50 | 100 | 200;
export type ZoomLevel = 50 | 75 | 100 | 125;
export type GridSize = 20 | 40 | 60;
export type NodeSize = 'small' | 'medium' | 'large';
export type UndoLimit = 50 | 100 | 200 | 500;

interface SettingsData {
  autoSave: AutoSaveInterval;
  language: Language;
  animations: boolean;
  soundEffects: boolean;
  hapticFeedback: boolean;
  keepScreenOn: boolean;

  defaultScanTime: ScanTime;
  showGrid: boolean;
  snapToGrid: boolean;
  highlightActivePath: boolean;
  showCoordinates: boolean;
  showFPS: boolean;
  wireAnimation: boolean;
  canvasAutoCenter: boolean;
  defaultZoom: ZoomLevel;

  gridSize: GridSize;
  nodeSize: NodeSize;
  undoHistoryLimit: UndoLimit;
  autoBackup: boolean;
}

interface SettingsActions {
  update: (partial: Partial<SettingsData>) => void;
  resetSimulator: () => void;
  resetEditor: () => void;
  resetGeneral: () => void;
  resetAll: () => void;
}

type SettingsState = SettingsData & SettingsActions;

const DEFAULT_GENERAL: Pick<SettingsData, 'autoSave' | 'language' | 'animations' | 'soundEffects' | 'hapticFeedback' | 'keepScreenOn'> = {
  autoSave: '30s',
  language: 'id',
  animations: true,
  soundEffects: true,
  hapticFeedback: true,
  keepScreenOn: true,
};

const DEFAULT_SIMULATOR: Pick<SettingsData, 'defaultScanTime' | 'showGrid' | 'snapToGrid' | 'highlightActivePath' | 'showCoordinates' | 'showFPS' | 'wireAnimation' | 'canvasAutoCenter' | 'defaultZoom'> = {
  defaultScanTime: 50,
  showGrid: true,
  snapToGrid: true,
  highlightActivePath: true,
  showCoordinates: false,
  showFPS: false,
  wireAnimation: true,
  canvasAutoCenter: true,
  defaultZoom: 100,
};

const DEFAULT_EDITOR: Pick<SettingsData, 'gridSize' | 'nodeSize' | 'undoHistoryLimit' | 'autoBackup'> = {
  gridSize: 40,
  nodeSize: 'medium',
  undoHistoryLimit: 100,
  autoBackup: true,
};

const ALL_DEFAULTS: SettingsData = { ...DEFAULT_GENERAL, ...DEFAULT_SIMULATOR, ...DEFAULT_EDITOR };

const STORAGE_KEYS = [
  'autoSave', 'language', 'animations', 'soundEffects', 'hapticFeedback', 'keepScreenOn',
  'defaultScanTime', 'showGrid', 'snapToGrid', 'highlightActivePath', 'showCoordinates', 'showFPS', 'wireAnimation', 'canvasAutoCenter', 'defaultZoom',
  'gridSize', 'nodeSize', 'undoHistoryLimit', 'autoBackup',
] as const;

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...ALL_DEFAULTS,
      update: (partial) => set(partial),
      resetSimulator: () => set(DEFAULT_SIMULATOR),
      resetEditor: () => set(DEFAULT_EDITOR),
      resetGeneral: () => set(DEFAULT_GENERAL),
      resetAll: () => set(ALL_DEFAULTS),
    }),
    {
      name: 'genspace-settings',
      partialize: (state) => {
        const persisted: Record<string, unknown> = {};
        for (const key of STORAGE_KEYS) persisted[key] = state[key];
        return persisted as unknown as SettingsData;
      },
    }
  )
);
