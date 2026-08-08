import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, CircleCheck as CheckCircle2, CircleAlert as AlertCircle } from 'lucide-react';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { supabase } from '@/services/supabaseClient';

/**
 * Reset password screen — reached via the email link sent by the forgot
 * password flow. Supabase absorbs the recovery token from the URL
 * automatically when the page loads.
 */
export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) throw err;
      setDone(true);
      setTimeout(() => navigate('/login', { replace: true }), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <AuthLayout title="Password reset">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-3 text-center py-4"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 size={28} />
          </div>
          <h3 className="font-display text-lg font-semibold">Password updated</h3>
          <p className="text-sm text-muted-foreground">
            Your password has been changed. Redirecting you to login...
          </p>
          <Link
            to="/login"
            className="mt-2 rounded-2xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            style={{ minHeight: 44 }}
          >
            Go to Login
          </Link>
        </motion.div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Reset password"
      subtitle="Choose a new password for your account"
      backTo="/login"
      backLabel="Back to login"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="reset-password" className="mb-1.5 block text-xs font-medium text-muted-foreground">
            New Password
          </label>
          <div className="relative">
            <input
              id="reset-password"
              type={showPassword ? 'text' : 'password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-2xl border border-border bg-surface px-4 py-3 pr-12 text-sm outline-none transition-colors focus:border-primary dark:border-border-dark dark:bg-surface-dark"
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
        </div>

        <div>
          <label htmlFor="reset-confirm" className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Confirm New Password
          </label>
          <input
            id="reset-confirm"
            type={showPassword ? 'text' : 'password'}
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm outline-none transition-colors focus:border-primary dark:border-border-dark dark:bg-surface-dark"
            style={{ minHeight: 44 }}
            placeholder="Re-enter password"
          />
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
          {loading ? 'Saving...' : 'Reset Password'}
        </button>
      </form>
    </AuthLayout>
  );
}
