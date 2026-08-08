import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
}

/**
 * Theme store — the single source of truth for light/dark/system preference.
 * Persisted to localStorage so the choice survives a refresh (and, once
 * SQLite/Capacitor lands, this same store can be rehydrated from
 * offline_settings instead without changing any consuming component).
 */
export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: 'system',
      setMode: (mode) => set({ mode }),
      toggle: () => {
        const current = get().mode;
        const resolved = current === 'system' ? getSystemPrefersDark() : current === 'dark';
        set({ mode: resolved ? 'light' : 'dark' });
      },
    }),
    { name: 'genspace-theme' }
  )
);

export function getSystemPrefersDark(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/** Resolves 'system' down to an actual light/dark value for rendering logic. */
export function resolveTheme(mode: ThemeMode): 'light' | 'dark' {
  return mode === 'system' ? (getSystemPrefersDark() ? 'dark' : 'light') : mode;
}
