import { getLocalDb } from './index';


export interface OfflineProject {
  id: string;
  name: string;
  description: string;
  plcType: string;        // 'generic' | 'omron' | 'mitsubishi'
  scanRate: number;       // 20 | 50 | 100 (ms)
  version: string;
  createdAt: string;
  updatedAt: string;
  ladderJson: string;     // serialized Rung[] from the editor — parsed by the editor, not here
  addressMap: string;     // JSON string of { prefix: [addresses...] }
  synced: boolean;
}

export interface OfflineMaterial {
  id: string;
  title: string;
  content: string;
  category: string;
}

export interface SimulationCacheEntry {
  projectId: string;
  scanState: string;
  updatedAt: string;
}

/**
 * SQLite Service — the typed facade every feature imports, instead of
 * reaching into getLocalDb()/ILocalDb directly. Mirrors the offline schema
 * documented in database/sqlite/*.sql table-for-table, so the mapping
 * between "the schema we designed" and "the code that reads/writes it"
 * stays obvious.
 */
export const sqliteService = {
  async init(): Promise<void> {
    await getLocalDb().init();
  },

  // --- offline_projects -----------------------------------------------
  async saveProject(project: OfflineProject): Promise<void> {
    await getLocalDb().set('offline_projects', project.id, project);
  },
  async getProject(id: string): Promise<OfflineProject | null> {
    return getLocalDb().get<OfflineProject>('offline_projects', id);
  },
  async listProjects(): Promise<OfflineProject[]> {
    return getLocalDb().list<OfflineProject>('offline_projects');
  },
  async deleteProject(id: string): Promise<void> {
    await getLocalDb().remove('offline_projects', id);
  },

  // --- offline_materials ------------------------------------------------
  async cacheMaterial(material: OfflineMaterial): Promise<void> {
    await getLocalDb().set('offline_materials', material.id, material);
  },
  async listMaterials(): Promise<OfflineMaterial[]> {
    return getLocalDb().list<OfflineMaterial>('offline_materials');
  },

  // --- offline_settings ---------------------------------------------------
  async getSetting<T>(key: string): Promise<T | null> {
    return getLocalDb().get<T>('offline_settings', key);
  },
  async setSetting<T>(key: string, value: T): Promise<void> {
    await getLocalDb().set('offline_settings', key, value);
  },

  // --- simulation_cache -----------------------------------------------------
  async saveSimulationState(entry: SimulationCacheEntry): Promise<void> {
    await getLocalDb().set('simulation_cache', entry.projectId, entry);
  },
  async getSimulationState(projectId: string): Promise<SimulationCacheEntry | null> {
    return getLocalDb().get<SimulationCacheEntry>('simulation_cache', projectId);
  },
};
