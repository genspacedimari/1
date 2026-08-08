import { create } from 'zustand';
import { sqliteService, type OfflineProject } from '@/services/localDb/sqliteService';
import type { PlcProject, PlcType, ScanRate } from './projectTypes';
import { buildAddressMap } from './projectTypes';

export type SortMode = 'newest' | 'oldest' | 'alphabetical' | 'lastModified'

// ===========================
// Conversions between the storage-layer shape (OfflineProject) and the
// domain shape (PlcProject). Keeping this in one place means the store
// never leaks storage concerns to the UI.
// ===========================
function toDomain(row: OfflineProject): PlcProject {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    plcType: (row.plcType as PlcType) || 'generic',
    scanRate: (row.scanRate as ScanRate) || 50,
    version: row.version || '1.0',
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    ladderJson: row.ladderJson,
    addressMap: row.addressMap,
  }
}

function toStorage(project: PlcProject): OfflineProject {
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    plcType: project.plcType,
    scanRate: project.scanRate,
    version: project.version,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    ladderJson: project.ladderJson,
    addressMap: project.addressMap,
    synced: false,
  }
}

export function generateProjectId(): string {
  return `proj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export interface NewProjectInput {
  name: string
  description: string
  plcType: PlcType
  scanRate: ScanRate
}

interface ProjectStoreState {
  projects: PlcProject[]
  loading: boolean
  search: string
  sortMode: SortMode
  error: string | null

  loadProjects: () => Promise<void>
  setSearch: (q: string) => void
  setSortMode: (m: SortMode) => void

  createProject: (input: NewProjectInput) => Promise<PlcProject>
  renameProject: (id: string, newName: string) => Promise<void>
  duplicateProject: (id: string) => Promise<PlcProject | null>
  deleteProject: (id: string) => Promise<void>
  importProject: (project: PlcProject) => Promise<PlcProject>

  getProject: (id: string) => Promise<PlcProject | null>
  saveLadder: (id: string, ladderJson: string) => Promise<void>

  getFilteredProjects: () => PlcProject[]
}

export const useProjectStore = create<ProjectStoreState>()((set, get) => ({
  projects: [],
  loading: false,
  search: '',
  sortMode: 'lastModified',
  error: null,

  async loadProjects() {
    set({ loading: true, error: null })
    try {
      await sqliteService.init()
      const rows = await sqliteService.listProjects()
      set({ projects: rows.map(toDomain), loading: false })
    } catch (e) {
      set({ loading: false, error: 'Failed to load projects' })
    }
  },

  setSearch(q) { set({ search: q }) },
  setSortMode(m) { set({ sortMode: m }) },

  async createProject(input) {
    const now = new Date().toISOString()
    const project: PlcProject = {
      id: generateProjectId(),
      name: input.name,
      description: input.description,
      plcType: input.plcType,
      scanRate: input.scanRate,
      version: '1.0',
      createdAt: now,
      updatedAt: now,
      ladderJson: JSON.stringify([]),
      addressMap: '{}',
    }
    await sqliteService.saveProject(toStorage(project))
    set(state => ({ projects: [...state.projects, project] }))
    return project
  },

  async renameProject(id, newName) {
    const existing = get().projects.find(p => p.id === id)
    if (!existing) return
    const updated = { ...existing, name: newName, updatedAt: new Date().toISOString() }
    await sqliteService.saveProject(toStorage(updated))
    set(state => ({ projects: state.projects.map(p => p.id === id ? updated : p) }))
  },

  async duplicateProject(id) {
    const existing = get().projects.find(p => p.id === id)
    if (!existing) return null
    const now = new Date().toISOString()
    const copy: PlcProject = {
      ...existing,
      id: generateProjectId(),
      name: `${existing.name} (Copy)`,
      createdAt: now,
      updatedAt: now,
    }
    await sqliteService.saveProject(toStorage(copy))
    set(state => ({ projects: [...state.projects, copy] }))
    return copy
  },

  async deleteProject(id) {
    await sqliteService.deleteProject(id)
    set(state => ({ projects: state.projects.filter(p => p.id !== id) }))
  },

  async importProject(project) {
    // Re-ID so an import never collides with an existing project.
    const now = new Date().toISOString()
    const imported: PlcProject = {
      ...project,
      id: generateProjectId(),
      createdAt: now,
      updatedAt: now,
    }
    await sqliteService.saveProject(toStorage(imported))
    set(state => ({ projects: [...state.projects, imported] }))
    return imported
  },

  async getProject(id) {
    const cached = get().projects.find(p => p.id === id)
    if (cached) return cached
    const row = await sqliteService.getProject(id)
    return row ? toDomain(row) : null
  },

  async saveLadder(id, ladderJson) {
    const existing = get().projects.find(p => p.id === id)
    if (!existing) return
    const updated: PlcProject = {
      ...existing,
      ladderJson,
      addressMap: buildAddressMap(ladderJson),
      updatedAt: new Date().toISOString(),
    }
    await sqliteService.saveProject(toStorage(updated))
    set(state => ({ projects: state.projects.map(p => p.id === id ? updated : p) }))
  },

  getFilteredProjects() {
    const { projects, search, sortMode } = get()
    let list = [...projects]
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.plcType.toLowerCase().includes(q)
      )
    }
    switch (sortMode) {
      case 'newest': list.sort((a, b) => b.createdAt.localeCompare(a.createdAt)); break
      case 'oldest': list.sort((a, b) => a.createdAt.localeCompare(b.createdAt)); break
      case 'alphabetical': list.sort((a, b) => a.name.localeCompare(b.name)); break
      case 'lastModified': list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); break
    }
    return list
  },
}))
