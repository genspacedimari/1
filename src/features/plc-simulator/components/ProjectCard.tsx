import { useNavigate } from 'react-router-dom'
import { MoveVertical as MoreVertical, FolderOpen, Pencil, Copy, Download, Trash2, Cpu } from 'lucide-react'
import { motion } from 'framer-motion'
import type { PlcProject } from '../projectTypes'
import { PLC_TYPE_LABELS, SCAN_RATE_LABELS } from '../projectTypes'
import { ActionMenu } from '@/components/ui/action-menu'

interface ProjectCardProps {
  project: PlcProject
  onRename: (project: PlcProject) => void
  onDuplicate: (project: PlcProject) => void
  onExport: (project: PlcProject) => void
  onDelete: (project: PlcProject) => void
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  } catch { return iso }
}

function timeAgo(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    if (days < 30) return `${days}d ago`
    return formatDate(iso)
  } catch { return iso }
}

export function ProjectCard({ project, onRename, onDuplicate, onExport, onDelete }: ProjectCardProps) {
  const navigate = useNavigate()

  const openProject = () => navigate(`/simulator/editor/${project.id}`)

  const menuItems = [
    { label: 'Open', icon: FolderOpen, onClick: openProject },
    { label: 'Rename', icon: Pencil, onClick: () => onRename(project) },
    { label: 'Duplicate', icon: Copy, onClick: () => onDuplicate(project) },
    { label: 'Export', icon: Download, onClick: () => onExport(project) },
    { label: 'Delete', icon: Trash2, danger: true, onClick: () => onDelete(project) },
  ]

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.18 }}
      className="group relative flex flex-col rounded-2xl border border-border dark:border-border-dark bg-white dark:bg-white/5 p-4 transition-colors hover:border-primary/40 hover:shadow-glass"
    >
      {/* Thumbnail */}
      <div
        className="mb-3 flex h-28 items-center justify-center rounded-xl bg-secondary dark:bg-white/5 overflow-hidden"
        onClick={openProject}
        role="button"
        tabIndex={0}
      >
        <LadderThumbnail ladderJson={project.ladderJson} />
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col" onClick={openProject} role="button" tabIndex={0}>
        <h3 className="font-display text-sm font-semibold text-dark dark:text-secondary truncate">{project.name}</h3>
        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2 min-h-[2rem]">
          {project.description || 'No description'}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
            <Cpu size={10} />
            {PLC_TYPE_LABELS[project.plcType] ?? project.plcType}
          </span>
          <span className="rounded-md bg-muted dark:bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            {SCAN_RATE_LABELS[project.scanRate] ?? `${project.scanRate} ms`}
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
          <span>Modified {timeAgo(project.updatedAt)}</span>
          <span>{formatDate(project.createdAt)}</span>
        </div>
      </div>

      {/* Menu trigger */}
      <div className="absolute right-2 top-2">
        <ActionMenu
          menuWidth={160}
          trigger={({ onClick, open }) => (
            <button
              onClick={(e) => { e.stopPropagation(); onClick() }}
              className={`flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-opacity hover:bg-muted dark:hover:bg-white/10 ${open ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
              aria-label="Project menu"
            >
              <MoreVertical size={16} />
            </button>
          )}
          items={menuItems.map((item) => ({ ...item, onClick: () => item.onClick() }))}
        />
      </div>
    </motion.div>
  )
}

// Renders a tiny visual preview of the ladder — a few horizontal "rungs"
// derived from the actual rung count, so each card looks distinct.
function LadderThumbnail({ ladderJson }: { ladderJson: string }) {
  let rungCount = 0
  try {
    const rungs = JSON.parse(ladderJson) as unknown[]
    rungCount = Array.isArray(rungs) ? rungs.length : 0
  } catch { rungCount = 0 }

  const lines = Math.min(Math.max(rungCount, 1), 5)
  return (
    <svg width="120" height="80" viewBox="0 0 120 80" className="opacity-50">
      {/* Left rail */}
      <line x1="10" y1="8" x2="10" y2="72" stroke="#F26B3A" strokeWidth="2" />
      {/* Right rail */}
      <line x1="110" y1="8" x2="110" y2="72" stroke="#F26B3A" strokeWidth="2" />
      {/* Rungs */}
      {Array.from({ length: lines }).map((_, i) => {
        const y = 8 + (i * 64) / Math.max(lines - 1, 1)
        return <line key={i} x1="10" y1={y} x2="110" y2={y} stroke="currentColor" strokeWidth="1.5" className="text-dark dark:text-secondary" />
      })}
    </svg>
  )
}
