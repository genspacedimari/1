/**
 * Storage-agnostic contract for offline persistence. Two implementations
 * satisfy this interface: IndexedDbAdapter (web/dev) and, in the APK phase,
 * a Capacitor SQLite adapter (@capacitor-community/sqlite) — nothing above
 * this layer needs to know which one is active.
 */
export interface ILocalDb {
  init(): Promise<void>;
  get<T>(table: string, key: string): Promise<T | null>;
  set<T>(table: string, key: string, value: T): Promise<void>;
  remove(table: string, key: string): Promise<void>;
  list<T>(table: string): Promise<T[]>;
}

/** Tables mirrored 1:1 with the SQLite schema in database/sqlite. */
export const OFFLINE_TABLES = [
  'offline_projects',
  'offline_materials',
  'offline_settings',
  'simulation_cache',
] as const;

export type OfflineTable = (typeof OFFLINE_TABLES)[number];
