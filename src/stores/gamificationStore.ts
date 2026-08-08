import { create } from 'zustand';

// Skeleton only — XP/level/badge/streak logic is built in the Gamification
// phase, driven off the `profiles`, `achievements`, and `leaderboards` tables.
interface GamificationState {
  streak: number;
  setStreak: (streak: number) => void;
}

export const useGamificationStore = create<GamificationState>((set) => ({
  streak: 0,
  setStreak: (streak) => set({ streak }),
}));
