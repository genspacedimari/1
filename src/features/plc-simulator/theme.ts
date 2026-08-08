import { useThemeStore, resolveTheme } from '@/stores/themeStore';

/**
 * Color/typography tokens lifted 1:1 from the Figma "GENSPACE Android App
 * Prototype" simulator screen (src/screens/SimulatorEditorScreen.tsx in that
 * export). This is a deliberate, page-scoped override of the app's normal
 * orange brand palette (tailwind.config.ts) — the simulator is meant to look
 * like an industrial CX-Programmer-style tool, not a marketing surface, and
 * that's what the Figma design specifies. Nothing here changes any other
 * page's look.
 */
export const SIM_FONT_MONO = "'JetBrains Mono', monospace";
export const SIM_FONT_SANS = "'Inter', sans-serif";

export interface SimPalette {
  isDark: boolean;
  bg: string;
  appBar: string;
  toolbar: string;
  text: string;
  muted: string;
  border: string;
  workspace: string;
  rungBg: string;
  railColor: string;
  gridLine: string;
  inputBg: string;
  cardBg: string;
}

export function simPalette(isDark: boolean): SimPalette {
  return {
    isDark,
    bg: isDark ? '#1A1A1A' : '#F0F0F0',
    appBar: isDark ? '#2A2A2A' : '#FFFFFF',
    toolbar: isDark ? '#222222' : '#F7F7F7',
    text: isDark ? '#F5F5F5' : '#1C1C1C',
    muted: isDark ? '#9E9E9E' : '#757575',
    border: isDark ? '#404040' : '#E0E0E0',
    workspace: isDark ? '#1A1A1A' : '#FAFAFA',
    rungBg: isDark ? '#242424' : '#FFFFFF',
    railColor: isDark ? '#E5E5E5' : '#2D2D2D',
    gridLine: isDark ? '#333333' : '#EAEAEA',
    inputBg: isDark ? '#333333' : '#F7F7F7',
    cardBg: isDark ? '#2A2A2A' : '#FFFFFF',
  };
}

/** Per-instruction-kind accent color, matching the Figma toolbar exactly. */
export const SIM_KIND_COLOR = {
  contactNO: '#2563EB',
  contactNC: '#7C3AED',
  contactEdge: '#2563EB',
  memoryContact: '#7C3AED',
  coil: '#059669',
  coilSet: '#059669',
  coilReset: '#DC2626',
  timer: '#D97706',
  counter: '#0891B2',
  wire: '#6B7280',
  delete: '#EF4444',
  powerOn: '#22C55E',
  run: '#22C55E',
  stop: '#EF4444',
  fab: '#F59E0B',
} as const;

/** Resolves the app's global theme store down to a simple boolean, exactly
 * like the Figma component's `theme === 'dark'` prop — so this page always
 * follows the same light/dark/system preference as the rest of GENSPACE. */
export function useSimIsDark(): boolean {
  const mode = useThemeStore((s) => s.mode);
  return resolveTheme(mode) === 'dark';
}
