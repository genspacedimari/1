import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Upload, Search, ArrowDownUp, Cpu, X, TriangleAlert as AlertTriangle, FileCheck, Loader as Loader2 } from 'lucide-react'
import { useProjectStore, type SortMode } from '../projectStore'
import type { PlcProject, PlcType, ScanRate, ProjectExportEnvelope } from '../projectTypes'
import {
  PLC_TYPE_LABELS, SCAN_RATE_LABELS, EXPORT_FORMAT_VERSION,
  validateProjectFile, downloadFile, sanitizeFilename,
} from '../projectTypes'
import { ProjectCard } from './ProjectCard'

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: 'lastModified', label: 'Last Modified' },
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'alphabetical', label: 'Alphabetical' },
]

export default function ProjectManager() {
  const navigate = useNavigate()
  const { projects, loading, search, sortMode, loadProjects, setSearch, setSortMode,
    createProject, renameProject, duplicateProject, deleteProject, importProject } = useProjectStore()

  const [showCreate, setShowCreate] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [sortMenuOpen, setSortMenuOpen] = useState(false)
  const [renameTarget, setRenameTarget] = useState<PlcProject | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<PlcProject | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const sortRef = useRef<HTMLDivElement>(null)

  useEffect(() => { loadProjects() }, [loadProjects])

  useEffect(() => {
    if (!sortMenuOpen) return
    const handler = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setSortMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [sortMenuOpen])

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(t => t === msg ? null : t), 2400)
  }, [])

  const filtered = useProjectStore(s => s.getFilteredProjects())

  // ===== Create =====
  const handleCreate = async (data: { name: string; description: string; plcType: PlcType; scanRate: ScanRate }) => {
    const project = await createProject(data)
    setShowCreate(false)
    showToast(`Project "${project.name}" created`)
    navigate(`/simulator/editor/${project.id}`)
  }

  // ===== Duplicate =====
  const handleDuplicate = async (project: PlcProject) => {
    const copy = await duplicateProject(project.id)
    if (copy) showToast(`Duplicated as "${copy.name}"`)
  }

  // ===== Export =====
  const handleExport = (project: PlcProject, format: 'gsp' | 'json') => {
    const envelope: ProjectExportEnvelope = {
      format: 'genspace',
      formatVersion: EXPORT_FORMAT_VERSION,
      exportedAt: new Date().toISOString(),
      project,
    }
    const content = JSON.stringify(envelope, null, 2)
    const filename = `${sanitizeFilename(project.name)}.${format}`
    downloadFile(filename, content, 'application/json')
    showToast(`Exported ${filename}`)
  }

  const handleExportJson = (project: PlcProject) => handleExport(project, 'json')

  // ===== Delete =====
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    await deleteProject(deleteTarget.id)
    showToast(`Deleted "${deleteTarget.name}"`)
    setDeleteTarget(null)
  }

  // ===== Rename =====
  const handleConfirmRename = async (newName: string) => {
    if (!renameTarget || !newName.trim()) { setRenameTarget(null); return }
    await renameProject(renameTarget.id, newName.trim())
    showToast('Project renamed')
    setRenameTarget(null)
  }

  // ===== Import =====
  const handleImportFile = async (file: File) => {
    try {
      const text = await file.text()
      const raw = JSON.parse(text)
      const result = validateProjectFile(raw)
      if (!result.ok) {
        showToast(`Invalid file: ${result.errors[0]?.message ?? 'unknown error'}`)
        return
      }
      const imported = await importProject(result.project)
      setShowImport(false)
      showToast(`Imported "${imported.name}"`)
    } catch {
      showToast('Failed to read file — not valid JSON')
    }
  }

  const hasProjects = projects.length > 0

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-2xl font-semibold">PLC Projects</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">Create, open, and manage your ladder logic projects</p>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus size={16} />
            New Project
          </button>
          <button
            onClick={() => setShowImport(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border dark:border-border-dark bg-white dark:bg-white/5 px-3.5 py-2 text-sm font-medium text-dark dark:text-secondary transition-colors hover:bg-muted dark:hover:bg-white/10"
          >
            <Upload size={16} />
            Import
          </button>

          <div className="relative flex-1 min-w-[160px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search projects..."
              className="w-full rounded-xl border border-border dark:border-border-dark bg-white dark:bg-white/5 py-2 pl-9 pr-3 text-sm text-dark dark:text-secondary outline-none placeholder:text-muted-foreground focus:border-primary/50"
            />
          </div>

          <div ref={sortRef} className="relative">
            <button
              onClick={() => setSortMenuOpen(o => !o)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border dark:border-border-dark bg-white dark:bg-white/5 px-3 py-2 text-sm font-medium text-dark dark:text-secondary transition-colors hover:bg-muted dark:hover:bg-white/10"
            >
              <ArrowDownUp size={14} />
              <span className="hidden sm:inline">{SORT_OPTIONS.find(o => o.value === sortMode)?.label}</span>
            </button>
            <AnimatePresence>
              {sortMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.12 }}
                  className="absolute right-0 top-10 z-30 w-40 overflow-hidden rounded-xl border border-border dark:border-border-dark bg-white dark:bg-surface-dark shadow-glass"
                >
                  {SORT_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => { setSortMode(opt.value); setSortMenuOpen(false) }}
                      className={`flex w-full items-center px-3 py-2 text-xs font-medium transition-colors ${
                        sortMode === opt.value
                          ? 'text-primary bg-primary/10'
                          : 'text-dark dark:text-secondary hover:bg-muted dark:hover:bg-white/5'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20">
          <Loader2 size={28} className="animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading projects...</p>
        </div>
      ) : !hasProjects ? (
        <EmptyState onCreate={() => setShowCreate(true)} />
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
          <Search size={32} className="text-muted-foreground/50" />
          <p className="text-sm font-medium">No projects match "{search}"</p>
          <button onClick={() => setSearch('')} className="text-xs text-primary hover:underline">Clear search</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {filtered.map(project => (
              <ProjectCard
                key={project.id}
                project={project}
                onRename={setRenameTarget}
                onDuplicate={handleDuplicate}
                onExport={handleExportJson}
                onDelete={setDeleteTarget}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* ===== Dialogs ===== */}
      <AnimatePresence>
        {showCreate && (
          <CreateProjectDialog
            onCancel={() => setShowCreate(false)}
            onCreate={handleCreate}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showImport && (
          <ImportDialog
            onCancel={() => setShowImport(false)}
            onImport={handleImportFile}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {renameTarget && (
          <RenameDialog
            initialName={renameTarget.name}
            onCancel={() => setRenameTarget(null)}
            onConfirm={handleConfirmRename}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteTarget && (
          <ConfirmDeleteDialog
            projectName={deleteTarget.name}
            onCancel={() => setDeleteTarget(null)}
            onConfirm={handleConfirmDelete}
          />
        )}
      </AnimatePresence>

      {/* Export submenu for .gsp */}
      <AnimatePresence>
        {deleteTarget === null && showCreate === false && showImport === false && renameTarget === null && null}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-dark dark:bg-white px-4 py-2.5 text-sm font-medium text-secondary dark:text-dark shadow-glass"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ===========================
// Empty State
// ===========================
function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center gap-4 py-20 text-center"
    >
      <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10">
        <Cpu size={36} className="text-primary" />
      </div>
      <div>
        <h3 className="font-display text-lg font-semibold">No PLC Projects Yet</h3>
        <p className="mt-1 text-sm text-muted-foreground">Create your first ladder logic project to get started</p>
      </div>
      <button
        onClick={onCreate}
        className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
      >
        <Plus size={16} />
        Create Project
      </button>
    </motion.div>
  )
}

// ===========================
// Dialog wrapper
// ===========================
function DialogShell({ title, subtitle, children, onCancel }: { title: string; subtitle?: string; children: React.ReactNode; onCancel: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onCancel}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.16 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-border dark:border-border-dark bg-white dark:bg-surface-dark p-5 shadow-glass"
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="font-display text-lg font-semibold">{title}</h3>
            {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <button onClick={onCancel} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted dark:hover:bg-white/10">
            <X size={18} />
          </button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  )
}

// ===========================
// Create Project Dialog
// ===========================
function CreateProjectDialog({ onCancel, onCreate }: { onCancel: () => void; onCreate: (data: { name: string; description: string; plcType: PlcType; scanRate: ScanRate }) => void }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [plcType, setPlcType] = useState<PlcType>('generic')
  const [scanRate, setScanRate] = useState<ScanRate>(50)
  const [error, setError] = useState('')

  const handleCreate = () => {
    if (!name.trim()) { setError('Project name is required'); return }
    onCreate({ name: name.trim(), description: description.trim(), plcType, scanRate })
  }

  return (
    <DialogShell title="New Project" subtitle="Create a new ladder logic project" onCancel={onCancel}>
      <div className="flex flex-col gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Project Name</label>
          <input
            autoFocus
            value={name}
            onChange={e => { setName(e.target.value); setError('') }}
            onKeyDown={e => { if (e.key === 'Enter') handleCreate() }}
            placeholder="Traffic Light Controller"
            className="w-full rounded-xl border border-border dark:border-border-dark bg-white dark:bg-white/5 px-3 py-2.5 text-sm text-dark dark:text-secondary outline-none focus:border-primary/50"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Description</label>
          <input
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="A brief description (optional)"
            className="w-full rounded-xl border border-border dark:border-border-dark bg-white dark:bg-white/5 px-3 py-2.5 text-sm text-dark dark:text-secondary outline-none focus:border-primary/50"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">PLC Type</label>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(PLC_TYPE_LABELS) as PlcType[]).map(type => (
              <button
                key={type}
                onClick={() => setPlcType(type)}
                className={`rounded-lg border px-2 py-2 text-xs font-medium transition-colors ${
                  plcType === type
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border dark:border-border-dark text-muted-foreground hover:bg-muted dark:hover:bg-white/5'
                }`}
              >
                {PLC_TYPE_LABELS[type]}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Scan Rate</label>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(SCAN_RATE_LABELS) as unknown as ScanRate[]).map(rate => (
              <button
                key={rate}
                onClick={() => setScanRate(Number(rate) as ScanRate)}
                className={`rounded-lg border px-2 py-2 text-xs font-medium transition-colors ${
                  scanRate === Number(rate)
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border dark:border-border-dark text-muted-foreground hover:bg-muted dark:hover:bg-white/5'
                }`}
              >
                {SCAN_RATE_LABELS[Number(rate) as ScanRate]}
              </button>
            ))}
          </div>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="mt-2 flex gap-2">
          <button onClick={onCancel} className="flex-1 rounded-xl border border-border dark:border-border-dark py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted dark:hover:bg-white/5">
            Cancel
          </button>
          <button onClick={handleCreate} className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
            Create
          </button>
        </div>
      </div>
    </DialogShell>
  )
}

// ===========================
// Import Dialog
// ===========================
function ImportDialog({ onCancel, onImport }: { onCancel: () => void; onImport: (file: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [preview, setPreview] = useState<{ name: string; plcType: string; rungCount: number } | null>(null)
  const [file, setFile] = useState<File | null>(null)

  const handleFile = (f: File) => {
    setFile(f)
    f.text().then(text => {
      try {
        const raw = JSON.parse(text)
        const result = validateProjectFile(raw)
        if (result.ok) {
          let rungCount = 0
          try { rungCount = JSON.parse(result.project.ladderJson).length } catch { rungCount = 0 }
          setPreview({ name: result.project.name, plcType: result.project.plcType, rungCount })
        } else {
          setPreview(null)
        }
      } catch { setPreview(null) }
    })
  }

  return (
    <DialogShell title="Import Project" subtitle="Import a .gsp or .json project file" onCancel={onCancel}>
      <div className="flex flex-col gap-3">
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]) }}
          onClick={() => inputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-8 transition-colors ${
            dragOver ? 'border-primary bg-primary/5' : 'border-border dark:border-border-dark hover:border-primary/40'
          }`}
        >
          <Upload size={28} className="text-muted-foreground" />
          <p className="text-sm font-medium">Drop file here or click to browse</p>
          <p className="text-xs text-muted-foreground">Supports .gsp and .json</p>
          <input
            ref={inputRef}
            type="file"
            accept=".gsp,.json,application/json"
            className="hidden"
            onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }}
          />
        </div>

        {file && preview && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-3 rounded-xl border border-border dark:border-border-dark bg-secondary dark:bg-white/5 p-3">
            <FileCheck size={20} className="text-primary" />
            <div className="flex-1">
              <p className="text-sm font-semibold">{preview.name}</p>
              <p className="text-xs text-muted-foreground">{PLC_TYPE_LABELS[preview.plcType as PlcType] ?? preview.plcType} · {preview.rungCount} rung(s)</p>
            </div>
          </motion.div>
        )}
        {file && !preview && (
          <div className="flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-50 dark:bg-red-500/10 p-3">
            <AlertTriangle size={20} className="text-red-600" />
            <p className="text-xs text-red-600">Invalid project file — validation failed</p>
          </div>
        )}

        <div className="mt-1 flex gap-2">
          <button onClick={onCancel} className="flex-1 rounded-xl border border-border dark:border-border-dark py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted dark:hover:bg-white/5">
            Cancel
          </button>
          <button
            onClick={() => { if (file) onImport(file) }}
            disabled={!file || !preview}
            className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Import
          </button>
        </div>
      </div>
    </DialogShell>
  )
}

