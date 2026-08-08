import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, GraduationCap, Presentation, CircleAlert as AlertCircle } from 'lucide-react';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { useAuthStore } from '@/stores/authStore';
import type { PublicRole } from '@/types/user';
import { cn } from '@/utils/cn';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const signIn = useAuthStore((s) => s.signIn);
  const signInAsGuest = useAuthStore((s) => s.signInAsGuest);
  const loading = useAuthStore((s) => s.loading);
  const error = useAuthStore((s) => s.error);
  const setError = useAuthStore((s) => s.setError);

  const [selectedRole, setSelectedRole] = useState<PublicRole>('student');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);

  const from = (location.state as { from?: string } | null)?.from ?? '/';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await signIn(email, password);
      // signIn sets the store synchronously. Read the profile to determine redirect.
      // If profile is null (still loading), default to `from` — onAuthStateChange
      // will finish loading and the route guard will handle it.
      const profile = useAuthStore.getState().profile;
      const dest =
        profile?.role === 'teacher' ? '/teacher' : profile?.role === 'admin' ? '/admin' : from;
      navigate(dest, { replace: true });
    } catch {
      /* error surfaced via store */
    }
  };

  const handleGuest = () => {
    signInAsGuest();
    navigate('/', { replace: true });
  };

  const ROLE_OPTIONS: { value: PublicRole; label: string; icon: typeof GraduationCap; desc: string }[] = [
    { value: 'student', label: 'Student', icon: GraduationCap, desc: 'Learn & practice PLC' },
    { value: 'teacher', label: 'Teacher', icon: Presentation, desc: 'Create materials & exams' },
  ];

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to continue your PLC journey">
      {/* Role selection — UI only, does not determine the actual role */}
      <div className="mb-5">
        <p className="mb-2 text-xs font-medium text-muted-foreground">I am a...</p>
        <div className="grid grid-cols-2 gap-3">
          {ROLE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setSelectedRole(opt.value)}
              className={cn(
                'flex flex-col items-center gap-1.5 rounded-2xl border p-4 text-center transition-all',
                selectedRole === opt.value
                  ? 'border-primary bg-primary/10'
                  : 'border-border dark:border-border-dark bg-transparent hover:bg-muted/30 dark:hover:bg-white/5'
              )}
              style={{ minHeight: 44 }}
            >
              <opt.icon
                size={24}
                className={selectedRole === opt.value ? 'text-primary' : 'text-muted-foreground'}
              />
              <span className="text-sm font-medium">{opt.label}</span>
              <span className="text-[11px] text-muted-foreground">{opt.desc}</span>
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label htmlFor="login-email" className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Email
          </label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm outline-none transition-colors focus:border-primary dark:border-border-dark dark:bg-surface-dark"
            style={{ minHeight: 44 }}
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label htmlFor="login-password" className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Password
          </label>
          <div className="relative">
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-2xl border border-border bg-surface px-4 py-3 pr-12 text-sm outline-none transition-colors focus:border-primary dark:border-border-dark dark:bg-surface-dark"
              style={{ minHeight: 44 }}
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-primary"
              style={{ minHeight: 44, minWidth: 44 }}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <button
              type="button"
              role="checkbox"
              aria-checked={remember}
              onClick={() => setRemember((v) => !v)}
              className={cn(
                'flex h-5 w-5 items-center justify-center rounded-md border transition-colors',
                remember
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border dark:border-border-dark'
              )}
            >
              {remember && (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
            Remember me
          </label>
          <Link to="/forgot-password" className="text-sm font-medium text-primary transition-opacity hover:opacity-80">
            Forgot password?
          </Link>
        </div>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-start gap-2 rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400"
            >
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-2xl bg-primary py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ minHeight: 44 }}
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>

      <div className="my-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-border dark:bg-border-dark" />
        <span className="text-xs text-muted-foreground">or</span>
        <div className="h-px flex-1 bg-border dark:bg-border-dark" />
      </div>

      <button
        type="button"
        onClick={handleGuest}
        className="w-full rounded-2xl border border-border bg-transparent py-3 text-sm font-medium transition-colors hover:bg-muted/40 dark:border-border-dark dark:hover:bg-white/5"
        style={{ minHeight: 44 }}
      >
        Continue as Guest
      </button>

      <p className="mt-5 text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{' '}
        <Link to="/register" className="font-semibold text-primary transition-opacity hover:opacity-80">
          Register
        </Link>
      </p>
    </AuthLayout>
  );
}
