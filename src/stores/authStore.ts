import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/services/supabaseClient';
import { profileRowToProfile, type Profile, type PublicRole } from '@/types/user';

const AUTH_DEBUG = true;

function authLog(...args: unknown[]) {
  if (AUTH_DEBUG) console.log('[AUTH]', ...args);
}

export type AuthStatus =
  | 'initializing'
  | 'authenticated'
  | 'unauthenticated'
  | 'guest';

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isGuest: boolean;
  status: AuthStatus;
  loading: boolean;
  error: string | null;

  setSession: (session: Session | null) => void;
  setProfile: (profile: Profile | null) => void;
  setStatus: (status: AuthStatus) => void;
  setLoading: (v: boolean) => void;
  setError: (error: string | null) => void;
  enterGuest: () => void;
  exitGuest: () => void;
  clear: () => void;

  signIn: (email: string, password: string) => Promise<void>;
  signUp: (params: {
    fullName: string;
    username: string;
    email: string;
    password: string;
    role: PublicRole;
    schoolId?: string | null;
  }) => Promise<void>;
  signInAsGuest: () => void;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (partial: Partial<Pick<Profile, 'fullName' | 'username' | 'bio' | 'avatarUrl' | 'schoolId'>>) => Promise<void>;
  changePassword: (newPassword: string) => Promise<void>;
  deleteAccount: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  isGuest: false,
  status: 'initializing',
  loading: false,
  error: null,

  setSession: (session) => {
    authLog('setSession', session ? 'has session' : 'null session');
    set({ session, user: session?.user ?? null });
  },

  setProfile: (profile) => {
    authLog('setProfile', profile ? `profile=${profile.username}` : 'null profile');
    set({ profile });
  },

  setStatus: (status) => {
    authLog('setStatus', status);
    set({ status });
  },

  setLoading: (v) => set({ loading: v }),
  setError: (error) => set({ error }),
  enterGuest: () => set({ isGuest: true }),
  exitGuest: () => set({ isGuest: false }),

  clear: () => {
    authLog('clear() — resetting all auth state');
    set({
      session: null,
      user: null,
      profile: null,
      isGuest: false,
      status: 'unauthenticated',
      error: null,
      loading: false,
    });
  },

  signIn: async (email, password) => {
    authLog('LOGIN START', email);
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        authLog('LOGIN ERROR', error.message);
        throw error;
      }
      authLog('LOGIN SUCCESS', data.user?.id);

      // onAuthStateChange will set session/profile/status.
      // But we also fetch profile here for immediate availability.
      try {
        const profile = await fetchProfile(data.user.id);
        if (profile) {
          authLog('PROFILE SUCCESS (from signIn)', profile.username);
          set({ profile, isGuest: false, status: 'authenticated' });
        } else {
          authLog('PROFILE NULL (from signIn) — will retry via onAuthStateChange');
          // Profile doesn't exist yet — try to create it
          await ensureProfile(data.user);
          const retryProfile = await fetchProfile(data.user.id);
          if (retryProfile) {
            authLog('PROFILE CREATED + LOADED (from signIn)', retryProfile.username);
            set({ profile: retryProfile, isGuest: false, status: 'authenticated' });
          }
        }
      } catch (profileErr) {
        authLog('PROFILE FETCH FAILED (from signIn) — keeping session', profileErr);
        // Keep the session; onAuthStateChange will retry
        set({ isGuest: false, status: 'authenticated' });
      }

      // Update last_login (fire-and-forget)
      supabase
        .from('profiles')
        .update({ last_login: new Date().toISOString() })
        .eq('id', data.user.id)
        .then(() => {});
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sign in failed';
      authLog('LOGIN CATCH', msg);
      set({ error: msg });
      throw err;
    } finally {
      set({ loading: false });
    }
  },

  signUp: async ({ fullName, username, email, password, role }) => {
    authLog('REGISTER START', email, username, role);
    set({ loading: true, error: null });
    try {
      // Check username availability first
      const { data: usernameAvailable, error: usernameCheckError } = await supabase.rpc(
        'check_username_available',
        { p_username: username }
      );
      if (usernameCheckError) throw usernameCheckError;
      if (usernameAvailable === false) {
        throw new Error('Username is already taken. Please choose another.');
      }

      authLog('REGISTER — calling supabase.auth.signUp');
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName, username, role },
        },
      });
      if (error) {
        authLog('REGISTER ERROR', error.message);
        throw error;
      }
      authLog('REGISTER SUCCESS', data.user?.id, 'session?', !!data.session);

      if (data.session && data.user) {
        authLog('SESSION RECEIVED (from signUp)');
        // Session is active — fetch profile
        try {
          let profile = await fetchProfile(data.user.id);
          if (!profile) {
            authLog('PROFILE NULL (from signUp) — creating profile');
            await ensureProfile(data.user);
            profile = await fetchProfile(data.user.id);
          }
          if (profile) {
            authLog('PROFILE SUCCESS (from signUp)', profile.username);
          }
          set({
            session: data.session,
            user: data.user,
            profile,
            isGuest: false,
            status: 'authenticated',
          });
          authLog('AUTH STORE UPDATED (from signUp)');
        } catch (profileErr) {
          authLog('PROFILE FETCH FAILED (from signUp) — keeping session', profileErr);
          set({
            session: data.session,
            user: data.user,
            isGuest: false,
            status: 'authenticated',
          });
        }
      } else if (data.user) {
        // Email confirmation required — no session
        authLog('REGISTER — no session (email confirmation may be required)');
        set({
          user: data.user,
          isGuest: false,
          status: 'unauthenticated',
          error: 'Check your email for a confirmation link to complete registration.',
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Registration failed';
      authLog('REGISTER CATCH', msg);
      set({ error: msg });
      throw err;
    } finally {
      set({ loading: false });
    }
  },

  signInAsGuest: () => {
    authLog('SIGN IN AS GUEST');
    set({
      session: null,
      user: null,
      profile: null,
      isGuest: true,
      status: 'guest',
      error: null,
    });
  },

  signOut: async () => {
    authLog('SIGN OUT');
    await supabase.auth.signOut();
    get().clear();
  },

  refreshProfile: async () => {
    const user = get().user;
    if (!user) return;
    try {
      const profile = await fetchProfile(user.id);
      set({ profile });
    } catch (err) {
      authLog('REFRESH PROFILE FAILED', err);
    }
  },

  updateProfile: async (partial) => {
    const user = get().user;
    if (!user) throw new Error('Not signed in');
    const row: Record<string, unknown> = {};
    if (partial.fullName !== undefined) row.full_name = partial.fullName;
    if (partial.username !== undefined) row.username = partial.username;
    if (partial.bio !== undefined) row.bio = partial.bio;
    if (partial.avatarUrl !== undefined) row.avatar_url = partial.avatarUrl;
    if (partial.schoolId !== undefined) row.school_id = partial.schoolId;

    const { error } = await supabase.from('profiles').update(row).eq('id', user.id);
    if (error) throw error;
    await get().refreshProfile();
  },

  changePassword: async (newPassword) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  },

  deleteAccount: async () => {
    const user = get().user;
    if (!user) throw new Error('Not signed in');
    const { error: profileErr } = await supabase.from('profiles').delete().eq('id', user.id);
    if (profileErr) throw profileErr;
    await supabase.auth.signOut();
    get().clear();
  },
}));

