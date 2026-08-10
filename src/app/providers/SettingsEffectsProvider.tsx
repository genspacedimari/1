import { useEffect, useRef, useState } from 'react';
import { useSettingsStore } from '@/stores/settingsStore';
import { requestWakeLock, releaseWakeLock } from '@/utils/wakeLock';
import { router } from '../router';

const SIMULATOR_PATH = /^\/simulator\/editor\//;

/**
 * Applies the handful of Settings values that need a real, app-wide effect
 * rather than a component-local one:
 *
 * - `language`  -> sets <html lang="id|en"> (screen readers / browser UI cue)
 * - `animations`-> toggles `<html data-animations="off">`, which
 *   src/styles/globals.css uses to force-disable CSS transitions/animations
 *   everywhere, and flips Framer Motion's global `reducedMotion` mode.
 * - `keepScreenOn` -> requests a Screen Wake Lock only while the user is
 *   actually inside a running simulator session (route-based, read via the
 *   router's own subscription — the simulator/router files themselves are
 *   not modified).
 *
 * Mounted once in App.tsx alongside ThemeProvider, which this mirrors.
 */
export function SettingsEffectsProvider({ children }: { children: React.ReactNode }) {
  const language = useSettingsStore((s) => s.language);
  const animations = useSettingsStore((s) => s.animations);
  const keepScreenOn = useSettingsStore((s) => s.keepScreenOn);

  const [onSimulatorRoute, setOnSimulatorRoute] = useState(() => SIMULATOR_PATH.test(window.location.pathname));

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    document.documentElement.dataset.animations = animations ? 'on' : 'off';
  }, [animations]);

  // Track route changes via the router's own subscription (read-only — does
  // not touch router.tsx) so wake-lock only engages during a live sim run.
  useEffect(() => {
    const unsubscribe = router.subscribe((state) => {
      setOnSimulatorRoute(SIMULATOR_PATH.test(state.location.pathname));
    });
    return unsubscribe;
  }, []);

  const wantsLockRef = useRef(false);
  useEffect(() => {
    const shouldLock = keepScreenOn && onSimulatorRoute;
    wantsLockRef.current = shouldLock;

    if (shouldLock) {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }

    // Wake locks are auto-released by the browser when the tab is hidden;
    // re-acquire on return if the setting is still on and we're still on
    // the simulator route.
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && wantsLockRef.current) {
        requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [keepScreenOn, onSimulatorRoute]);

  useEffect(() => {
    return () => {
      releaseWakeLock();
    };
  }, []);

  return <>{children}</>;
}
