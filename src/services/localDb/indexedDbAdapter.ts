import { ILocalDb, OFFLINE_TABLES } from './types';

const DB_NAME = 'genspace_offline';
// Bump this whenever OFFLINE_TABLES changes. IndexedDB only recreates
// object stores inside onupgradeneeded, which only fires when the
// requested version is higher than what's already stored in the
// browser — so forgetting to bump this after adding a table means
// existing users silently keep a DB missing that store, and any
// transaction against it throws "object store not found" with no
// user-visible error (this is what caused "Create Project" to do
// nothing: saveProject() was rejecting silently).
const DB_VERSION = 2;

/**
 * Web/dev implementation of ILocalDb, backed by the browser's IndexedDB.
 * Dependency-free on purpose (no sql.js/wasm) to keep Phase 1 install light;
 * it exists purely so features can be built and tested against a real
 * offline store today, before the Capacitor/SQLite build exists.
 *
 * Swapping this for real SQLite later (Week 11 in the roadmap) means writing
 * one new class that implements ILocalDb — no changes anywhere else.
 */
export class IndexedDbAdapter implements ILocalDb {
  private dbPromise: Promise<IDBDatabase> | null = null;

  init(): Promise<void> {
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = () => {
          const db = request.result;
          for (const table of OFFLINE_TABLES) {
            if (!db.objectStoreNames.contains(table)) {
              db.createObjectStore(table);
            }
          }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }
    return this.dbPromise.then(() => undefined);
  }

  private async withStore<T>(
    table: string,
    mode: IDBTransactionMode,
    fn: (store: IDBObjectStore) => IDBRequest<T>
  ): Promise<T> {
    const db = await this.dbPromise!;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(table, mode);
      const store = tx.objectStore(table);
      const req = fn(store);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async get<T>(table: string, key: string): Promise<T | null> {
    await this.init();
    const result = await this.withStore<T>(table, 'readonly', (store) => store.get(key));
    return result ?? null;
  }

  async set<T>(table: string, key: string, value: T): Promise<void> {
    await this.init();
    await this.withStore(table, 'readwrite', (store) => store.put(value, key));
  }

  async remove(table: string, key: string): Promise<void> {
    await this.init();
    await this.withStore(table, 'readwrite', (store) => store.delete(key));
  }

  async list<T>(table: string): Promise<T[]> {
    await this.init();
    const result = await this.withStore<T[]>(table, 'readonly', (store) => store.getAll() as IDBRequest<T[]>);
    return result ?? [];
  }
}
