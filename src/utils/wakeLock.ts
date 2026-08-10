/**
 * Thin wrapper around the Screen Wake Lock API, used by the "Keep Screen
 * On" setting to actually prevent the display from sleeping while the
 * simulator is running. Supported on Chrome/Edge (Android + desktop) and
 * Safari 16.4+; on unsupported browsers `isWakeLockSupported()` returns
 * false so the Settings UI can say so honestly instead of pretending.
 */

type WakeLockSentinelLike = { released: boolean; release: () => Promise<void>; addEventListener: (type: 'release', cb: () => void) => void };

let sentinel: WakeLockSentinelLike | null = null;

export function isWakeLockSupported(): boolean {
  return typeof navigator !== 'undefined' && 'wakeLock' in navigator;
}

export async function requestWakeLock(): Promise<boolean> {
  if (!isWakeLockSupported()) return false;
  try {
    if (sentinel && !sentinel.released) return true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sentinel = await (navigator as any).wakeLock.request('screen');
    sentinel?.addEventListener('release', () => {
      sentinel = null;
    });
    return true;
  } catch {
    sentinel = null;
    return false;
  }
}

export async function releaseWakeLock(): Promise<void> {
  try {
    if (sentinel && !sentinel.released) {
      await sentinel.release();
    }
  } catch {
    /* no-op */
  } finally {
    sentinel = null;
  }
}

export function isWakeLockActive(): boolean {
  return !!sentinel && !sentinel.released;
}
