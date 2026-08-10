/**
 * Haptic feedback helper. Prefers the Capacitor Haptics plugin when the app
 * is running wrapped as a native Android build; falls back to the standard
 * Web Vibration API (`navigator.vibrate`), which Chrome on Android supports
 * for regular web/PWA sessions. iOS Safari and desktop browsers don't
 * expose vibration at all — `isHapticsSupported()` reflects that honestly
 * instead of pretending it worked.
 */

interface CapacitorHapticsPlugin {
  impact?: (opts: { style: 'LIGHT' | 'MEDIUM' | 'HEAVY' }) => Promise<void>;
  vibrate?: (opts?: { duration?: number }) => Promise<void>;
}

function getCapacitorHaptics(): CapacitorHapticsPlugin | null {
  const win = window as unknown as { Capacitor?: { Plugins?: { Haptics?: CapacitorHapticsPlugin } } };
  return win.Capacitor?.Plugins?.Haptics ?? null;
}

export function isHapticsSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return !!getCapacitorHaptics() || 'vibrate' in navigator;
}

export function triggerHaptic(durationMs: number | number[] = 12) {
  try {
    const haptics = getCapacitorHaptics();
    if (haptics?.impact) {
      haptics.impact({ style: 'LIGHT' }).catch(() => {});
      return;
    }
    if (haptics?.vibrate) {
      haptics.vibrate({ duration: Array.isArray(durationMs) ? durationMs[0] : durationMs }).catch(() => {});
      return;
    }
    if ('vibrate' in navigator) {
      navigator.vibrate(durationMs);
    }
  } catch {
    /* no-op — device/browser doesn't support it */
  }
}

/** Only vibrates if `enabled` is true — call sites pass `settingsStore.hapticFeedback`. */
export function triggerHapticIfEnabled(enabled: boolean, durationMs: number | number[] = 12) {
  if (enabled) triggerHaptic(durationMs);
}