// ===========================
// Rename Dialog
// ===========================
function RenameDialog({ initialName, onCancel, onConfirm }: { initialName: string; onCancel: () => void; onConfirm: (newName: string) => void }) {
  const [name, setName] = useState(initialName)
  return (
    <DialogShell title="Rename Project" onCancel={onCancel}>
      <div className="flex flex-col gap-3">
        <input
          autoFocus
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') onConfirm(name) }}
          className="w-full rounded-xl border border-border dark:border-border-dark bg-white dark:bg-white/5 px-3 py-2.5 text-sm text-dark dark:text-secondary outline-none focus:border-primary/50"
        />
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 rounded-xl border border-border dark:border-border-dark py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted dark:hover:bg-white/5">
            Cancel
          </button>
          <button onClick={() => onConfirm(name)} className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
            Rename
          </button>
        </div>
      </div>
    </DialogShell>
  )
}

// ===========================
// Confirm Delete Dialog
// ===========================
function ConfirmDeleteDialog({ projectName, onCancel, onConfirm }: { projectName: string; onCancel: () => void; onConfirm: () => void }) {
  return (
    <DialogShell title="Delete Project" onCancel={onCancel}>
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3 rounded-xl bg-red-50 dark:bg-red-500/10 p-3">
          <AlertTriangle size={20} className="mt-0.5 shrink-0 text-red-600" />
          <p className="text-sm text-dark dark:text-secondary">
            Are you sure you want to delete <span className="font-semibold">"{projectName}"</span>? This action cannot be undone.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 rounded-xl border border-border dark:border-border-dark py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted dark:hover:bg-white/5">
            Cancel
          </button>
          <button onClick={onConfirm} className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700">
            Delete
          </button>
        </div>
      </div>
    </DialogShell>
  )
}
