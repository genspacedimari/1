import { create } from 'zustand';
import type { CompetitionInfo, CompetitionResult } from './types';
import * as svc from './services';

interface CompetitionState {
  activeCompetition: CompetitionInfo | null;
  lastResult: CompetitionResult | null;
  loading: boolean;
  error: string | null;
  joinByCode: (code: string) => Promise<CompetitionInfo | null>;
  submit: (input: { score: number; correctCount: number; wrongCount: number; timeUsedSeconds: number; answers: Record<string, number> }) => Promise<CompetitionResult | null>;
  clear: () => void;
}

export const useCompetitionStore = create<CompetitionState>((set, get) => ({
  activeCompetition: null,
  lastResult: null,
  loading: false,
  error: null,

  joinByCode: async (code) => {
    set({ loading: true, error: null });
    try {
      const info = await svc.findCompetitionByCode(code);
      set({ activeCompetition: info, loading: false });
      return info;
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Gagal memuat kompetisi.', loading: false, activeCompetition: null });
      return null;
    }
  },

  submit: async (input) => {
    const competition = get().activeCompetition;
    if (!competition) return null;
    set({ loading: true, error: null });
    try {
      const result = await svc.submitCompetitionResult({ competitionId: competition.id, ...input });
      set({ lastResult: result, loading: false });
      return result;
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Gagal mengirim jawaban.', loading: false });
      return null;
    }
  },

  clear: () => set({ activeCompetition: null, lastResult: null, error: null }),
}));
