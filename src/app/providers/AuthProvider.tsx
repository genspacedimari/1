import { useEffect } from 'react';
import { supabase } from '@/services/supabaseClient';
import { useAuthStore, fetchProfile, ensureProfile } from '@/stores/authStore';

const AUTH_DEBUG = true;
function authLog(...args: unknown[]) {
  if (AUTH_DEBUG) console.log('[AUTH]', ...args);
}

/**
 * Single source of truth for auth state synchronization.
 *
 * Architecture:
 * - `onAuthStateChange` is the ONLY place that sets session/profile/status.
 * - `signIn()` and `signUp()` call Supabase auth methods, which trigger
 *   `onAuthStateChange`, which updates the store. This prevents race
 *   conditions where the store is updated in two places simultaneously.
 * - `getSession()` runs once on mount to restore any persisted session
 *   from localStorage. It sets `initializing=false` when done.
 * - If a profile doesn't exist (e.g., trigger failed), we create it
 *   via `ensureProfile()` instead of logging the user out.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const setSession = useAuthStore((s) => s.setSession);
  const setProfile = useAuthStore((s) => s.setProfile);
  const setStatus = useAuthStore((s) => s.setStatus);
  const isGuest = useAuthStore((s) => s.isGuest);

  useEffect(() => {
    let mounted = true;

    // 1. Restore session from localStorage on mount
    (async () => {
      authLog('INITIALIZE AUTH — getSession()');
      const { data, error } = await supabase.auth.getSession();
      if (!mounted) return;

      if (error) {
        authLog('INITIALIZE AUTH — getSession error', error.message);
      }

      if (data.session) {
        authLog('GET SESSION — found existing session', data.session.user.id);
        setSession(data.session);
        // Profile will be loaded by onAuthStateChange INITIAL_SESSION event
      } else {
        authLog('GET SESSION — no session');
      }

      // onAuthStateChange will fire with INITIAL_SESSION and handle profile loading.
      // But if there's no session, we set status here.
      if (!data.session && !isGuest) {
        setStatus('unauthenticated');
      } else if (!data.session && isGuest) {
        setStatus('guest');
      }
    })();

    // 2. Subscribe to ALL auth state changes — this is the single source of truth
    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      authLog('ON AUTH STATE CHANGE', event, session ? 'has session' : 'no session');

      // Update session in store
      setSession(session);

      if (session) {
        // Clear guest mode when a real session appears
        if (useAuthStore.getState().isGuest) {
          authLog('ON AUTH STATE CHANGE — clearing guest mode');
          useAuthStore.setState({ isGuest: false });
        }

        // Set authenticated status IMMEDIATELY — before profile fetch.
        // Auth and profile are separate concerns. The user is authenticated
        // the moment a session exists, even if profile loading fails.
        setStatus('authenticated');
        authLog('AUTH STORE UPDATED — status=authenticated (before profile fetch)');

        // Fetch profile (best-effort — does NOT affect auth status)
        try {
          authLog('FETCH PROFILE (from onAuthStateChange)', session.user.id);
          let profile = await fetchProfile(session.user.id);
          if (!profile) {
            authLog('PROFILE NULL (from onAuthStateChange) — creating profile');
            await ensureProfile(session.user);
            profile = await fetchProfile(session.user.id);
          }
          if (profile) {
            authLog('PROFILE SUCCESS (from onAuthStateChange)', profile.username);
            setProfile(profile);
          } else {
            authLog('PROFILE STILL NULL after ensureProfile — keeping session, profile=null');
            setProfile(null);
          }
        } catch (profileErr) {
          authLog('PROFILE FETCH FAILED (from onAuthStateChange) — keeping session', profileErr);
          // Do NOT clear the session. Do NOT change status. Profile loading is separate from auth.
          setProfile(null);
        }
      } else {
        // No session — could be sign out or initial state
        setProfile(null);
        if (event === 'SIGNED_OUT') {
          authLog('ON AUTH STATE CHANGE — SIGNED_OUT, clearing state');
          useAuthStore.getState().clear();
        } else if (!isGuest) {
          setStatus('unauthenticated');
        }
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Guest mode: ensure initializing is cleared
  useEffect(() => {
    if (isGuest) {
      setStatus('guest');
    }
  }, [isGuest, setStatus]);

  return <>{children}</>;
}
