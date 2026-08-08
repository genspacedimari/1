import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/utils/cn';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm md:items-center"
          onClick={onCancel}
        >
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', bounce: 0.25, duration: 0.4 }}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              'w-full max-w-md rounded-t-3xl bg-surface p-6 shadow-glass dark:bg-surface-dark md:rounded-3xl'
            )}
          >
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-muted dark:bg-white/15 md:hidden" />
            <h3 className="font-display text-lg font-semibold">{title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{message}</p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={onCancel}
                className="flex-1 rounded-2xl border border-border px-4 py-3 text-sm font-medium transition-colors hover:bg-muted/40 dark:border-border-dark dark:hover:bg-white/5"
                style={{ minHeight: 44 }}
              >
                {cancelLabel}
              </button>
              <button
                onClick={onConfirm}
                className={cn(
                  'flex-1 rounded-2xl px-4 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90',
                  destructive ? 'bg-red-500' : 'bg-primary'
                )}
                style={{ minHeight: 44 }}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
