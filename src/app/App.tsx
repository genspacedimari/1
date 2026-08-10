import { RouterProvider } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { router } from './router';
import { ThemeProvider } from './providers/ThemeProvider';
import { AuthProvider } from './providers/AuthProvider';
import { SettingsEffectsProvider } from './providers/SettingsEffectsProvider';
import { useSettingsStore } from '@/stores/settingsStore';

export default function App() {
  // Global switch for the "Animations" setting — framer-motion honors
  // reducedMotion="always" by resolving every animation straight to its
  // end state instead of playing it, app-wide.
  const animations = useSettingsStore((s) => s.animations);

  return (
    <ThemeProvider>
      <SettingsEffectsProvider>
        <MotionConfig reducedMotion={animations ? 'never' : 'always'}>
          <AuthProvider>
            <RouterProvider router={router} />
          </AuthProvider>
        </MotionConfig>
      </SettingsEffectsProvider>
    </ThemeProvider>
  );
}
