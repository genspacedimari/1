import { useCallback, useState } from 'react';
import { CircleAlert as AlertCircle, CircleCheck as CheckCircle, X } from 'lucide-react';

export interface ToastState {
  id: number;
  message: string;
  variant: 'error' | 'success';
}

/**
 * Minimal local toast hook. No external toast library exists in this
 * project, so this provides a lightweight, dependency-free way to show
 * transient success/error feedback without failing silently.
 */
export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = useCallback((message: string, variant: 'error' | 'success' = 'error') => {
    const id = Date.now();
    setToast({ id, message, variant });
    window.setTimeout(() => {
      setToast((current) => (current?.id === id ? null : current));
    }, 4000);
  }, []);

  const dismissToast = useCallback(() => setToast(null), []);

  return { toast, showToast, dismissToast };
}

export function ToastViewport({ toast, onDismiss }: { toast: ToastState | null; onDismiss: () => void }) {
  if (!toast) return null;
  const isError = toast.variant === 'error';
  return (
    <div
      className={
        'fixed bottom-4 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 items-start gap-2 rounded-2xl px-4 py-3 text-sm shadow-lg ' +
        (isError
          ? 'bg-red-600 text-white'
          : 'bg-emerald-600 text-white')
      }
      role="status"
    >
      {isError ? <AlertCircle size={16} className="mt-0.5 shrink-0" /> : <CheckCircle size={16} className="mt-0.5 shrink-0" />}
      <span className="flex-1">{toast.message}</span>
      <button onClick={onDismiss} className="shrink-0 opacity-80 hover:opacity-100" aria-label="Dismiss">
        <X size={16} />
      </button>
    </div>
  );
}