/**
 * Fetches a user's profile from the profiles table.
 * Returns null if the profile doesn't exist (does NOT throw).
 */
export async function fetchProfile(userId: string): Promise<Profile | null> {
  authLog('FETCH PROFILE', userId);

  // Fetch profile row WITHOUT the schools join first — the join can fail
  // due to RLS on the schools table, which would make the entire query
  // error out and lose the profile data too.
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    authLog('FETCH PROFILE ERROR', error.message, error.code);
    throw error;
  }
  if (!data) {
    authLog('FETCH PROFILE — no row found');
    return null;
  }
  const profile = profileRowToProfile(data);

  // Best-effort: fetch school name separately if school_id exists
  if (profile.schoolId) {
    try {
      const { data: school } = await supabase
        .from('schools')
        .select('name')
        .eq('id', profile.schoolId)
        .maybeSingle();
      profile.schoolName = (school as { name: string } | null)?.name ?? null;
    } catch {
      // RLS may block reading schools — that's fine, schoolName stays null
      authLog('FETCH PROFILE — school name fetch blocked by RLS (ok)');
    }
  }

  authLog('FETCH PROFILE SUCCESS', profile.username);
  return profile;
}

/**
 * Creates a profile row if it doesn't exist.
 * This handles users who were created before the handle_new_user trigger
 * was added, or cases where the trigger failed silently.
 */
export async function ensureProfile(user: User): Promise<void> {
  authLog('ENSURE PROFILE', user.id, user.email);
  const meta = user.user_metadata ?? {};
  const fullName = (meta.full_name as string) ?? '';
  const username = (meta.username as string) ?? user.email?.split('@')[0] ?? 'user';
  const role = ((meta.role as string) ?? 'student') as 'student' | 'teacher' | 'admin';

  const { error } = await supabase.from('profiles').insert({
    id: user.id,
    full_name: fullName,
    username,
    email: user.email ?? '',
    role: role === 'admin' ? 'student' : role,
  });
  if (error) {
    // If it's a duplicate, that's fine — profile already exists
    if (error.code !== '23505') {
      authLog('ENSURE PROFILE ERROR', error.message);
      throw error;
    }
    authLog('ENSURE PROFILE — already exists (duplicate, ok)');
  } else {
    authLog('ENSURE PROFILE — created successfully');
  }
}
