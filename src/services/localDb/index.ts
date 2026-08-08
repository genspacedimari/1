import { ILocalDb } from './types';
import { IndexedDbAdapter } from './indexedDbAdapter';

/** True once running inside the Capacitor-wrapped Android/iOS app. */
export function isNativePlatform(): boolean {
  return !!(window as any).Capacitor?.isNativePlatform?.();
}

let instance: ILocalDb | null = null;

/**
 * Returns the active local storage adapter for the current platform.
 *
 * Today this always returns IndexedDbAdapter. Once
 * @capacitor-community/sqlite is added (APK phase, Week 11 in the roadmap),
 * this factory is the only place that needs to branch on isNativePlatform().
 */
export function getLocalDb(): ILocalDb {
  if (!instance) {
    instance = new IndexedDbAdapter();
  }
  return instance;
}
