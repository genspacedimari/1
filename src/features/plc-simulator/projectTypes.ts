// ===========================
// Project Management Types
// ===========================
// All serializable project metadata + the export/import envelope. The
// ladderJson field inside OfflineProject stays an opaque string (the
// engine parses it, not this layer), but everything around it — name,
// description, PLC type, scan rate, timestamps, version — is typed here.

export type PlcType = 'generic' | 'omron' | 'mitsubishi'
export type ScanRate = 20 | 50 | 100

export const PLC_TYPE_LABELS: Record<PlcType, string> = {
  generic: 'Generic PLC',
  omron: 'Omron',
  mitsubishi: 'Mitsubishi',
}

export const SCAN_RATE_LABELS: Record<ScanRate, string> = {
  20: '20 ms',
  50: '50 ms',
  100: '100 ms',
}

/** Metadata shown on project cards and in the editor header. */
export interface ProjectMeta {
  id: string
  name: string
  description: string
  plcType: PlcType
  scanRate: ScanRate
  version: string
  createdAt: string
  updatedAt: string
}

/**
 * Full project = metadata + the ladder program itself. The ladder is
 * stored as a JSON string (the editor's own Rung[] shape) so the storage
 * layer never needs to know its internal structure.
 */
export interface PlcProject extends ProjectMeta {
  ladderJson: string
  addressMap: string
}

/** What we serialize to .gsp / .json for export and import. */
export const EXPORT_FORMAT_VERSION = '1.0'

export interface ProjectExportEnvelope {
  format: 'genspace'
  formatVersion: string
  exportedAt: string
  project: PlcProject
}

// ===========================
// Validation
// ===========================
export interface ProjectValidationError {
  field: string
  message: string
}

export function validateProjectFile(raw: unknown): { ok: true; project: PlcProject } | { ok: false; errors: ProjectValidationError[] } {
  const errors: ProjectValidationError[] = []
  if (!raw || typeof raw !== 'object') {
    return { ok: false, errors: [{ field: 'file', message: 'File is not a valid JSON object' }] }
  }
  const obj = raw as Record<string, unknown>
  // Accept either the full envelope or a bare project object.
  const project = (obj.format === 'genspace' && obj.project ? obj.project : obj) as Record<string, unknown>
  if (!project || typeof project !== 'object') {
    return { ok: false, errors: [{ field: 'project', message: 'Missing project object' }] }
  }
  const required: { key: keyof PlcProject; type: string }[] = [
    { key: 'id', type: 'string' },
    { key: 'name', type: 'string' },
    { key: 'ladderJson', type: 'string' },
  ]
  for (const { key, type } of required) {
    const v = project[key]
    if (v === undefined || v === null || v === '') {
      errors.push({ field: key, message: `Missing required field: ${key}` })
    } else if (typeof v !== type) {
      errors.push({ field: key, message: `${key} must be a ${type}` })
    }
  }
  if (errors.length > 0) return { ok: false, errors }
  return {
    ok: true,
    project: {
      id: String(project.id),
      name: String(project.name ?? ''),
      description: String(project.description ?? ''),
      plcType: (project.plcType as PlcType) ?? 'generic',
      scanRate: (project.scanRate as ScanRate) ?? 50,
      version: String(project.version ?? '1.0'),
      createdAt: String(project.createdAt ?? new Date().toISOString()),
      updatedAt: String(project.updatedAt ?? new Date().toISOString()),
      ladderJson: String(project.ladderJson ?? '[]'),
      addressMap: String(project.addressMap ?? '{}'),
    },
  }
}

// ===========================
// Address Map
// ===========================
/**
 * Walks the ladder JSON and builds a map of every address referenced by
 * every cell across all rungs. Stored alongside the project so external
 * tools (and the future import flow) can see what I/O a program uses
 * without re-parsing the ladder.
 */
export function buildAddressMap(ladderJson: string): string {
  try {
    const rungs = JSON.parse(ladderJson) as Array<{ rows: Array<Array<{ address?: string } | null>> }>
    const map: Record<string, string[]> = {}
    for (const rung of rungs) {
      if (!rung || !Array.isArray(rung.rows)) continue
      for (const row of rung.rows) {
        if (!Array.isArray(row)) continue
        for (const cell of row) {
          if (cell && typeof cell.address === 'string' && cell.address) {
            const prefix = cell.address.match(/^[A-Za-z]+/)?.[0] ?? 'X'
            if (!map[prefix]) map[prefix] = []
            if (!map[prefix].includes(cell.address)) map[prefix].push(cell.address)
          }
        }
      }
    }
    return JSON.stringify(map)
  } catch {
    return '{}'
  }
}

// ===========================
// Download / Export helpers
// ===========================
export function downloadFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9-_]/g, '_') || 'project'
}
