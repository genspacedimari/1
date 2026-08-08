import { useEffect } from 'react';
import { useThemeStore, resolveTheme } from '@/stores/themeStore';

/**
 * Applies the resolved theme to <html class="dark"> so every Tailwind
 * `dark:` utility across the app responds — and keeps listening to OS-level
 * changes when the user's preference is 'system'.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const mode = useThemeStore((s) => s.mode);

  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      root.classList.toggle('dark', resolveTheme(mode) === 'dark');
    };
    apply();

    if (mode === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      mq.addEventListener('change', apply);
      return () => mq.removeEventListener('change', apply);
    }
  }, [mode]);

  return <>{children}</>;
}
