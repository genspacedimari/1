import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import type { UserRole } from '@/types/user';

interface RequireAuthProps {
  children: React.ReactNode;
  roles?: UserRole[];
}

function FullScreenSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

/**
 * Route guard for protected pages.
 *
 * Authentication is determined by `status` from the auth store:
 * - `initializing` → show spinner (don't redirect yet)
 * - `authenticated` → render children
 * - `unauthenticated` / `guest` → redirect to /login
 *
 * We also show a spinner when `status === 'authenticated'` but `profile` is
 * still null (profile fetch in progress). This prevents the Profile page
 * from briefly showing "please sign in" before the profile loads.
 */
export function RequireAuth({ children, roles }: RequireAuthProps) {
  const location = useLocation();
  const status = useAuthStore((s) => s.status);
  const profile = useAuthStore((s) => s.profile);

  if (status === 'initializing') {
    return <FullScreenSpinner />;
  }

  if (status !== 'authenticated') {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  // Authenticated — render children even if profile is still loading.
  // The Profile page handles null profile with its own UI.
  // Do NOT block on profile — auth and profile are separate concerns.

  // Role check (skip if profile not loaded yet — page will handle)
  if (profile && roles && !roles.includes(profile.role)) {
    const home =
      profile.role === 'teacher' ? '/teacher' : profile.role === 'admin' ? '/admin' : '/';
    return <Navigate to={home} replace />;
  }

  // Teacher first-login wizard
  if (
    profile &&
    profile.role === 'teacher' &&
    !profile.schoolId &&
    !location.pathname.startsWith('/welcome') &&
    !location.pathname.startsWith('/join')
  ) {
    return <Navigate to="/welcome" replace />;
  }

  return <>{children}</>;
}

/**
 * Keeps authenticated users away from auth screens (login/register).
 * Guests ARE allowed on these screens so they can sign in.
 *
 * Only redirects when `status === 'authenticated'` — never during
 * `initializing`, which would prematurely bounce users off the login
 * page before the session is restored from localStorage.
 */
export function RedirectIfAuthed({ children }: { children: React.ReactNode }) {
  const status = useAuthStore((s) => s.status);

  if (status === 'initializing') {
    return <FullScreenSpinner />;
  }

  if (status === 'authenticated') {
    const profile = useAuthStore.getState().profile;
    const home =
      profile?.role === 'teacher' ? '/teacher' : profile?.role === 'admin' ? '/admin' : '/';
    return <Navigate to={home} replace />;
  }

  return <>{children}</>;
}
