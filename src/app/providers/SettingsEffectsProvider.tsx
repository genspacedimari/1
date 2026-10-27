import { useEffect, useRef, useState } from 'react';
import { useSettingsStore } from '@/stores/settingsStore';
import { requestWakeLock, releaseWakeLock } from '@/utils/wakeLock';
import { unlockAudioContext, triggerInteractionFeedback } from '@/utils/sound';
import { router } from '../router';

const SIMULATOR_PATH = /^\/simulator\/editor\//;

/**
 * Applies the handful of Settings values that need a real, app-wide effect
 * rather than a component-local one:
 *
 * - `language`        -> sets <html lang="id|en"> (screen readers / browser UI cue)
 * - `animations`      -> toggles `<html data-animations="off">`, which
 *   src/styles/globals.css uses to force-disable CSS transitions/animations
 *   everywhere, and flips Framer Motion's global `reducedMotion` mode.
 * - `keepScreenOn`    -> requests a Screen Wake Lock only while the user is
 *   actually inside a running simulator session (route-based).
 * - `soundEffects` /
 *   `hapticFeedback`  -> global capture-phase pointer listener that fires
 *   `triggerInteractionFeedback` for every interactive element across ALL pages.
 *
 * Mounted once in App.tsx alongside ThemeProvider.
 */
export function SettingsEffectsProvider({ children }: { children: React.ReactNode }) {
  const language = useSettingsStore((s) => s.language);
  const animations = useSettingsStore((s) => s.animations);
  const keepScreenOn = useSettingsStore((s) => s.keepScreenOn);

  const [onSimulatorRoute, setOnSimulatorRoute] = useState(() => SIMULATOR_PATH.test(window.location.pathname));

  // ─── language ───────────────────────────────────────────────────────────────
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  // ─── animations ─────────────────────────────────────────────────────────────
  useEffect(() => {
    document.documentElement.dataset.animations = animations ? 'on' : 'off';
  }, [animations]);

  // ─── Wake Lock: track route ──────────────────────────────────────────────────
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

    const onVisibility = () => {
      if (document.visibilityState === 'visible' && wantsLockRef.current) {
        requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [keepScreenOn, onSimulatorRoute]);

  useEffect(() => {
    return () => { releaseWakeLock(); };
  }, []);

  // ─── Global Interaction Sound + Haptic Interceptor ──────────────────────────
  //
  // Listens on `pointerdown` during the CAPTURE phase so it fires before any
  // component's own handler (and before stopPropagation on bubbled events can
  // mute it). Checks if the event target is an interactive element, then calls
  // `triggerInteractionFeedback` which contains its own 35 ms debounce guard
  // to prevent double-firing alongside per-component handlers (Switch, etc.).
  //
  // AudioContext is also unlocked here on the very first gesture, satisfying
  // browser autoplay policies.
  useEffect(() => {
    const INTERACTIVE_SELECTOR = [
      'button',
      'a[href]',
      '[role="button"]',
      '[role="tab"]',
      '[role="radio"]',
      '[role="checkbox"]',
      '[role="switch"]',
      '[role="menuitem"]',
      '[role="option"]',
      'input[type="button"]',
      'input[type="submit"]',
      'input[type="checkbox"]',
      'input[type="radio"]',
      '[data-interactive]',
      '.cursor-pointer',
    ].join(', ');

    // Determine feedback type based on element role / context
    const getFeedbackType = (el: Element) => {
      const role = el.getAttribute('role') ?? '';
      if (role === 'tab') return 'tab' as const;
      if (role === 'switch') return 'toggle' as const;
      // NavLink / anchor that looks like navigation
      if (el.tagName === 'A') return 'nav' as const;
      return 'click' as const;
    };

    const handler = (e: PointerEvent) => {
      // Unlock AudioContext on very first pointer event
      unlockAudioContext();

      const target = e.target as Element | null;
      if (!target) return;

      // Walk up the DOM to find nearest interactive ancestor
      const interactive = target.closest(INTERACTIVE_SELECTOR);
      if (!interactive) return;

      // Check enabled flags at dispatch time (store read is O(1))
      const { soundEffects, hapticFeedback } = useSettingsStore.getState();
      if (!soundEffects && !hapticFeedback) return;

      triggerInteractionFeedback(getFeedbackType(interactive));
    };

    window.addEventListener('pointerdown', handler, { capture: true, passive: true });
    return () => window.removeEventListener('pointerdown', handler, { capture: true });
  }, []);

  return <>{children}</>;
}
