import { motion, AnimatePresence } from 'framer-motion';
import { Moon, Sun } from 'lucide-react';
import { useThemeStore, resolveTheme } from '@/stores/themeStore';
import { Button } from '@/components/ui/button';

/** Small icon toggle proving the theme system actually flips at runtime. */
export function ThemeToggle() {
  const mode = useThemeStore((s) => s.mode);
  const toggle = useThemeStore((s) => s.toggle);
  const isDark = resolveTheme(mode) === 'dark';

  return (
    <Button
      variant="glass"
      size="icon"
      aria-label={isDark ? 'Ganti ke mode terang' : 'Ganti ke mode gelap'}
      onClick={toggle}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={isDark ? 'moon' : 'sun'}
          initial={{ rotate: -90, opacity: 0 }}
          animate={{ rotate: 0, opacity: 1 }}
          exit={{ rotate: 90, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="flex"
        >
          {isDark ? <Moon size={18} /> : <Sun size={18} />}
        </motion.span>
      </AnimatePresence>
    </Button>
  );
}
