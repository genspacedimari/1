import { useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, GraduationCap, Presentation, CircleAlert as AlertCircle, Check } from 'lucide-react';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { useAuthStore } from '@/stores/authStore';
import type { PublicRole } from '@/types/user';
import { supabase } from '@/services/supabaseClient';
import { cn } from '@/utils/cn';

interface FieldErrors {
  fullName?: string;
  username?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const signUp = useAuthStore((s) => s.signUp);
  const loading = useAuthStore((s) => s.loading);
  const error = useAuthStore((s) => s.error);
  const setError = useAuthStore((s) => s.setError);

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedRole, setSelectedRole] = useState<PublicRole>('student');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [usernameChecking, setUsernameChecking] = useState(false);

  const checkUsername = useCallback(async (value: string) => {
    if (value.length < 3) return;
    setUsernameChecking(true);
    try {
      const { data: available, error } = await supabase.rpc('check_username_available', {
        p_username: value,
      });
      if (error) throw error;
      setFieldErrors((prev) => ({
        ...prev,
        username: available === false ? 'Username is already taken' : undefined,
      }));
    } catch {
      /* ignore — DB check is best-effort */
    } finally {
      setUsernameChecking(false);
    }
  }, []);

  const validate = (): boolean => {
    const errs: FieldErrors = {};
    if (!fullName.trim()) errs.fullName = 'Full name is required';
    if (username.trim().length < 3) errs.username = 'Username must be at least 3 characters';
    if (!/^[a-zA-Z0-9_]+$/.test(username)) errs.username = 'Only letters, numbers, and underscores';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'Enter a valid email';
    if (password.length < 8) errs.password = 'Password must be at least 8 characters';
    if (password !== confirmPassword) errs.confirmPassword = 'Passwords do not match';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!validate()) return;
    if (fieldErrors.username) return;
    try {
      await signUp({ fullName, username, email, password, role: selectedRole });
      const profile = useAuthStore.getState().profile;
      const dest = profile?.role === 'teacher' ? '/teacher' : '/';
      navigate(dest, { replace: true });
    } catch {
      /* error surfaced via store */
    }
  };

  const ROLE_OPTIONS: { value: PublicRole; label: string; icon: typeof GraduationCap; desc: string }[] = [
    { value: 'student', label: 'Student', icon: GraduationCap, desc: 'Learn & practice PLC' },
    { value: 'teacher', label: 'Teacher', icon: Presentation, desc: 'Create materials & exams' },
  ];

  const inputClass =
    'w-full rounded-2xl border bg-surface px-4 py-3 text-sm outline-none transition-colors focus:border-primary dark:bg-surface-dark';

  return (
    <AuthLayout title="Create your account" subtitle="Join GENSPACE PLC in seconds" backTo="/login" backLabel="Back to login">
      {/* Role selection */}
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

      <form onSubmit={handleRegister} className="space-y-4">
        <div>
          <label htmlFor="reg-name" className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Full Name
          </label>
          <input
            id="reg-name"
            type="text"
            required
            value={fullName}
            onChange={(e) => {
              setFullName(e.target.value);
              setFieldErrors((p) => ({ ...p, fullName: undefined }));
            }}
            className={cn(inputClass, fieldErrors.fullName ? 'border-red-500' : 'border-border dark:border-border-dark')}
            style={{ minHeight: 44 }}
            placeholder="Bintang Pratama"
          />
          {fieldErrors.fullName && <p className="mt-1 text-xs text-red-500">{fieldErrors.fullName}</p>}
        </div>

        <div>
          <label htmlFor="reg-username" className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Username
          </label>
          <input
            id="reg-username"
            type="text"
            required
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              setFieldErrors((p) => ({ ...p, username: undefined }));
            }}
            onBlur={(e) => checkUsername(e.target.value)}
            className={cn(inputClass, fieldErrors.username ? 'border-red-500' : 'border-border dark:border-border-dark')}
            style={{ minHeight: 44 }}
            placeholder="bintang_p"
          />
          {fieldErrors.username && <p className="mt-1 text-xs text-red-500">{fieldErrors.username}</p>}
          {usernameChecking && <p className="mt-1 text-xs text-muted-foreground">Checking...</p>}
        </div>

        <div>
          <label htmlFor="reg-email" className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Email
          </label>
          <input
            id="reg-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setFieldErrors((p) => ({ ...p, email: undefined }));
            }}
            className={cn(inputClass, fieldErrors.email ? 'border-red-500' : 'border-border dark:border-border-dark')}
            style={{ minHeight: 44 }}
            placeholder="you@example.com"
          />
          {fieldErrors.email && <p className="mt-1 text-xs text-red-500">{fieldErrors.email}</p>}
        </div>

        <div>
          <label htmlFor="reg-password" className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Password
          </label>
          <div className="relative">
            <input
              id="reg-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setFieldErrors((p) => ({ ...p, password: undefined }));
              }}
              className={cn(inputClass, 'pr-12', fieldErrors.password ? 'border-red-500' : 'border-border dark:border-border-dark')}
              style={{ minHeight: 44 }}
              placeholder="At least 8 characters"
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
          {fieldErrors.password ? (
            <p className="mt-1 text-xs text-red-500">{fieldErrors.password}</p>
          ) : (
            password.length > 0 && (
              <p className="mt-1 flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                <Check size={12} /> {password.length} characters
              </p>
            )
          )}
        </div>

        <div>
          <label htmlFor="reg-confirm" className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Confirm Password
          </label>
          <input
            id="reg-confirm"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              setFieldErrors((p) => ({ ...p, confirmPassword: undefined }));
            }}
            className={cn(inputClass, fieldErrors.confirmPassword ? 'border-red-500' : 'border-border dark:border-border-dark')}
            style={{ minHeight: 44 }}
            placeholder="Re-enter password"
          />
          {fieldErrors.confirmPassword && <p className="mt-1 text-xs text-red-500">{fieldErrors.confirmPassword}</p>}
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
          {loading ? 'Creating account...' : 'Create Account'}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold text-primary transition-opacity hover:opacity-80">
          Sign In
        </Link>
      </p>
    </AuthLayout>
  );
}
