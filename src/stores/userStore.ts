import { create } from 'zustand';
import type { Profile } from '@/types/user';

interface UserState {
  profile: Profile | null;
  isLoading: boolean;
  setProfile: (profile: Profile | null) => void;
  setLoading: (isLoading: boolean) => void;
  clear: () => void;
}

/**
 * Holds the logged-in user's profile in memory for the whole app.
 * Auth wiring (Supabase sign-in, session restore) lands in the auth phase —
 * this store only owns the resulting state, kept separate on purpose so
 * screens can consume `profile` without caring how it got populated.
 */
export const useUserStore = create<UserState>((set) => ({
  profile: null,
  isLoading: false,
  setProfile: (profile) => set({ profile }),
  setLoading: (isLoading) => set({ isLoading }),
  clear: () => set({ profile: null }),
}));
