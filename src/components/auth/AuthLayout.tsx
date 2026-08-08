import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { cn } from '@/utils/cn';

/**
 * Shared full-screen shell for auth screens (login, register, forgot
 * password). Centered card with the GENSPACE brand mark and a back link.
 */
export function AuthLayout({
  title,
  subtitle,
  backTo,
  backLabel,
  children,
}: {
  title: string;
  subtitle?: string;
  backTo?: string;
  backLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-secondary px-5 py-10 dark:bg-surface-dark">
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden opacity-40"
        aria-hidden
      >
        <div
          className="absolute -right-24 -top-24 h-72 w-72 rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle, #F26B3A 0%, transparent 70%)' }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="relative w-full max-w-md"
      >
        {/* Brand */}
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-primary text-primary-foreground shadow-sm">
            <span className="font-display text-2xl font-bold">G</span>
          </div>
          <h1 className="font-display text-2xl font-semibold">GENSPACE PLC</h1>
          <p className="text-sm text-muted-foreground">One Space for Everything.</p>
        </div>

        <div className={cn('glass rounded-3xl p-6 md:p-8')}>
          <h2 className="font-display text-xl font-semibold">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>

        {backTo && (
          <div className="mt-5 text-center">
            <Link
              to={backTo}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
            >
              {backLabel ?? 'Back'}
            </Link>
          </div>
        )}
      </motion.div>
    </div>
  );
}
