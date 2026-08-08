import { create } from 'zustand';

// Skeleton only — quiz flow (join by code, question rendering, grading)
// is built in the Quiz System phase. Placeholder keeps the store convention
// consistent across domains.
interface QuizState {
  activeExamCode: string | null;
  setActiveExamCode: (code: string | null) => void;
}

export const useQuizStore = create<QuizState>((set) => ({
  activeExamCode: null,
  setActiveExamCode: (activeExamCode) => set({ activeExamCode }),
}));
