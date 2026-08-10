import { useState, useRef, useEffect, useCallback } from 'react'
import type { PlcProject } from '../projectTypes'
import { downloadFile, sanitizeFilename, EXPORT_FORMAT_VERSION } from '../projectTypes'
import type { ProjectExportEnvelope } from '../projectTypes'

interface SimulatorEditorScreenProps {
  projectName: string
  theme: string
  project?: PlcProject
  onBack: () => void
  onSaveLadder?: (ladderJson: string) => void
}

// ===========================
// GRID MODEL — flexible wire & junction graph (no rigid "BranchGroup" object)
// A rung is a stack of FULL-WIDTH rows (rows[0] is the main rail-to-rail row,
// rows[1..] are parallel lanes) plus a set of vertical junctions (`links`)
// that tie any two rows together at a given column. There is no startCol/
// endCol span, no per-branch lane array, no "branch" instruction — a branch
// is purely the visual/electrical result of a row existing and being linked
// to another row by a vertical wire, exactly like real ladder wiring:
//   • Horizontal Wire → a cell in a row (WIRE / NO / NC / COIL / ... / null)
//   • Vertical Wire / Junction → a VLink between two rows at one column
// This lets the user branch off ANY row (not just the main rail), nest
// branches inside branches to unlimited depth, place horizontal wire
// anywhere across the FULL row width (no span restriction), and connect or
// overlap multiple junctions freely — CX-Programmer / GX Works / Codesys
// style wiring.
// ===========================

const DEFAULT_COLS = 7   // fits comfortably on a phone screen, per rung
const MIN_COLS = 4
const MAX_COLS = 24
const CELL_W = 64
const CELL_H = 52

type CellType = 'WIRE' | 'NO' | 'NC' | 'COIL' | 'SET' | 'RST' | 'TON' | 'TOF' | 'TP' | 'CTU' | 'CTD' | 'RES' | 'MEM'
type ToolId = CellType | 'SELECT' | 'DELETE' | 'BRANCH'

interface GridCell {
  type: CellType
  address: string
  preset?: number
  timeUnit?: string
}
type CellSlot = GridCell | null

// A vertical wire / junction connecting two rows at one column boundary
// (col ranges 0..cols, where `cols` is the rung's own width — a link at
// col===cols sits right at the rung's own right edge). rowA/rowB need not
// be adjacent in the rows array — a junction can tie a brand-new lane
// straight back to the main rail, or to another lane several levels deep,
// which is exactly how nested branches and overlapping branches compose.
interface VLink { rowA: number; rowB: number; col: number }

interface Rung {
  id: number
  cols: number        // this rung's own column count (DEFAULT_COLS to start, adjustable via +/- Column)
  rows: CellSlot[][]   // rows[0] = main rail row; rows[1..] = lanes. Every row has length === cols.
  links: VLink[]       // the wiring graph — this IS the branch system, nothing more
  comment: string
}

interface Dialog {
  type: 'component' | 'address' | 'timer' | 'counter' | null
  rungId: number
  row: number
  col: number
  pendingType?: CellType
  pendingAddress?: string
  editing?: boolean
  initialAddress?: string
  initialPreset?: number
  initialUnit?: string
}

interface TimerState { acc: number; done: boolean }
interface CounterState { cv: number; done: boolean }

const unitMs = (u?: string) => (u === 's' ? 1000 : u === 'min' ? 60000 : 1)
const TICK_MS = 200

const emptyRow = (cols: number = DEFAULT_COLS): CellSlot[] => Array(cols).fill(null)
const makeRung = (id: number): Rung => ({ id, cols: DEFAULT_COLS, rows: [emptyRow()], links: [], comment: '' })


const TOOLBAR_ITEMS: { id: ToolId; tooltip: string; color: string }[] = [
  { id: 'SELECT', tooltip: 'Select / Edit', color: '#0F172A' },
  { id: 'WIRE', tooltip: 'Wire (connects cells)', color: '#6B7280' },
  { id: 'NO', tooltip: 'Normal Open', color: '#2563EB' },
  { id: 'NC', tooltip: 'Normal Closed', color: '#7C3AED' },
  { id: 'COIL', tooltip: 'Output Coil', color: '#059669' },
  { id: 'SET', tooltip: 'SET', color: '#059669' },
  { id: 'RST', tooltip: 'RESET', color: '#DC2626' },
  { id: 'TON', tooltip: 'Timer ON-Delay', color: '#D97706' },
  { id: 'TOF', tooltip: 'Timer OFF-Delay', color: '#D97706' },
  { id: 'TP', tooltip: 'Pulse Timer', color: '#D97706' },
  { id: 'CTU', tooltip: 'Count Up', color: '#0891B2' },
  { id: 'CTD', tooltip: 'Count Down', color: '#0891B2' },
  { id: 'RES', tooltip: 'Reset', color: '#DC2626' },
  { id: 'MEM', tooltip: 'Memory Bit', color: '#7C3AED' },
  { id: 'BRANCH', tooltip: 'Branch / Junction (tap a cell — a new lane appears instantly)', color: '#6B7280' },
  { id: 'DELETE', tooltip: 'Delete Cell', color: '#EF4444' },
]

function ToolIcon({ id, color }: { id: string; color: string }) {
  const c = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 2 } as const
  switch (id) {
    case 'SELECT':
      return <svg {...c}><path d="M5 3l6.5 16 2-6.7L20 10.3 5 3z" strokeLinejoin="round" strokeLinecap="round" /></svg>
    case 'NO':
      return <svg {...c}><line x1="1" y1="12" x2="8" y2="12" /><line x1="8" y1="6" x2="8" y2="18" /><line x1="16" y1="6" x2="16" y2="18" /><line x1="16" y1="12" x2="23" y2="12" /></svg>
    case 'NC':
      return <svg {...c}><line x1="1" y1="12" x2="8" y2="12" /><line x1="8" y1="6" x2="8" y2="18" /><line x1="16" y1="6" x2="16" y2="18" /><line x1="10" y1="7" x2="14" y2="17" /><line x1="16" y1="12" x2="23" y2="12" /></svg>
    case 'COIL':
      return <svg {...c}><line x1="1" y1="12" x2="6" y2="12" /><circle cx="12" cy="12" r="6" /><line x1="18" y1="12" x2="23" y2="12" /></svg>
    case 'SET':
      return <svg {...c}><circle cx="12" cy="12" r="7" /><text x="12" y="15.5" fontSize="8" fill={color} stroke="none" textAnchor="middle" fontFamily="monospace" fontWeight="bold">S</text></svg>
    case 'RST':
      return <svg {...c}><circle cx="12" cy="12" r="7" /><text x="12" y="15.5" fontSize="8" fill={color} stroke="none" textAnchor="middle" fontFamily="monospace" fontWeight="bold">R</text></svg>
    case 'TON':
    case 'TOF':
    case 'TP':
      return <svg {...c}><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="12" cy="12" r="3.6" /><line x1="12" y1="12" x2="12" y2="9.3" /><line x1="12" y1="12" x2="13.8" y2="13" /></svg>
    case 'CTU':
      return <svg {...c}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M8 15l4-6 4 6" strokeLinejoin="round" strokeLinecap="round" /></svg>
    case 'CTD':
      return <svg {...c}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M8 9l4 6 4-6" strokeLinejoin="round" strokeLinecap="round" /></svg>
    case 'RES':
      return <svg {...c}><path d="M3.5 12a8.5 8.5 0 1 0 2.4-5.9" strokeLinecap="round" /><path d="M3 3.5v5h5" strokeLinecap="round" strokeLinejoin="round" /></svg>
    case 'MEM':
      return <svg {...c}><rect x="4" y="4" width="16" height="16" rx="2" /><text x="12" y="15.5" fontSize="9" fill={color} stroke="none" textAnchor="middle" fontFamily="monospace" fontWeight="bold">M</text></svg>
    case 'WIRE':
      return <svg {...c}><line x1="2" y1="12" x2="22" y2="12" strokeLinecap="round" /></svg>
    case 'BRANCH':
      // Tee / junction symbol — a horizontal wire with a vertical drop, exactly
      // how CX-Programmer marks the start of a parallel branch: ────┬────
      return <svg {...c}><line x1="2" y1="8" x2="22" y2="8" strokeLinecap="round" /><line x1="12" y1="8" x2="12" y2="19" strokeLinecap="round" /><circle cx="12" cy="8" r="1.6" fill={color} stroke="none" /></svg>
    case 'DELETE':
      return <svg {...c}><path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13" strokeLinecap="round" strokeLinejoin="round" /></svg>
    default:
      return null
  }
}

function CellSVG({ cell, isActive, conducts, isDark, isEmpty, error }: { cell: CellSlot; isActive: boolean; conducts?: boolean; isDark: boolean; isEmpty?: boolean; error?: boolean }) {
  // `isActive` = incoming power reaching this cell (the rail segment up TO here).
  // `conducts` = whether this cell actually PASSES current onward (incoming power
  // AND, for a contact, its own address condition being satisfied). For non-
  // blocking cells (WIRE/COIL/SET/RST/TON/TOF/TP/CTU/CTD/RES) the two are always
  // identical, so `conducts` simply falls back to `isActive`. For NO/NC/MEM they
  // can differ — that's exactly the case a real PLC editor must show correctly:
  // the contact symbol and the wire LEAVING it must only light up when current
  // truly gets past the contact, never just because power arrived at its input.
  const passes = conducts ?? isActive
  const stroke = error ? '#EF4444' : isActive ? '#22C55E' : isDark ? '#9E9E9E' : '#555'
  const lineColor = error ? '#EF444488' : isDark ? '#555' : '#BDBDBD'

  if (!cell || !cell.type) {
    // A truly EMPTY cell is an open circuit — nothing is drawn automatically.
    // When it breaks an otherwise-wired path, show the gap in red so the
    // discontinuity is visible right where it happens.
    return (
      <svg width={CELL_W} height="40" viewBox={`0 0 ${CELL_W} 40`}>
        {error && <line x1={CELL_W / 2 - 5} y1="20" x2={CELL_W / 2 + 5} y2="20" stroke="#EF4444" strokeWidth="3" strokeLinecap="round" strokeDasharray="3 4" />}
        {isEmpty === false ? null : null}
      </svg>
    )
  }

  const flowStroke = error ? '#EF4444' : isActive ? '#22C55E' : stroke
  const dashProps = isActive && !error ? { strokeDasharray: '8 4', className: 'power-flow-active' } : {}
  // Contact-specific: the switch body and everything downstream of it only
  // light up when it's actually conducting, not merely receiving power.
  const contactStroke = error ? '#EF4444' : passes ? '#22C55E' : isDark ? '#9E9E9E' : '#555'
  const contactDash = passes && !error ? { strokeDasharray: '8 4', className: 'power-flow-active' } : {}

  switch (cell.type) {
    case 'NO':
      return (
        <svg width={CELL_W} height="40" viewBox={`0 0 ${CELL_W} 40`}>
          <line x1="0" y1="20" x2="18" y2="20" stroke={flowStroke} strokeWidth="1.5" {...dashProps} />
          <line x1="18" y1="12" x2="18" y2="28" stroke={contactStroke} strokeWidth="2" strokeLinecap="round" />
          <line x1="46" y1="12" x2="46" y2="28" stroke={contactStroke} strokeWidth="2" strokeLinecap="round" />
          <line x1="46" y1="20" x2={CELL_W} y2="20" stroke={passes ? '#22C55E' : lineColor} strokeWidth="1.5" {...(passes ? contactDash : {})} />
          <text x="32" y="10" textAnchor="middle" fontSize="9" fill={contactStroke} fontFamily="JetBrains Mono">{cell.address}</text>
        </svg>
      )
    case 'NC':
      return (
        <svg width={CELL_W} height="40" viewBox={`0 0 ${CELL_W} 40`}>
          <line x1="0" y1="20" x2="18" y2="20" stroke={flowStroke} strokeWidth="1.5" {...dashProps} />
          <line x1="18" y1="12" x2="18" y2="28" stroke={contactStroke} strokeWidth="2" strokeLinecap="round" />
          <line x1="46" y1="12" x2="46" y2="28" stroke={contactStroke} strokeWidth="2" strokeLinecap="round" />
          <line x1="22" y1="12" x2="42" y2="28" stroke={contactStroke} strokeWidth="1.5" strokeLinecap="round" />
          <line x1="46" y1="20" x2={CELL_W} y2="20" stroke={passes ? '#22C55E' : lineColor} strokeWidth="1.5" {...(passes ? contactDash : {})} />
          <text x="32" y="10" textAnchor="middle" fontSize="9" fill={contactStroke} fontFamily="JetBrains Mono">{cell.address}</text>
        </svg>
      )
    case 'COIL':
    case 'SET':
    case 'RST':
      return (
        <svg width={CELL_W} height="40" viewBox={`0 0 ${CELL_W} 40`}>
          <line x1="0" y1="20" x2="18" y2="20" stroke={flowStroke} strokeWidth="1.5" {...dashProps} />
          <circle cx="32" cy="20" r="10" fill="none" stroke={isActive ? '#22C55E' : stroke} strokeWidth="2" />
          {isActive && <circle cx="32" cy="20" r="10" fill="#22C55E22" />}
          <text x="32" y="24" textAnchor="middle" fontSize="8" fill={isActive ? '#22C55E' : stroke} fontFamily="JetBrains Mono" fontWeight="bold">
            {cell.type === 'COIL' ? '' : cell.type}
          </text>
          <line x1="42" y1="20" x2={CELL_W} y2="20" stroke={isActive ? '#22C55E' : lineColor} strokeWidth="1.5" />
          <text x="32" y="10" textAnchor="middle" fontSize="9" fill={isActive ? '#22C55E' : stroke} fontFamily="JetBrains Mono">{cell.address}</text>
        </svg>
      )
    case 'TON':
    case 'TOF':
    case 'TP':
      return (
        <svg width={CELL_W} height="40" viewBox={`0 0 ${CELL_W} 40`}>
          <line x1="0" y1="20" x2="10" y2="20" stroke={flowStroke} strokeWidth="1.5" {...dashProps} />
          <rect x="10" y="8" width="44" height="24" rx="3" fill={isActive ? '#D9770620' : isDark ? '#2D1A00' : '#FFF8EE'} stroke="#D97706" strokeWidth="1.5" />
          <text x="32" y="18" textAnchor="middle" fontSize="9" fill="#D97706" fontFamily="JetBrains Mono" fontWeight="600">{cell.type}</text>
          <text x="32" y="29" textAnchor="middle" fontSize="8" fill="#D97706" fontFamily="JetBrains Mono">{cell.preset || 0}{cell.timeUnit || 'ms'}</text>
          <line x1="54" y1="20" x2={CELL_W} y2="20" stroke={isActive ? '#22C55E' : lineColor} strokeWidth="1.5" />
        </svg>
      )
    case 'CTU':
    case 'CTD':
      return (
        <svg width={CELL_W} height="40" viewBox={`0 0 ${CELL_W} 40`}>
          <line x1="0" y1="20" x2="10" y2="20" stroke={flowStroke} strokeWidth="1.5" {...dashProps} />
          <rect x="10" y="8" width="44" height="24" rx="3" fill={isDark ? '#001A2D' : '#EFF6FF'} stroke="#2563EB" strokeWidth="1.5" />
          <text x="32" y="18" textAnchor="middle" fontSize="9" fill="#2563EB" fontFamily="JetBrains Mono" fontWeight="600">{cell.type}</text>
          <text x="32" y="29" textAnchor="middle" fontSize="8" fill="#2563EB" fontFamily="JetBrains Mono">PV:{cell.preset || 0}</text>
          <line x1="54" y1="20" x2={CELL_W} y2="20" stroke={isActive ? '#22C55E' : lineColor} strokeWidth="1.5" />
        </svg>
      )
    case 'MEM':
      return (
        <svg width={CELL_W} height="40" viewBox={`0 0 ${CELL_W} 40`}>
          <line x1="0" y1="20" x2="18" y2="20" stroke={flowStroke} strokeWidth="1.5" {...dashProps} />
          <rect x="18" y="10" width="28" height="20" rx="3" fill="none" stroke={contactStroke} strokeWidth="1.5" />
          <text x="32" y="23" textAnchor="middle" fontSize="9" fill={contactStroke} fontFamily="JetBrains Mono" fontWeight="bold">M</text>
          <line x1="46" y1="20" x2={CELL_W} y2="20" stroke={passes ? '#22C55E' : lineColor} strokeWidth="1.5" />
          <text x="32" y="9" textAnchor="middle" fontSize="8" fill={contactStroke} fontFamily="JetBrains Mono">{cell.address}</text>
        </svg>
      )
    case 'RES':
      return (
        <svg width={CELL_W} height="40" viewBox={`0 0 ${CELL_W} 40`}>
          <line x1="0" y1="20" x2="18" y2="20" stroke={flowStroke} strokeWidth="1.5" {...dashProps} />
          <circle cx="32" cy="20" r="10" fill="none" stroke={stroke} strokeWidth="2" />
          <text x="32" y="24" textAnchor="middle" fontSize="7" fill={stroke} fontFamily="JetBrains Mono" fontWeight="bold">RES</text>
          <line x1="42" y1="20" x2={CELL_W} y2="20" stroke={isActive ? '#22C55E' : lineColor} strokeWidth="1.5" />
          <text x="32" y="10" textAnchor="middle" fontSize="9" fill={stroke} fontFamily="JetBrains Mono">{cell.address}</text>
        </svg>
      )
    case 'WIRE':
      return (
        <svg width={CELL_W} height="40" viewBox={`0 0 ${CELL_W} 40`}>
          <line x1="0" y1="20" x2={CELL_W} y2="20" stroke={flowStroke} strokeWidth="2" {...dashProps} />
        </svg>
      )
    default:
      return <svg width={CELL_W} height="40" viewBox={`0 0 ${CELL_W} 40`} />
  }
}

// ===========================
// Pure evaluation helpers (grid-aware)
// ===========================
function evalCellPower(power: boolean, cell: CellSlot, ioState: Record<string, boolean>, mem: Record<string, boolean>): boolean {
  if (!cell) return false // EMPTY cell = open circuit, exactly like a missing wire on a real ladder grid
  if (cell.type === 'WIRE') return power
  if (cell.type === 'NO') return power && !!ioState[cell.address]
  if (cell.type === 'NC') return power && !ioState[cell.address]
  if (cell.type === 'MEM') return power && !!mem[cell.address]
  return power // outputs (COIL/SET/RST/TON/TOF/TP/CTU/CTD/RES) don't block power flow
}

// Evaluates power flow across every row of the rung, column by column.
// At each column boundary, any VLinks landing there first MERGE power
// across the rows they connect (a junction = parallel OR, computed with
// union-find so 3+ way junctions at the same column merge correctly too).
// Then every row's own cell at that column is evaluated in series, exactly
// as before (evalCellPower — untouched). This is the same electrical rule
// as the old BranchGroup code (parallel-then-series), just generalized to
// an arbitrary graph of rows instead of one rigid span per branch.
function evalRungGrid(rung: Rung, ioState: Record<string, boolean>, mem: Record<string, boolean>, pmap: Record<string, boolean>) {
  const nRows = rung.rows.length
  const cols = rung.cols
  const power: boolean[] = new Array(nRows).fill(false)
  power[0] = true // left rail always energizes the main row
  // A branch row with content at col 0 is also wired to the left rail —
  // this is what makes seal-in (self-holding) circuits work: the NO
  // contact of the output coil starts from the left rail, so it keeps
  // the rung energized even after the start contact opens.
  for (let r = 1; r < nRows; r++) {
    if (rung.rows[r][0]) power[r] = true
  }

  const mergeAt = (col: number) => {
    const linksHere = rung.links.filter(l => l.col === col)
    if (!linksHere.length) return
    const parent = Array.from({ length: nRows }, (_, i) => i)
    const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])))
    linksHere.forEach(l => { const a = find(l.rowA), b = find(l.rowB); if (a !== b) parent[a] = b })
    const merged: Record<number, boolean> = {}
    for (let r = 0; r < nRows; r++) { const root = find(r); merged[root] = (merged[root] || false) || power[r] }
    for (let r = 0; r < nRows; r++) power[r] = merged[find(r)]
  }

  for (let c = 0; c < cols; c++) {
    mergeAt(c)
    for (let r = 0; r < nRows; r++) {
      pmap[`${rung.id}-r${r}-${c}`] = power[r] // incoming power (rail up to this cell)
      power[r] = evalCellPower(power[r], rung.rows[r][c], ioState, mem)
      pmap[`${rung.id}-r${r}-${c}-out`] = power[r] // outgoing power — did this cell actually conduct?
    }
  }
  mergeAt(cols) // a junction may also sit right at the rung's own right edge
  for (let r = 0; r < nRows; r++) pmap[`${rung.id}-r${r}-${cols}`] = power[r]
  pmap[`${rung.id}-main-${cols}`] = power[0]
  return power[0]
}

function allCellEntries(rung: Rung): { cell: CellSlot; key: string }[] {
  const entries: { cell: CellSlot; key: string }[] = []
  rung.rows.forEach((row, r) => row.forEach((cell, c) => entries.push({ cell, key: `${rung.id}-r${r}-${c}` })))
  return entries
}

// Numeric part of an address label ("I20" -> 20), used to sort the dynamic
// Runtime panels in address order regardless of insertion order on the ladder.
const addressNumber = (addr: string): number => parseInt(addr.replace(/^[A-Za-z]+/, ''), 10) || 0

// Distinct addresses of a given prefix ("I" | "Q" | "M") that are actually
// placed on the ladder right now, sorted numerically. This is what drives
// every dynamic Runtime panel below — nothing here is hard-coded to a fixed
// I1-I6 / Q1-Q4 / M1-M4 range: if the ladder only uses I20/I21/I22/Q20, that
// is exactly what comes back.
function usedAddressesOfPrefix(cells: CellSlot[], prefix: 'I' | 'Q' | 'M'): string[] {
  const re = new RegExp(`^${prefix}\\d+$`)
  const set = new Set<string>()
  cells.forEach(c => { if (c && re.test(c.address)) set.add(c.address) })
  return Array.from(set).sort((a, b) => addressNumber(a) - addressNumber(b))
}

function getCellAt(rung: Rung, row: number, col: number): CellSlot {
  return rung.rows[row]?.[col] ?? null
}

function setCellAt(rung: Rung, row: number, col: number, cell: CellSlot): Rung {
  const rows = rung.rows.map((r, i) => (i === row ? r.map((c, j) => (j === col ? cell : c)) : r))
  return { ...rung, rows }
}

const isOutputType = (t: CellType) => t === 'COIL' || t === 'SET' || t === 'RST'

// An output coil is legal at the very last column of ANY row — main rail or a
// branch lane — because every parallel path in a rung still terminates at the
// same right power rail. This is what makes multiple coils on different
// branch paths within one rung valid, exactly like real Omron ladder logic
// (each parallel path can drive its own output as long as it reaches the rail).
function canPlaceOutput(rung: Rung, _row: number, col: number): boolean {
  return col === rung.cols - 1
}

interface RungValidity { valid: boolean; reason: string; badCells: Set<string> } // badCells keyed "row-col"

// Full connectivity check over the row/link graph, exactly like a real
// ladder compiler would run before scan:
// - row 0 (main rail) must have no gap between the left rail and its last
//   placed cell, and any output coil must sit at its very last column.
// - every other row is only "live" from the column of its EARLIEST
//   junction onward; a gap between that entry point and its last placed
//   cell is an open circuit, and content with no junction at all is a
//   disconnected/orphan lane.
// A rung with nothing placed on it yet is treated as "empty", not "broken".
function validateRung(rung: Rung): RungValidity {
  const badCells = new Set<string>()
  let reason = ''
  const hasAnyContent = rung.rows.some(row => row.some(c => !!c))
  if (!hasAnyContent) return { valid: true, reason: '', badCells }

  const entryCol = rung.rows.map((_, r) => {
    if (r === 0) return 0
    const cs = rung.links.filter(l => l.rowA === r || l.rowB === r).map(l => l.col)
    return cs.length ? Math.min(...cs) : -1
  })

  rung.rows.forEach((row, r) => {
    let lastFilled = -1
    row.forEach((c, i) => { if (c) lastFilled = i })

    if (lastFilled === -1) {
      // A lane with a junction into it but literally no wire placed yet is a
      // dangling branch — it doesn't terminate on any horizontal wire.
      if (r > 0 && entryCol[r] !== -1) {
        badCells.add(`${r}-${entryCol[r]}`)
        if (!reason) reason = `Lane ${r} branches out but has no wire — branch does not terminate on a horizontal wire`
      }
      return // otherwise this lane is simply empty — nothing to validate yet
    }

    if (entryCol[r] === -1) {
      for (let c = 0; c <= lastFilled; c++) badCells.add(`${r}-${c}`)
      if (!reason) reason = `Lane ${r} is not connected to any junction`
      return
    }
    for (let c = entryCol[r]; c <= lastFilled; c++) {
      if (!row[c]) {
        badCells.add(`${r}-${c}`)
        if (!reason) reason = `Open Circuit at ${r === 0 ? 'Main Rail' : `Lane ${r}`}, Column ${c + 1}`
      }
    }
    row.forEach((cell, i) => {
      if (cell && isOutputType(cell.type) && !canPlaceOutput(rung, r, i)) {
        badCells.add(`${r}-${i}`)
        if (!reason) reason = `Floating Coil at ${r === 0 ? 'Main Rail' : `Lane ${r}`}, Column ${i + 1} — not connected to Right Rail`
      }
    })
  })

  const valid = badCells.size === 0
  return { valid, reason: valid ? '' : reason, badCells }
}

export default function SimulatorEditorScreen({ projectName, theme, project, onBack, onSaveLadder }: SimulatorEditorScreenProps) {
  const isDark = theme === 'dark'
  const bg = isDark ? '#1A1A1A' : '#F0F0F0'
  const appBar = isDark ? '#2A2A2A' : '#FFFFFF'
  const toolbar = isDark ? '#222' : '#F7F7F7'
  const text = isDark ? '#F5F5F5' : '#1C1C1C'
  const muted = isDark ? '#9E9E9E' : '#757575'
  const border = isDark ? '#404040' : '#E0E0E0'
  const workspace = isDark ? '#1A1A1A' : '#FAFAFA'
  const rungBg = isDark ? '#242424' : '#FFFFFF'
  const railColor = isDark ? '#E5E5E5' : '#2D2D2D'
  const gridLine = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'

  const [rungs, setRungs] = useState<Rung[]>([makeRung(1), makeRung(2), makeRung(3)])
  const [running, setRunning] = useState(false)
  const [selectedTool, setSelectedTool] = useState<ToolId>('SELECT')
  const [dialog, setDialog] = useState<Dialog>({ type: null, rungId: 0, row: 0, col: 0 })
  const [bottomPanelOpen, setBottomPanelOpen] = useState(true)
  const [activeRung, setActiveRung] = useState<number | null>(null)
  const [zoom, setZoom] = useState(1)
  const [fabOpen, setFabOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [branchAnchor, setBranchAnchor] = useState<{ rungId: number; row: number; col: number } | null>(null)
  // 'new'     → tap ONE cell, a lane + vertical wire appears instantly (default, matches how every other tool works: one tap = one placement).
  // 'connect' → advanced: tap two existing lanes to tie them together. Opt-in only, so the default branch action never waits for a second tap.
  const [branchMode, setBranchMode] = useState<'new' | 'connect'>('new')
  // Purely visual feedback for the BRANCH tool — never read by the engine, the
  // parser, or export. `snapFlash` briefly marks a junction right after it's
  // placed so it visibly "locks" into the grid instead of just silently appearing.
  const [snapFlash, setSnapFlash] = useState<{ rungId: number; col: number; rowA: number; rowB: number } | null>(null)
  const snapFlashTimeoutRef = useRef<number | null>(null)
  const triggerSnapFlash = (rungId: number, col: number, rowA: number, rowB: number) => {
    setSnapFlash({ rungId, col, rowA, rowB })
    if (snapFlashTimeoutRef.current) window.clearTimeout(snapFlashTimeoutRef.current)
    snapFlashTimeoutRef.current = window.setTimeout(() => setSnapFlash(null), 700)
  }
  const workspaceRef = useRef<HTMLDivElement>(null)
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(t => (t === msg ? null : t)), 2200) }

  // ===== Live simulation state (local to this screen only) =====
  // Starts empty — the set of usable input addresses is derived dynamically
  // from whatever the ladder actually uses (see `usedInputAddrs` below), not
  // hard-coded. Keys are added on first toggle; reading an address that was
  // never toggled simply falls back to `false` (see `inputs[addr] ?? false`
  // at every read site), so nothing needs to be pre-seeded here.
  const [inputs, setInputs] = useState<Record<string, boolean>>({})
  const [memory, setMemory] = useState<Record<string, boolean>>({})
  const [timers, setTimers] = useState<Record<string, TimerState>>({})
  const [counters, setCounters] = useState<Record<string, CounterState>>({})
  const [powerMap, setPowerMap] = useState<Record<string, boolean>>({})

  const rungsRef = useRef(rungs)
  const inputsRef = useRef(inputs)
  const memoryRef = useRef(memory)
  const timersRef = useRef(timers)
  const countersRef = useRef(counters)
  const edgeRef = useRef<Record<string, boolean>>({})

  useEffect(() => () => { if (snapFlashTimeoutRef.current) window.clearTimeout(snapFlashTimeoutRef.current) }, [])
  useEffect(() => { rungsRef.current = rungs }, [rungs])
  useEffect(() => { inputsRef.current = inputs }, [inputs])
  useEffect(() => { memoryRef.current = memory }, [memory])
  useEffect(() => { timersRef.current = timers }, [timers])
  useEffect(() => { countersRef.current = counters }, [counters])

  // ===== Undo / Redo (snapshot-based, 100-action limit) =====
  const undoStackRef = useRef<Rung[][]>([])
  const redoStackRef = useRef<Rung[][]>([])
  const [, forceHistoryUpdate] = useState({})
  const [autoSaveIndicator, setAutoSaveIndicator] = useState(false)
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const dirtyRef = useRef(false)
  const handleSaveRef = useRef<() => void>(() => {})

  const recordHistory = useCallback(() => {
    undoStackRef.current.push(rungsRef.current)
    if (undoStackRef.current.length > 100) undoStackRef.current.shift()
    redoStackRef.current = []
    dirtyRef.current = true
    forceHistoryUpdate({})
  }, [])

  const undo = useCallback(() => {
    if (undoStackRef.current.length === 0) return
    redoStackRef.current.push(rungsRef.current)
    const prev = undoStackRef.current.pop()!
    setRungs(prev)
    forceHistoryUpdate({})
  }, [])

  const redo = useCallback(() => {
    if (redoStackRef.current.length === 0) return
    undoStackRef.current.push(rungsRef.current)
    const next = redoStackRef.current.pop()!
    setRungs(next)
    forceHistoryUpdate({})
  }, [])

  const canUndo = undoStackRef.current.length > 0
  const canRedo = redoStackRef.current.length > 0

  handleSaveRef.current = () => {
    if (onSaveLadder) {
      onSaveLadder(JSON.stringify(rungsRef.current))
      dirtyRef.current = false
      setAutoSaveIndicator(true)
      setTimeout(() => setAutoSaveIndicator(false), 1500)
    }
  }

  const tick = () => {
    const mem = { ...memoryRef.current }
    const newTimers: Record<string, TimerState> = { ...timersRef.current }
    const newCounters: Record<string, CounterState> = { ...countersRef.current }
    const newPowerMap: Record<string, boolean> = {}

    rungsRef.current.forEach(rung => {
      if (!validateRung(rung).valid) return // open circuit — RUN stays on, this rung just doesn't execute
      // A contact can reference a Timer/Counter DONE bit directly by its TIM/CTU
      // address — exactly like Omron CX-Programmer, where the instruction block
      // and any contact reading its completion bit are two separate objects that
      // just happen to share an address. This makes those done bits visible.
      const doneBits: Record<string, boolean> = {}
      Object.keys(newTimers).forEach(addr => { doneBits[addr] = newTimers[addr].done })
      Object.keys(newCounters).forEach(addr => { doneBits[addr] = newCounters[addr].done })
      const ioState: Record<string, boolean> = { ...inputsRef.current, ...mem, ...doneBits }
      evalRungGrid(rung, ioState, mem, newPowerMap)

      allCellEntries(rung).forEach(({ cell, key }) => {
        if (!cell) return
        const energized = newPowerMap[key] ?? false
        const presetMs = (cell.preset || 0) * unitMs(cell.timeUnit)
        if (cell.type === 'COIL') mem[cell.address] = energized
        else if (cell.type === 'SET') { if (energized) mem[cell.address] = true }
        else if (cell.type === 'RST') { if (energized) mem[cell.address] = false }
        else if (cell.type === 'TON') {
          const t = newTimers[cell.address] || { acc: 0, done: false }
          t.acc = energized ? Math.min(t.acc + TICK_MS, presetMs) : 0
          t.done = t.acc >= presetMs && presetMs > 0
          newTimers[cell.address] = { ...t }
        } else if (cell.type === 'TOF') {
          const t = newTimers[cell.address] || { acc: 0, done: false }
          if (energized) { t.acc = 0; t.done = true } else { t.acc = Math.min(t.acc + TICK_MS, presetMs); t.done = t.acc < presetMs }
          newTimers[cell.address] = { ...t }
        } else if (cell.type === 'TP') {
          const t = newTimers[cell.address] || { acc: presetMs, done: false }
          const rising = energized && !edgeRef.current[key]
          if (rising) t.acc = 0
          if (t.acc < presetMs) t.acc = Math.min(t.acc + TICK_MS, presetMs)
          t.done = t.acc < presetMs
          newTimers[cell.address] = { ...t }
        } else if (cell.type === 'CTU') {
          const cnt = newCounters[cell.address] || { cv: 0, done: false }
          const rising = energized && !edgeRef.current[key]
          if (rising) cnt.cv = Math.min(cnt.cv + 1, cell.preset || 0)
          cnt.done = cnt.cv >= (cell.preset || 0) && (cell.preset || 0) > 0
          newCounters[cell.address] = { ...cnt }
        } else if (cell.type === 'CTD') {
          const cnt = newCounters[cell.address] || { cv: cell.preset || 0, done: false }
          const rising = energized && !edgeRef.current[key]
          if (rising) cnt.cv = Math.max(cnt.cv - 1, 0)
          cnt.done = cnt.cv <= 0
          newCounters[cell.address] = { ...cnt }
        }
        edgeRef.current[key] = energized
      })
    })

    memoryRef.current = mem
    timersRef.current = newTimers
    countersRef.current = newCounters
    setMemory(mem)
    setTimers(newTimers)
    setCounters(newCounters)
    setPowerMap(newPowerMap)
  }

  useEffect(() => {
    if (!running) return
    const id = setInterval(tick, TICK_MS)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running])

  // ===== Load project ladder on mount =====
  useEffect(() => {
    if (project?.ladderJson) {
      try {
        const parsed = JSON.parse(project.ladderJson) as Rung[]
        if (Array.isArray(parsed) && parsed.length > 0) {
          setRungs(parsed)
          undoStackRef.current = []
          redoStackRef.current = []
        }
      } catch { /* keep default rungs on parse failure */ }
    }
  }, [project])

  // ===== Auto-save (30s interval, background — never blocks UI) =====
  useEffect(() => {
    if (!onSaveLadder) return
    const interval = setInterval(() => {
      if (dirtyRef.current) {
        onSaveLadder(JSON.stringify(rungsRef.current))
        dirtyRef.current = false
        setAutoSaveIndicator(true)
        setTimeout(() => setAutoSaveIndicator(false), 1500)
      }
    }, 30000)
    return () => clearInterval(interval)
  }, [onSaveLadder])

  // ===== Keyboard shortcuts (Ctrl+Z undo, Ctrl+Y redo, Ctrl+S save) =====
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        redo()
      } else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        handleSaveRef.current()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [undo, redo])

  const handleExport = (format: 'gsp' | 'json') => {
    if (!project) return
    const envelope: ProjectExportEnvelope = {
      format: 'genspace',
      formatVersion: EXPORT_FORMAT_VERSION,
      exportedAt: new Date().toISOString(),
      project: {
        ...project,
        ladderJson: JSON.stringify(rungsRef.current),
        updatedAt: new Date().toISOString(),
      },
    }
    const content = JSON.stringify(envelope, null, 2)
    const filename = `${sanitizeFilename(project.name)}.${format}`
    downloadFile(filename, content, 'application/json')
    showToast(`Exported ${filename}`)
    setExportMenuOpen(false)
  }

  const startRun = () => {
    // Compile-time check, exactly like a real PLC editor: every rung must have
    // a complete electrical path (left rail -> right rail) before the program
    // is allowed to run at all. One broken rung blocks the whole run.
    for (let i = 0; i < rungs.length; i++) {
      const v = validateRung(rungs[i])
      if (!v.valid) {
        showToast(`Rung ${i + 1} · ${v.reason}`)
        setActiveRung(rungs[i].id)
        return
      }
    }
    setMemory({}); memoryRef.current = {}
    setTimers({}); timersRef.current = {}
    setCounters({}); countersRef.current = {}
    edgeRef.current = {}
    setPowerMap({})
    setRunning(true)
  }
  const stopRun = () => setRunning(false)
  const toggleInput = (addr: string) => setInputs(prev => ({ ...prev, [addr]: !prev[addr] }))

  // ===== Grid / cell helpers =====
  const findRung = (rungId: number) => rungs.find(r => r.id === rungId)

  const mutateRung = (rungId: number, fn: (r: Rung) => Rung) => {
    recordHistory()
    setRungs(prev => prev.map(r => (r.id === rungId ? fn(r) : r)))
  }

  const clearCell = (rungId: number, row: number, col: number) => {
    mutateRung(rungId, r => {
      const cleared = setCellAt(r, row, col, null)
      // DELETE also severs any junction that touches this exact (row, col) —
      // the cell-tap is our hit-test for both a wire segment and a junction end.
      const links = cleared.links.filter(l => !((l.rowA === row || l.rowB === row) && l.col === col))
      return { ...cleared, links }
    })
  }
  const placeCell = (rungId: number, row: number, col: number, cell: GridCell) => {
    mutateRung(rungId, r => setCellAt(r, row, col, cell))
  }

  const findFreeCol = (r: Rung, row: number): number | null => {
    for (let c = 0; c < r.cols; c++) if (!r.rows[row][c]) return c
    return null
  }

  // Branch is not its own object — it's just a new full-width row plus a
  // vertical junction (VLink) tying it to whichever row the user tapped.
  // `fromRow` can be the main rail OR any existing lane, so branching off a
  // branch (nested branches, unlimited depth) falls out for free.
  const branchOut = (rungId: number, fromRow: number, col: number) => {
    mutateRung(rungId, r => {
      const newRowIdx = r.rows.length
      const rows = [...r.rows, emptyRow(r.cols)]
      const links = [...r.links, { rowA: fromRow, rowB: newRowIdx, col }]
      return { ...r, rows, links }
    })
  }
  // Connects (or, on a second tap, disconnects) two EXISTING rows at a
  // column — this is how a lane merges back into another row, how two
  // lanes join each other, and how overlapping junctions are built; no
  // special "merge point" object needed, it's just another VLink.
  const linkRows = (rungId: number, rowA: number, rowB: number, col: number) => {
    mutateRung(rungId, r => {
      const same = (l: VLink) => l.col === col && ((l.rowA === rowA && l.rowB === rowB) || (l.rowA === rowB && l.rowB === rowA))
      const exists = r.links.some(same)
      const links = exists ? r.links.filter(l => !same(l)) : [...r.links, { rowA, rowB, col }]
      return { ...r, links }
    })
  }
  const removeLastLane = (rungId: number) => {
    mutateRung(rungId, r => {
      if (r.rows.length <= 1) return r
      const lastIdx = r.rows.length - 1
      if (r.rows[lastIdx].some(c => !!c)) { showToast('Clear the lane before deleting it'); return r }
      return { ...r, rows: r.rows.slice(0, -1), links: r.links.filter(l => l.rowA !== lastIdx && l.rowB !== lastIdx) }
    })
  }
  const addColumn = (rungId: number) => {
    mutateRung(rungId, r => (r.cols >= MAX_COLS ? r : { ...r, cols: r.cols + 1, rows: r.rows.map(row => [...row, null]) }))
  }
  const removeColumn = (rungId: number) => {
    mutateRung(rungId, r => {
      if (r.cols <= MIN_COLS) return r
      const lastIdx = r.cols - 1
      if (r.rows.some(row => !!row[lastIdx])) { showToast('Clear the last column before removing it'); return r }
      if (r.links.some(l => l.col >= lastIdx)) { showToast('Move any junction off the last column before removing it'); return r }
      return { ...r, cols: r.cols - 1, rows: r.rows.map(row => row.slice(0, -1)) }
    })
  }

  const openEditForExisting = (cell: GridCell, rungId: number, row: number, col: number) => {
    if (cell.type === 'TON' || cell.type === 'TOF' || cell.type === 'TP' || cell.type === 'CTU' || cell.type === 'CTD') {
      // Editing a timer/counter block also re-opens the address step first, so its
      // TIM/CTU address is just as re-configurable as everything else, not frozen.
      setDialog({ type: 'address', rungId, row, col, pendingType: cell.type, editing: true, initialAddress: cell.address, initialPreset: cell.preset, initialUnit: cell.timeUnit })
    } else if (cell.type === 'WIRE') {
      clearCell(rungId, row, col)
    } else {
      setDialog({ type: 'address', rungId, row, col, pendingType: cell.type, editing: true, initialAddress: cell.address })
    }
  }

  const handleCellTap = (rungId: number, row: number, col: number) => {
    if (selectedTool === 'DELETE') { clearCell(rungId, row, col); return }
    if (selectedTool === 'BRANCH') {
      if (branchMode === 'new') {
        // Default branch action: ONE tap, right where the finger lands — a new
        // lane drops from this exact row/column immediately. No anchor step,
        // no second tap, no toast to read first.
        const r = findRung(rungId)
        const newRowIdx = r ? r.rows.length : row + 1
        branchOut(rungId, row, col)
        triggerSnapFlash(rungId, col, row, newRowIdx)
        return
      }
      // 'connect' mode only: tie two EXISTING lanes together — this genuinely
      // needs two points, so it keeps the anchor/second-tap flow, but the user
      // has to opt into this mode first (see the mode toggle in the hint bar).
      if (!branchAnchor || branchAnchor.rungId !== rungId) {
        setBranchAnchor({ rungId, row, col })
        showToast('Now tap the wire you want to connect it to')
        return
      }
      const anchor = branchAnchor
      setBranchAnchor(null)
      if (anchor.row === row && anchor.col === col) return // tapped the anchor itself again — treat as cancel
      linkRows(rungId, anchor.row, row, anchor.col)
      triggerSnapFlash(rungId, anchor.col, anchor.row, row)
      return
    }
    setBranchAnchor(null)
    if (selectedTool === 'WIRE') { placeCell(rungId, row, col, { type: 'WIRE', address: '' }); return }
    if (selectedTool === 'SELECT') {
      const r = findRung(rungId)
      const cell = r ? getCellAt(r, row, col) : null
      if (!cell) setDialog({ type: 'component', rungId, row, col })
      else openEditForExisting(cell, rungId, row, col)
      return
    }
    const type = selectedTool as CellType
    if (isOutputType(type)) {
      const r = findRung(rungId)
      if (!r || !canPlaceOutput(r, row, col)) { showToast('Output coil is only valid at the last column of a branch path, right before the right rail'); return }
    }
    // Every placeable instruction — contact, coil, or timer/counter block — starts
    // with address selection. For TON/TOF/TP/CTU/CTD this is the block's OWN address
    // (a fresh TIM/CTU number), separate from any contact that later reads its done bit.
    setDialog({ type: 'address', rungId, row, col, pendingType: type })
  }

  const handleCellDoubleTap = (rungId: number, row: number, col: number) => {
    setDialog({ type: 'component', rungId, row, col })
  }

  const handleSelectComponent = (type: CellType) => {
    const { rungId, row, col } = dialog
    if (isOutputType(type)) {
      const r = findRung(rungId)
      if (!r || !canPlaceOutput(r, row, col)) {
        showToast('Output coil is only valid at the last column of a branch path, right before the right rail')
        closeDialog()
        return
      }
    }
    if (type === 'WIRE') {
      placeCell(rungId, row, col, { type: 'WIRE', address: '' })
      closeDialog()
      return
    }
    setDialog(d => ({ ...d, type: 'address', pendingType: type }))
  }

  const closeDialog = () => setDialog({ type: null, rungId: 0, row: 0, col: 0 })

  const handleSelectAddress = (address: string) => {
    const { pendingType } = dialog
    // Timer/Counter INSTRUCTION blocks need a preset too — carry the chosen
    // TIM/CTU address forward into the preset-config step instead of placing yet.
    if (pendingType === 'TON' || pendingType === 'TOF' || pendingType === 'TP') {
      setDialog(d => ({ ...d, type: 'timer', pendingAddress: address }))
      return
    }
    if (pendingType === 'CTU' || pendingType === 'CTD') {
      setDialog(d => ({ ...d, type: 'counter', pendingAddress: address }))
      return
    }
    const { rungId, row, col } = dialog
    placeCell(rungId, row, col, { type: pendingType!, address })
    closeDialog()
  }

  const handleTimerConfig = (preset: number, unit: string) => {
    const { rungId, row, col, pendingType, pendingAddress, editing } = dialog
    const r = findRung(rungId)
    const existing = r ? getCellAt(r, row, col) : null
    const address = pendingAddress ?? (editing && existing ? existing.address : `TIM${rungId}`)
    placeCell(rungId, row, col, { type: pendingType!, address, preset, timeUnit: unit })
    closeDialog()
  }

  const handleCounterConfig = (preset: number) => {
    const { rungId, row, col, pendingType, pendingAddress, editing } = dialog
    const r = findRung(rungId)
    const existing = r ? getCellAt(r, row, col) : null
    const address = pendingAddress ?? (editing && existing ? existing.address : `CTU${rungId}`)
    placeCell(rungId, row, col, { type: pendingType!, address, preset })
    closeDialog()
  }

  const handleDialogDelete = () => {
    const { rungId, row, col } = dialog
    clearCell(rungId, row, col)
    closeDialog()
  }

  const addRung = () => {
    recordHistory()
    const newId = Math.max(...rungs.map(r => r.id)) + 1
    setRungs(prev => [...prev, makeRung(newId)])
    setFabOpen(false)
  }
  const duplicateRung = () => {
    recordHistory()
    const targetId = activeRung ?? rungs[rungs.length - 1].id
    const target = rungs.find(r => r.id === targetId)
    if (!target) return
    const newId = Math.max(...rungs.map(r => r.id)) + 1
    const clone: Rung = {
      ...target,
      id: newId,
      rows: target.rows.map(row => [...row]),
      links: target.links.map(l => ({ ...l })),
    }
    setRungs(prev => {
      const idx = prev.findIndex(r => r.id === targetId)
      const next = [...prev]
      next.splice(idx + 1, 0, clone)
      return next
    })
    setFabOpen(false)
  }
  const deleteRungFab = () => {
    if (rungs.length <= 1) { setFabOpen(false); return }
    recordHistory()
    const targetId = activeRung ?? rungs[rungs.length - 1].id
    setRungs(prev => prev.filter(r => r.id !== targetId))
    setActiveRung(null)
    setFabOpen(false)
  }
  const insertBranchFab = () => {
    const targetId = activeRung ?? rungs[rungs.length - 1].id
    const r = findRung(targetId)
    if (!r) return
    const col = findFreeCol(r, 0)
    if (col !== null) branchOut(targetId, 0, col)
    setFabOpen(false)
  }

  const canClose = dialog.type !== null

  // Distinct timer/counter addresses currently placed on the ladder (for RUN panels)
  const allCells = rungs.flatMap(r => allCellEntries(r).map(e => e.cell))
  const allTimerAddrs = Array.from(new Set(allCells.filter(c => c && (c.type === 'TON' || c.type === 'TOF' || c.type === 'TP')).map(c => c!.address)))
  const allCounterAddrs = Array.from(new Set(allCells.filter(c => c && (c.type === 'CTU' || c.type === 'CTD')).map(c => c!.address)))
  const timerAddrs = allTimerAddrs.slice(0, 4)
  const counterAddrs = allCounterAddrs.slice(0, 4)

  // Distinct I/Q/M addresses actually placed on the ladder — this is what the
  // Runtime "INPUT SIMULATION" / "OUTPUT" / "MEMORY" panels render, instead
  // of a fixed I1-I6/Q1-Q4/M1-M4 list. Recomputed on every render straight
  // from `rungs`, so adding/removing a contact or coil updates the panels
  // immediately — no separate "sync" step needed.
  const usedInputAddrs = usedAddressesOfPrefix(allCells, 'I')
  const usedOutputAddrs = usedAddressesOfPrefix(allCells, 'Q')
  const usedMemoryAddrs = usedAddressesOfPrefix(allCells, 'M')

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      backgroundColor: bg,
      overflow: 'hidden',
    }}>
      <style>{`
        @keyframes pulseGlow { 0%,100% { opacity: 1 } 50% { opacity: 0.4 } }
        .power-flow-active { animation: dashScroll 0.6s linear infinite }
        @keyframes dashScroll { to { stroke-dashoffset: -24 } }
        .ge-btn { transition: all 180ms ease; }
        .ge-fab-item { transition: transform 180ms ease, opacity 180ms ease; }
      `}</style>

      {/* === TOP APP BAR === */}
      <div style={{
        backgroundColor: appBar,
        borderBottom: `1px solid ${border}`,
        padding: '0 8px',
        height: 56,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        flexShrink: 0,
        zIndex: 60,
      }}>
        <button onClick={onBack} style={iconBtnStyle(isDark)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={text} strokeWidth="2">
            <path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <span style={{
          flex: 1,
          fontSize: 15,
          fontWeight: 600,
          color: text,
          fontFamily: 'Inter',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          padding: '0 4px',
        }}>{projectName}</span>

        <button onClick={undo} disabled={!canUndo} style={{ ...iconBtnStyle(isDark), opacity: canUndo ? 1 : 0.3, cursor: canUndo ? 'pointer' : 'default' }} title="Undo (Ctrl+Z)">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={canUndo ? text : muted} strokeWidth="2">
            <path d="M3 7v6h6" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M3 13A9 9 0 1 0 5.27 6.5" strokeLinecap="round" />
          </svg>
        </button>
        <button onClick={redo} disabled={!canRedo} style={{ ...iconBtnStyle(isDark), opacity: canRedo ? 1 : 0.3, cursor: canRedo ? 'pointer' : 'default' }} title="Redo (Ctrl+Y)">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={canRedo ? text : muted} strokeWidth="2">
            <path d="M21 7v6h-6" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M21 13A9 9 0 1 1 18.73 6.5" strokeLinecap="round" />
          </svg>
        </button>
        <button onClick={() => handleSaveRef.current()} style={iconBtnStyle(isDark)} title="Save (Ctrl+S)">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={text} strokeWidth="2">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
            <polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" />
          </svg>
        </button>
        <div style={{ position: 'relative' }}>
          <button onClick={() => setExportMenuOpen(o => !o)} style={iconBtnStyle(isDark)} title="Export">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={text} strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" strokeLinejoin="round" />
              <polyline points="7 10 12 15 17 10" strokeLinecap="round" strokeLinejoin="round" />
              <line x1="12" y1="15" x2="12" y2="3" strokeLinecap="round" />
            </svg>
          </button>
          {exportMenuOpen && (
            <div style={{ position: 'absolute', right: 0, top: 40, zIndex: 100, backgroundColor: appBar, border: `1px solid ${border}`, borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', overflow: 'hidden' }}>
              <button onClick={() => handleExport('gsp')} style={{ display: 'block', width: '100%', padding: '8px 16px', border: 'none', backgroundColor: 'transparent', color: text, fontFamily: 'Inter', fontSize: 12, cursor: 'pointer', textAlign: 'left' }}>Export .gsp</button>
              <button onClick={() => handleExport('json')} style={{ display: 'block', width: '100%', padding: '8px 16px', border: 'none', backgroundColor: 'transparent', color: text, fontFamily: 'Inter', fontSize: 12, cursor: 'pointer', textAlign: 'left' }}>Export .json</button>
            </div>
          )}
        </div>
        {autoSaveIndicator && (
          <span style={{ fontSize: 10, color: '#22C55E', fontFamily: 'JetBrains Mono', fontWeight: 600, padding: '0 4px', whiteSpace: 'nowrap' }}>
            Saved
          </span>
        )}

        {!running ? (
          <button className="ge-btn" onClick={startRun} style={{
            height: 36, borderRadius: 10, backgroundColor: '#22C55E', border: 'none', padding: '0 14px',
            display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer',
            fontFamily: 'Inter', fontWeight: 700, fontSize: 13, color: '#fff',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3" /></svg>
            RUN
          </button>
        ) : (
          <button className="ge-btn" onClick={stopRun} style={{
            height: 36, borderRadius: 10, backgroundColor: '#EF4444', border: 'none', padding: '0 14px',
            display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer',
            fontFamily: 'Inter', fontWeight: 700, fontSize: 13, color: '#fff',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
            STOP
          </button>
        )}
      </div>

      {/* === COMPONENT TOOLBAR === */}
      <div style={{
        backgroundColor: toolbar,
        borderBottom: `1px solid ${border}`,
        padding: '0 4px',
        height: 52,
        display: 'flex',
        alignItems: 'center',
        overflowX: 'auto',
        flexShrink: 0,
        gap: 2,
      }}>
        {TOOLBAR_ITEMS.map(item => (
          <button
            key={item.id}
            className="ge-btn"
            onClick={() => { setSelectedTool(item.id); setBranchAnchor(null); if (item.id === 'BRANCH') setBranchMode('new') }}
            title={item.tooltip}
            style={{
              flexShrink: 0,
              minWidth: 44,
              height: 40,
              borderRadius: 10,
              border: selectedTool === item.id ? `2px solid ${item.color}` : `1px solid transparent`,
              backgroundColor: selectedTool === item.id ? item.color + '22' : isDark ? '#333' : '#EEEEEE',
              cursor: 'pointer',
              padding: '0 10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ToolIcon id={item.id as string} color={selectedTool === item.id ? item.color : muted} />
          </button>
        ))}
      </div>

      {/* Active tool hint */}
      <div style={{
        backgroundColor: toolbar, borderBottom: `1px solid ${border}`, padding: '4px 12px', flexShrink: 0,
        fontSize: 10, color: muted, fontFamily: 'JetBrains Mono',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap',
      }}>
        <span>
          {selectedTool === 'SELECT' && 'SELECT MODE · tap a cell to edit, tap an empty cell to insert'}
          {selectedTool === 'DELETE' && 'DELETE MODE · tap a cell to clear it back to EMPTY'}
          {selectedTool === 'WIRE' && 'WIRE MODE · tap a cell to place a wire segment connecting it to its neighbours'}
          {selectedTool === 'BRANCH' && branchMode === 'new' && 'BRANCH MODE · tap any cell — a new lane + vertical wire appears there instantly'}
          {selectedTool === 'BRANCH' && branchMode === 'connect' && (branchAnchor
            ? 'CONNECT MODE · now tap the other wire to tie them together'
            : 'CONNECT MODE · tap the first wire, then the second, to link two existing lanes')}
          {!['SELECT', 'DELETE', 'WIRE', 'BRANCH'].includes(selectedTool as string) && `${selectedTool} MODE · tap a cell to insert directly · double-tap for full picker`}
        </span>
        {selectedTool === 'BRANCH' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: `1px solid ${border}` }}>
              <button
                className="ge-btn"
                onClick={() => { setBranchMode('new'); setBranchAnchor(null) }}
                style={{
                  fontSize: 9, fontFamily: 'JetBrains Mono', fontWeight: 700, padding: '3px 8px', border: 'none', cursor: 'pointer',
                  color: branchMode === 'new' ? '#fff' : muted,
                  backgroundColor: branchMode === 'new' ? '#6B7280' : 'transparent',
                }}
              >
                New Lane
              </button>
              <button
                className="ge-btn"
                onClick={() => { setBranchMode('connect'); setBranchAnchor(null) }}
                style={{
                  fontSize: 9, fontFamily: 'JetBrains Mono', fontWeight: 700, padding: '3px 8px', border: 'none', cursor: 'pointer',
                  color: branchMode === 'connect' ? '#fff' : muted,
                  backgroundColor: branchMode === 'connect' ? '#6B7280' : 'transparent',
                }}
              >
                Connect
              </button>
            </div>
            {branchMode === 'connect' && branchAnchor && (
              <button
                className="ge-btn"
                onClick={() => setBranchAnchor(null)}
                style={{
                  flexShrink: 0, fontSize: 9, fontFamily: 'JetBrains Mono', fontWeight: 700,
                  color: '#EF4444', backgroundColor: '#EF444418', border: '1px solid #EF444444',
                  borderRadius: 6, padding: '2px 8px', cursor: 'pointer',
                }}
              >
                ✕ Cancel
              </button>
            )}
          </div>
        )}
      </div>

      {/* === MAIN WORKSPACE === */}
      <div
        ref={workspaceRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          backgroundColor: workspace,
          position: 'relative',
          padding: '8px 0',
        }}
      >
        {running && (
          <div style={{
            position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#22C55E22', borderBottom: '1px solid #22C55E44',
            padding: '4px 16px', display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <div style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E', animation: 'pulseGlow 1s ease infinite' }} />
            <span style={{ fontSize: 11, color: '#22C55E', fontFamily: 'JetBrains Mono', fontWeight: 600 }}>RUNNING · Scan: {TICK_MS / 10}ms</span>
          </div>
        )}

        <div style={{ position: 'absolute', right: 12, top: running ? 40 : 12, display: 'flex', flexDirection: 'column', gap: 6, zIndex: 20 }}>
          <button className="ge-btn" onClick={() => setZoom(z => Math.min(z + 0.1, 1.5))} style={zoomBtnStyle(isDark)}>+</button>
          <button className="ge-btn" onClick={() => setZoom(z => Math.max(z - 0.1, 0.6))} style={zoomBtnStyle(isDark)}>−</button>
        </div>

        {/* SINGLE horizontal scrollbar for the entire editor — every rung scrolls together, like CX-Programmer */}
        <div style={{ overflowX: 'auto', overflowY: 'hidden' }}>
        <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top left', width: 'max-content' }}>
          {rungs.map((rung, ri) => {
            const cols = rung.cols
            const validity = validateRung(rung)
            const isActive = validity.valid && running && (powerMap[`${rung.id}-main-${cols}`] ?? false)
            const barColor = !validity.valid ? '#EF4444' : isActive ? '#22C55E' : railColor

            const totalRows = rung.rows.length
            const gridPxHeight = totalRows * CELL_H

            return (
              <div
                key={rung.id}
                onClick={() => setActiveRung(rung.id)}
                style={{
                  margin: '0 0 3px 0',
                  backgroundColor: activeRung === rung.id ? (isDark ? '#2D1A00' : '#FFF8EE') : rungBg,
                  borderLeft: !validity.valid ? '3px solid #EF4444' : isActive ? '3px solid #22C55E' : `3px solid ${activeRung === rung.id ? '#F59E0B' : 'transparent'}`,
                  position: 'relative',
                  transition: 'background-color 180ms ease, border-color 180ms ease',
                }}
              >
                {!validity.valid && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', backgroundColor: '#EF444418', borderBottom: '1px solid #EF444444' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.5"><path d="M12 9v4M12 17h.01M10.3 3.9L2.5 18a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    <span style={{ fontSize: 10, color: '#EF4444', fontFamily: 'JetBrains Mono', fontWeight: 700 }}>Rung {String(ri + 1).padStart(3, '0')} · Invalid — {validity.reason}</span>
                  </div>
                )}
                <div style={{ display: 'flex', padding: '2px 0', position: 'relative' }}>
                  <span style={{ width: 36, flexShrink: 0, textAlign: 'center', fontSize: 10, color: barColor, fontFamily: 'JetBrains Mono', fontWeight: 600, paddingTop: 4 }}>
                    {String(ri + 1).padStart(3, '0')}
                  </span>

                  <div style={{ width: 3, backgroundColor: barColor, flexShrink: 0, borderRadius: 2, transition: 'background-color 180ms ease' }} />

                  <div style={{ flex: '0 0 auto', overflow: 'visible' }}>
                    <div style={{
                      position: 'relative',
                      display: 'grid',
                      gridTemplateColumns: `repeat(${cols}, ${CELL_W}px)`,
                      gridTemplateRows: `repeat(${totalRows}, ${CELL_H}px)`,
                      width: cols * CELL_W,
                      height: gridPxHeight,
                    }}>
                      {/* every row is rendered the same way — the main rail (row 0) is not
                          structurally different from a branch lane, exactly as requested:
                          "Branch is simply the visual result of connected wires" */}
                      {rung.rows.map((row, r) => row.map((cell, c) => {
                        const isAnchor = !!branchAnchor && branchAnchor.rungId === rung.id && branchAnchor.row === r && branchAnchor.col === c
                        return (
                          <div
                            key={`r${r}-c${c}`}
                            onClick={e => { e.stopPropagation(); handleCellTap(rung.id, r, c) }}
                            onDoubleClick={e => { e.stopPropagation(); handleCellDoubleTap(rung.id, r, c) }}
                            style={{
                              gridColumn: c + 1, gridRow: r + 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                              cursor: 'pointer', boxSizing: 'border-box', borderRight: `1px solid ${gridLine}`, borderBottom: `1px solid ${gridLine}`,
                              backgroundColor: r > 0 ? (isDark ? '#20202088' : '#F7F7F788') : undefined,
                              boxShadow: isAnchor ? 'inset 0 0 0 2px #F59E0B' : undefined,
                            }}
                          >
                            <CellSVG cell={cell} isActive={running && !!powerMap[`${rung.id}-r${r}-${c}`]} conducts={running && !!powerMap[`${rung.id}-r${r}-${c}-out`]} isDark={isDark} error={validity.badCells.has(`${r}-${c}`)} />
                          </div>
                        )
                      }))}

                      {/* junctions — vertical wire between whichever two rows are linked,
                          drawn precisely at each link's own column. This IS the branch
                          system: no group object, just the wiring graph. */}
                      {rung.links.map((l, li) => {
                        const topRow = Math.min(l.rowA, l.rowB)
                        const botRow = Math.max(l.rowA, l.rowB)
                        const top = topRow * CELL_H + CELL_H / 2
                        const height = (botRow - topRow) * CELL_H
                        const linkOn = validity.valid && running && !!powerMap[`${rung.id}-r${l.rowA}-${l.col}`]
                        const tieColor = !validity.valid ? '#EF4444' : linkOn ? '#22C55E' : railColor
                        // Just-placed junctions get a brief "locked in" glow so the tap
                        // registers as a deliberate, snapped placement — display only,
                        // does not affect l.col/l.rowA/l.rowB or the wiring graph itself.
                        const justPlaced = !!snapFlash && snapFlash.rungId === rung.id && snapFlash.col === l.col &&
                          ((snapFlash.rowA === l.rowA && snapFlash.rowB === l.rowB) || (snapFlash.rowA === l.rowB && snapFlash.rowB === l.rowA))
                        return (
                          <div key={`link-${li}`} onClick={e => { e.stopPropagation(); linkRows(rung.id, l.rowA, l.rowB, l.col) }} title="Tap to remove this junction" style={{ cursor: 'pointer' }}>
                            <div style={{
                              position: 'absolute', left: l.col * CELL_W - 1, top, width: 2, height, backgroundColor: tieColor, zIndex: 2,
                              boxShadow: justPlaced ? `0 0 0 3px ${tieColor}33` : undefined,
                            }} />
                            <div style={{
                              position: 'absolute', left: l.col * CELL_W - (justPlaced ? 6 : 4), top: topRow * CELL_H + CELL_H / 2 - (justPlaced ? 6 : 4),
                              width: justPlaced ? 12 : 8, height: justPlaced ? 12 : 8, borderRadius: '50%', backgroundColor: tieColor, zIndex: 3,
                              boxShadow: justPlaced ? `0 0 0 4px ${tieColor}33` : undefined, transition: 'width 200ms ease, height 200ms ease',
                            }} />
                            <div style={{
                              position: 'absolute', left: l.col * CELL_W - (justPlaced ? 6 : 4), top: botRow * CELL_H + CELL_H / 2 - (justPlaced ? 6 : 4),
                              width: justPlaced ? 12 : 8, height: justPlaced ? 12 : 8, borderRadius: '50%', backgroundColor: tieColor, zIndex: 3,
                              boxShadow: justPlaced ? `0 0 0 4px ${tieColor}33` : undefined, transition: 'width 200ms ease, height 200ms ease',
                            }} />
                          </div>
                        )
                      })}

                      {/* BRANCH snap-guide — shown only while an anchor is armed for this rung.
                          The junction's column is fixed the moment the first wire is tapped
                          (see handleCellTap), so this draws that locked column as a dashed
                          guide plus a snap-dot on every row: the user sees exactly where the
                          wire will land and only needs to pick a ROW, never hunt for a pixel. */}
                      {branchAnchor && branchAnchor.rungId === rung.id && (
                        <>
                          <div style={{
                            position: 'absolute',
                            left: branchAnchor.col * CELL_W - 1,
                            top: 0,
                            width: 2,
                            height: gridPxHeight,
                            backgroundImage: `repeating-linear-gradient(to bottom, #F59E0B 0, #F59E0B 5px, transparent 5px, transparent 10px)`,
                            zIndex: 1,
                            pointerEvents: 'none',
                          }} />
                          {rung.rows.map((_, r) => {
                            const isAnchorRow = r === branchAnchor.row
                            return (
                              <div
                                key={`snap-guide-${r}`}
                                style={{
                                  position: 'absolute',
                                  left: branchAnchor.col * CELL_W - (isAnchorRow ? 5 : 4),
                                  top: r * CELL_H + CELL_H / 2 - (isAnchorRow ? 5 : 4),
                                  width: isAnchorRow ? 10 : 8,
                                  height: isAnchorRow ? 10 : 8,
                                  borderRadius: '50%',
                                  border: '2px solid #F59E0B',
                                  backgroundColor: isAnchorRow ? '#F59E0B' : (isDark ? '#1C1C1C' : '#FFFFFF'),
                                  zIndex: 4,
                                  pointerEvents: 'none',
                                  animation: isAnchorRow ? undefined : 'pulseGlow 1.1s ease-in-out infinite',
                                }}
                              />
                            )
                          })}
                        </>
                      )}
                    </div>

                    {/* Lanes & junctions — plain-language control chips over the wiring graph */}
                    {(rung.rows.length > 1 || rung.links.length > 0) && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '2px 0 4px' }}>
                        {rung.rows.length > 1 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, backgroundColor: isDark ? '#2A2A2A' : '#F0F0F0', borderRadius: 8, padding: '3px 6px' }}>
                            <span style={{ fontSize: 9, color: muted, fontFamily: 'JetBrains Mono' }}>{rung.rows.length - 1} lane(s)</span>
                            <button onClick={e => { e.stopPropagation(); removeLastLane(rung.id) }} title="Delete the last (bottom) lane" style={{ ...miniBtnStyle(isDark), color: '#EF4444', borderColor: '#EF444455' }}>−lane</button>
                          </div>
                        )}
                        {rung.links.map((l, li) => (
                          <div key={`lk-${li}`} style={{ display: 'flex', alignItems: 'center', gap: 4, backgroundColor: isDark ? '#2A2A2A' : '#F0F0F0', borderRadius: 8, padding: '3px 6px' }}>
                            <span style={{ fontSize: 9, color: muted, fontFamily: 'JetBrains Mono' }}>⏚ {l.rowA === 0 ? 'Main' : `L${l.rowA}`}–{l.rowB === 0 ? 'Main' : `L${l.rowB}`} @{l.col}</span>
                            <button onClick={e => { e.stopPropagation(); linkRows(rung.id, l.rowA, l.rowB, l.col) }} title="Remove this junction" style={{ ...miniBtnStyle(isDark), color: '#EF4444', borderColor: '#EF444455' }}>×</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div style={{ width: 3, backgroundColor: barColor, flexShrink: 0, borderRadius: 2, transition: 'background-color 180ms ease' }} />

                  {/* ── + − : column length control, right where the wire ends — never below the rung */}
                  <div style={{ flexShrink: 0, height: CELL_H, display: 'flex', alignItems: 'center', gap: 4, paddingLeft: 8 }}>
                    <button onClick={e => { e.stopPropagation(); removeColumn(rung.id) }} title="Remove last column" style={colBtnStyle(isDark)}>−</button>
                    <button onClick={e => { e.stopPropagation(); addColumn(rung.id) }} title="Add a column" style={colBtnStyle(isDark)}>+</button>
                    <span style={{ fontSize: 9, color: muted, fontFamily: 'JetBrains Mono' }}>{cols}c</span>
                  </div>
                </div>

                {activeRung === rung.id && (
                  <div style={{ padding: '2px 40px', borderTop: `1px solid ${border}` }}>
                    <input
                      placeholder="// rung comment"
                      value={rung.comment}
                      onClick={e => e.stopPropagation()}
                      onChange={e => { recordHistory(); setRungs(prev => prev.map(r => r.id === rung.id ? { ...r, comment: e.target.value } : r)) }}
                      style={{ width: '100%', fontSize: 11, fontFamily: 'JetBrains Mono', color: muted, border: 'none', backgroundColor: 'transparent', outline: 'none', padding: '2px 0' }}
                    />
                  </div>
                )}
              </div>
            )
          })}

          <div style={{ padding: '8px 40px', display: 'flex', alignItems: 'center', gap: 8, width: Math.max(...rungs.map(r => r.cols), DEFAULT_COLS) * CELL_W + 80 }}>
            <div style={{ flex: 1, height: 1, backgroundColor: border }} />
            <span style={{ fontSize: 11, color: muted, fontFamily: 'JetBrains Mono' }}>END</span>
            <div style={{ flex: 1, height: 1, backgroundColor: border }} />
          </div>
        </div>
        </div>

        {toast && (
          <div style={{
            position: 'fixed', bottom: 100, left: '50%', transform: 'translateX(-50%)', backgroundColor: '#EF4444', color: '#fff',
            padding: '8px 16px', borderRadius: 10, fontSize: 12, fontFamily: 'Inter', fontWeight: 600, zIndex: 200,
            boxShadow: '0 4px 14px rgba(0,0,0,0.3)', maxWidth: '85vw', textAlign: 'center',
          }}>{toast}</div>
        )}

        {/* === RUN-mode floating simulation panels === */}
        {running && (
          <div style={{ position: 'sticky', bottom: 8, left: 0, padding: '0 12px', display: 'flex', flexDirection: 'column', gap: 8, zIndex: 30 }}>
            {usedInputAddrs.length === 0 && (
              <FloatingPanel title="INPUT SIMULATION" isDark={isDark} border={border}>
                <span style={{ fontSize: 11, color: muted, fontFamily: 'JetBrains Mono' }}>No Input contacts (I..) on the ladder yet</span>
              </FloatingPanel>
            )}
            {usedInputAddrs.length > 0 && (
              <FloatingPanel title="INPUT SIMULATION" isDark={isDark} border={border}>
                {usedInputAddrs.map(addr => (
                  <button
                    key={addr}
                    className="ge-btn"
                    onClick={() => toggleInput(addr)}
                    title={`Toggle ${addr} ON/OFF`}
                    style={{
                      width: 44, height: 36, borderRadius: 8, border: `1.5px solid ${inputs[addr] ? '#22C55E' : border}`,
                      backgroundColor: inputs[addr] ? '#22C55E22' : isDark ? '#2A2A2A' : '#F7F7F7',
                      color: inputs[addr] ? '#22C55E' : muted, fontFamily: 'JetBrains Mono', fontWeight: 700, fontSize: 12, cursor: 'pointer',
                    }}
                  >{addr}</button>
                ))}
              </FloatingPanel>
            )}

            {(usedOutputAddrs.length > 0 || usedMemoryAddrs.length > 0) && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {usedOutputAddrs.length > 0 && (
                  <FloatingPanel title="OUTPUT" isDark={isDark} border={border}>
                    {usedOutputAddrs.map(addr => (
                      <LedTag key={addr} label={addr} on={!!memory[addr]} isDark={isDark} border={border} />
                    ))}
                  </FloatingPanel>
                )}
                {usedMemoryAddrs.length > 0 && (
                  <FloatingPanel title="MEMORY" isDark={isDark} border={border}>
                    {usedMemoryAddrs.map(addr => (
                      <LedTag key={addr} label={addr} on={!!memory[addr]} isDark={isDark} border={border} color="#7C3AED" />
                    ))}
                  </FloatingPanel>
                )}
              </div>
            )}

            {(timerAddrs.length > 0 || counterAddrs.length > 0) && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {timerAddrs.length > 0 && (
                  <FloatingPanel title="TIMER" isDark={isDark} border={border}>
                    {timerAddrs.map(addr => {
                      const t = timers[addr]
                      return (
                        <div key={addr} style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: t?.done ? '#22C55E' : '#D97706', padding: '2px 8px', borderRadius: 6, border: `1px solid ${t?.done ? '#22C55E' : '#D9770655'}` }}>
                          {addr} ACC:{t?.acc ?? 0} DONE:{t?.done ? '1' : '0'}
                        </div>
                      )
                    })}
                  </FloatingPanel>
                )}
                {counterAddrs.length > 0 && (
                  <FloatingPanel title="COUNTER" isDark={isDark} border={border}>
                    {counterAddrs.map(addr => {
                      const c = counters[addr]
                      return (
                        <div key={addr} style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: c?.done ? '#22C55E' : '#2563EB', padding: '2px 8px', borderRadius: 6, border: `1px solid ${c?.done ? '#22C55E' : '#2563EB55'}` }}>
                          {addr} CV:{c?.cv ?? 0} DONE:{c?.done ? '1' : '0'}
                        </div>
                      )
                    })}
                  </FloatingPanel>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* === BOTTOM STATUS PANEL === */}
      <div style={{ backgroundColor: isDark ? '#222' : '#FFFFFF', borderTop: `1px solid ${border}`, flexShrink: 0, transition: 'height 200ms ease' }}>
        <button
          onClick={() => setBottomPanelOpen(o => !o)}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: running ? '#22C55E' : '#9E9E9E' }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: text, fontFamily: 'JetBrains Mono' }}>PLC STATUS · {running ? 'RUN' : 'STOP'}</span>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={muted} strokeWidth="2">
            <path d={bottomPanelOpen ? 'M18 15l-6-6-6 6' : 'M6 9l6 6 6-6'} strokeLinecap="round" />
          </svg>
        </button>

        {bottomPanelOpen && (
          <div style={{ padding: '4px 16px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, overflowY: 'auto', maxHeight: 220 }}>
            {[
              {
                label: 'I/O',
                // Show every used input address, not just the first one, so
                // e.g. I1 and I26 both appear when both are used on the ladder.
                entries: usedInputAddrs.map(addr => ({
                  text: `${addr}:${inputs[addr] ? 'ON' : 'OFF'}`,
                  color: inputs[addr] ? '#22C55E' : muted,
                })),
              },
              {
                label: 'OUTPUT',
                // Same fix for outputs: list every used output address (e.g. O2 and O24).
                entries: usedOutputAddrs.map(addr => ({
                  text: `${addr}:${memory[addr] ? 'ON' : 'OFF'}`,
                  color: memory[addr] ? '#22C55E' : muted,
                })),
              },
              {
                label: 'TIMER',
                entries: timerAddrs.map(addr => ({
                  text: `${addr}:${timers[addr]?.acc ?? 0}`,
                  color: '#D97706',
                })),
              },
              {
                label: 'COUNTER',
                entries: counterAddrs.map(addr => ({
                  text: `${addr}:${counters[addr]?.cv ?? 0}`,
                  color: '#2563EB',
                })),
              },
              {
                label: 'MEMORY',
                entries: usedMemoryAddrs.map(addr => ({
                  text: `${addr}:${memory[addr] ? '1' : '0'}`,
                  color: muted,
                })),
              },
              {
                label: 'SCAN',
                entries: [{ text: running ? `${TICK_MS / 10}ms` : '--', color: running ? '#22C55E' : muted }],
              },
            ].map((item, i) => (
              <div key={i} style={{ backgroundColor: isDark ? '#2D2D2D' : '#F7F7F7', borderRadius: 8, padding: '6px 10px', border: `1px solid ${border}` }}>
                <p style={{ margin: 0, fontSize: 9, color: muted, fontFamily: 'JetBrains Mono', letterSpacing: 0.5 }}>{item.label}</p>
                {item.entries.length === 0 ? (
                  <p style={{ margin: '2px 0 0', fontSize: 12, fontWeight: 700, color: muted, fontFamily: 'JetBrains Mono' }}>--</p>
                ) : (
                  item.entries.map((entry, j) => (
                    <p key={j} style={{ margin: '2px 0 0', fontSize: 12, fontWeight: 700, color: entry.color, fontFamily: 'JetBrains Mono' }}>{entry.text}</p>
                  ))
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* === FAB speed-dial === */}
      <div style={{ position: 'fixed', bottom: bottomPanelOpen ? 180 : 72, right: 16, zIndex: 50, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10, transition: 'bottom 200ms ease' }}>
        {fabOpen && (
          <>
            <FabMiniButton className="ge-fab-item" label="Delete Rung" color="#EF4444" onClick={deleteRungFab} isDark={isDark}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2"><path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </FabMiniButton>
            <FabMiniButton className="ge-fab-item" label="Duplicate Rung" color="#2563EB" onClick={duplicateRung} isDark={isDark}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2"><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M4 16V5a1 1 0 0 1 1-1h11" /></svg>
            </FabMiniButton>
            <FabMiniButton className="ge-fab-item" label="Insert Branch" color="#6B7280" onClick={insertBranchFab} isDark={isDark}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2"><line x1="2" y1="12" x2="9" y2="12" /><line x1="9" y1="6" x2="9" y2="18" /><line x1="9" y1="6" x2="22" y2="6" /><line x1="9" y1="18" x2="22" y2="18" /></svg>
            </FabMiniButton>
            <FabMiniButton className="ge-fab-item" label="Add Rung" color="#F59E0B" onClick={addRung} isDark={isDark}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" strokeLinecap="round" /><line x1="5" y1="12" x2="19" y2="12" strokeLinecap="round" /></svg>
            </FabMiniButton>
          </>
        )}
        <button
          onClick={() => setFabOpen(o => !o)}
          className="ge-btn"
          style={{
            width: 52, height: 52, borderRadius: 16, backgroundColor: '#F59E0B', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(245,158,11,0.45)',
            transform: fabOpen ? 'rotate(45deg)' : 'rotate(0deg)',
          }}
          title="Rung actions"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" strokeLinecap="round" />
            <line x1="5" y1="12" x2="19" y2="12" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* === DIALOGS === */}
      {canClose && (
        <div
          onClick={closeDialog}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 80, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
        >
          <div onClick={e => e.stopPropagation()} className="animate-slide-up">
            {dialog.type === 'component' && (
              <ComponentSelectionSheet isDark={isDark} onSelect={handleSelectComponent} onClose={closeDialog} />
            )}
            {dialog.type === 'address' && (
              <AddressSelectionSheet
                isDark={isDark}
                componentType={dialog.pendingType ?? null}
                initialAddress={dialog.initialAddress}
                editing={!!dialog.editing}
                timerAddrs={allTimerAddrs}
                counterAddrs={allCounterAddrs}
                onSelect={handleSelectAddress}
                onDelete={dialog.editing ? handleDialogDelete : undefined}
                onClose={closeDialog}
              />
            )}
            {dialog.type === 'timer' && (
              <TimerConfigSheet
                isDark={isDark}
                timerType={dialog.pendingType as 'TON' | 'TOF' | 'TP'}
                initialPreset={dialog.initialPreset}
                initialUnit={dialog.initialUnit}
                editing={!!dialog.editing}
                onConfirm={handleTimerConfig}
                onDelete={dialog.editing ? handleDialogDelete : undefined}
                onClose={closeDialog}
              />
            )}
            {dialog.type === 'counter' && (
              <CounterConfigSheet
                isDark={isDark}
                counterType={dialog.pendingType as 'CTU' | 'CTD'}
                initialPreset={dialog.initialPreset}
                editing={!!dialog.editing}
                onConfirm={handleCounterConfig}
                onDelete={dialog.editing ? handleDialogDelete : undefined}
                onClose={closeDialog}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function FloatingPanel({ title, isDark, border, children }: { title: string; isDark: boolean; border: string; children: React.ReactNode }) {
  return (
    <div style={{
      backgroundColor: isDark ? '#242424EE' : '#FFFFFFEE', backdropFilter: 'blur(6px)', borderRadius: 12,
      border: `1px solid ${border}`, padding: '8px 10px', boxShadow: '0 4px 14px rgba(0,0,0,0.15)', flex: 1, minWidth: 160,
    }}>
      <p style={{ margin: '0 0 6px', fontSize: 9, letterSpacing: 0.5, color: isDark ? '#9E9E9E' : '#757575', fontFamily: 'JetBrains Mono', fontWeight: 700 }}>{title}</p>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{children}</div>
    </div>
  )
}

function LedTag({ label, on, isDark, border, color = '#22C55E' }: { label: string; on: boolean; isDark: boolean; border: string; color?: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 5, padding: '4px 8px', borderRadius: 8,
      border: `1px solid ${on ? color : border}`, backgroundColor: on ? color + '22' : isDark ? '#2A2A2A' : '#F7F7F7',
      transition: 'all 180ms ease',
    }}>
      <div style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: on ? color : isDark ? '#555' : '#CCC' }} />
      <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono', fontWeight: 700, color: on ? color : isDark ? '#9E9E9E' : '#757575' }}>{label}</span>
    </div>
  )
}

function FabMiniButton({ label, color, onClick, isDark, children }: { label: string; color: string; onClick: () => void; isDark: boolean; children: React.ReactNode; className?: string }) {
  return (
    <button onClick={onClick} className="ge-fab-item" style={{
      display: 'flex', alignItems: 'center', gap: 8, backgroundColor: isDark ? '#2A2A2A' : '#FFFFFF',
      border: `1px solid ${color}44`, borderRadius: 12, padding: '8px 14px', cursor: 'pointer',
      boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
    }}>
      {children}
      <span style={{ fontSize: 12, fontWeight: 600, fontFamily: 'Inter', color: isDark ? '#F5F5F5' : '#1C1C1C', whiteSpace: 'nowrap' }}>{label}</span>
    </button>
  )
}

function iconBtnStyle(_isDark: boolean) {
  return {
    width: 40, height: 40, borderRadius: 10, border: 'none', backgroundColor: 'transparent',
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
  } as React.CSSProperties
}

function zoomBtnStyle(isDark: boolean) {
  return {
    width: 32, height: 32, borderRadius: 8, border: `1px solid ${isDark ? '#404040' : '#E0E0E0'}`,
    backgroundColor: isDark ? '#2A2A2A' : '#FFFFFF', color: isDark ? '#F5F5F5' : '#1C1C1C',
    fontSize: 18, fontWeight: 300, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
  } as React.CSSProperties
}

function miniBtnStyle(isDark: boolean) {
  return {
    border: `1px solid ${isDark ? '#404040' : '#E0E0E0'}`, backgroundColor: isDark ? '#333' : '#FFFFFF',
    color: isDark ? '#F5F5F5' : '#1C1C1C', borderRadius: 6, fontSize: 10, fontFamily: 'JetBrains Mono',
    fontWeight: 600, cursor: 'pointer', padding: '2px 6px', lineHeight: '14px',
  } as React.CSSProperties
}

function colBtnStyle(isDark: boolean) {
  return {
    width: 20, height: 20, borderRadius: 6, border: `1px solid ${isDark ? '#404040' : '#E0E0E0'}`,
    backgroundColor: isDark ? '#333' : '#FFFFFF', color: isDark ? '#F5F5F5' : '#1C1C1C',
    fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 0, lineHeight: 1,
  } as React.CSSProperties
}

// ===========================
// Component Selection Sheet
// ===========================
const COMPONENTS = [
  { type: 'NO' as CellType, label: 'Normal Open', short: 'NO', color: '#2563EB' },
  { type: 'NC' as CellType, label: 'Normal Closed', short: 'NC', color: '#7C3AED' },
  { type: 'COIL' as CellType, label: 'Output Coil', short: '( )', color: '#059669' },
  { type: 'SET' as CellType, label: 'SET Coil', short: 'S', color: '#059669' },
  { type: 'RST' as CellType, label: 'RESET Coil', short: 'R', color: '#DC2626' },
  { type: 'TON' as CellType, label: 'Timer ON', short: 'TON', color: '#D97706' },
  { type: 'TOF' as CellType, label: 'Timer OFF', short: 'TOF', color: '#D97706' },
  { type: 'TP' as CellType, label: 'Pulse Timer', short: 'TP', color: '#D97706' },
  { type: 'CTU' as CellType, label: 'Count Up', short: 'CTU', color: '#0891B2' },
  { type: 'CTD' as CellType, label: 'Count Down', short: 'CTD', color: '#0891B2' },
  { type: 'RES' as CellType, label: 'Reset', short: 'RES', color: '#DC2626' },
  { type: 'MEM' as CellType, label: 'Memory Bit', short: 'M', color: '#7C3AED' },
  { type: 'WIRE' as CellType, label: 'Wire', short: '—', color: '#6B7280' },
]

function ComponentSelectionSheet({ isDark, onSelect, onClose }: {
  isDark: boolean
  onSelect: (type: CellType) => void
  onClose: () => void
}) {
  const card = isDark ? '#2A2A2A' : '#FFFFFF'
  const text = isDark ? '#F5F5F5' : '#1C1C1C'
  const border = isDark ? '#404040' : '#E0E0E0'

  return (
    <div style={{ width: '100vw', maxWidth: 430, backgroundColor: card, borderRadius: '20px 20px 0 0', padding: '0 16px 32px', maxHeight: '75vh', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 8px' }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: border }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, padding: '0 4px' }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: text, fontFamily: 'Inter' }}>Insert Component</h3>
        <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#757575', fontSize: 20, padding: 4 }}>✕</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {COMPONENTS.map(comp => (
          <button
            key={comp.type}
            onClick={() => onSelect(comp.type)}
            style={{
              borderRadius: 14, border: `1.5px solid ${comp.color}22`, backgroundColor: comp.color + '11', padding: '14px 8px',
              cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minHeight: 80,
            }}
          >
            <span style={{ fontSize: 16, fontWeight: 700, color: comp.color, fontFamily: 'JetBrains Mono' }}>{comp.short}</span>
            <span style={{ fontSize: 10, color: text, fontFamily: 'Inter', textAlign: 'center', lineHeight: 1.3 }}>{comp.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ===========================
// Address Selection Sheet
// ===========================
type AddrTab = 'I' | 'Q' | 'M' | 'T' | 'C'
const TAB_LABEL: Record<AddrTab, string> = { I: 'Input', Q: 'Output', M: 'Memory', T: 'Timer Bit', C: 'Counter Bit' }
// Omron-style address prefixes — I1-I26, Q1-Q26, M1-M26, TIM1-TIM26, CTU1-CTU26.
// TIM/CTU are the actual stored address prefixes (not the internal tab key).
const ADDR_PREFIX: Record<AddrTab, string> = { I: 'I', Q: 'Q', M: 'M', T: 'TIM', C: 'CTU' }

function AddressSelectionSheet({ isDark, componentType, initialAddress, editing, timerAddrs = [], counterAddrs = [], onSelect, onDelete, onClose }: {
  isDark: boolean
  componentType: CellType | null
  initialAddress?: string
  editing?: boolean
  timerAddrs?: string[]
  counterAddrs?: string[]
  onSelect: (address: string) => void
  onDelete?: () => void
  onClose: () => void
}) {
  const isContact = componentType === 'NO' || componentType === 'NC'
  const isOutput = componentType === 'COIL' || componentType === 'SET' || componentType === 'RST'
  const isTimerBlock = componentType === 'TON' || componentType === 'TOF' || componentType === 'TP'
  const isCounterBlock = componentType === 'CTU' || componentType === 'CTD'
  // A real PLC contact can read almost any bit — Input, Output, Memory, or a Timer/Counter DONE bit.
  // A coil may only ever WRITE to Output or Memory. A Timer/Counter INSTRUCTION block gets its own,
  // freely-chosen TIM/CTU address — separate from any contact that later reads its done bit.
  const availableTabs: AddrTab[] = isContact ? ['I', 'Q', 'M', 'T', 'C'] : isOutput ? ['Q', 'M'] : isTimerBlock ? ['T'] : isCounterBlock ? ['C'] : ['M']
  const [tab, setTab] = useState<AddrTab>(isOutput ? 'Q' : isContact ? 'I' : isTimerBlock ? 'T' : isCounterBlock ? 'C' : 'M')
  const [search, setSearch] = useState('')
  const card = isDark ? '#2A2A2A' : '#FFFFFF'
  const text = isDark ? '#F5F5F5' : '#1C1C1C'
  const muted = isDark ? '#9E9E9E' : '#757575'
  const border = isDark ? '#404040' : '#E0E0E0'
  const bg = isDark ? '#333' : '#F7F7F7'

  const prefix = ADDR_PREFIX[tab]
  // Contacts reading a T/C bit only ever see addresses that already exist on the ladder.
  // A timer/counter INSTRUCTION itself gets the full TIM1-26 / CTU1-26 numbering to pick from.
  const isDoneBitTab = (tab === 'T' || tab === 'C') && isContact
  const placedAddrs = tab === 'T' ? timerAddrs : counterAddrs
  const addresses = isDoneBitTab ? placedAddrs : Array.from({ length: 26 }, (_, i) => `${prefix}${i + 1}`)
  const filtered = addresses.filter(a => a.toLowerCase().includes(search.toLowerCase()))
  const recent = isDoneBitTab ? placedAddrs.slice(0, 3) : [`${prefix}1`, `${prefix}2`, `${prefix}3`]

  return (
    <div style={{ width: '100vw', maxWidth: 430, backgroundColor: card, borderRadius: '20px 20px 0 0', padding: '0 16px 32px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 8px', flexShrink: 0 }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: border }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexShrink: 0 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: text, fontFamily: 'Inter' }}>{editing ? 'Edit Address' : 'Select Address'}{initialAddress ? ` · ${initialAddress}` : ''}</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {editing && onDelete && (
            <button onClick={onDelete} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#EF4444', fontSize: 12, fontWeight: 700, fontFamily: 'Inter' }}>Delete</button>
          )}
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#757575', fontSize: 20, padding: 4 }}>✕</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexShrink: 0 }}>
        {availableTabs.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1, height: 36, borderRadius: 10, border: 'none',
              backgroundColor: tab === t ? '#F59E0B' : (isDark ? '#333' : '#F0F0F0'),
              color: tab === t ? '#1C1C1C' : muted, fontFamily: 'JetBrains Mono', fontWeight: 600, fontSize: 13, cursor: 'pointer',
            }}
          >
            {TAB_LABEL[t]}
          </button>
        ))}
      </div>

      {!isDoneBitTab && (
        <div style={{ position: 'relative', marginBottom: 12, flexShrink: 0 }}>
          <input
            placeholder={`Search ${prefix}...`}
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', height: 40, borderRadius: 10, border: `1px solid ${border}`, backgroundColor: bg, padding: '0 12px', fontSize: 14, fontFamily: 'JetBrains Mono', color: text, outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
      )}

      {!search && !isDoneBitTab && (
        <div style={{ marginBottom: 10, flexShrink: 0 }}>
          <p style={{ margin: '0 0 6px', fontSize: 11, color: muted, fontFamily: 'Inter' }}>RECENT</p>
          <div style={{ display: 'flex', gap: 8 }}>
            {recent.map(addr => (
              <button key={addr} onClick={() => onSelect(addr)} style={{ height: 36, borderRadius: 10, border: `1px solid #F59E0B44`, backgroundColor: isDark ? '#2D1A00' : '#FFF8EE', color: '#F59E0B', fontFamily: 'JetBrains Mono', fontWeight: 600, fontSize: 13, padding: '0 14px', cursor: 'pointer' }}>{addr}</button>
            ))}
          </div>
        </div>
      )}

      {isDoneBitTab && filtered.length === 0 && (
        <div style={{ padding: '20px 8px', textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: 12, color: muted, fontFamily: 'Inter' }}>
            No {tab === 'T' ? 'timer' : 'counter'} has been placed on the ladder yet.<br />Place a {tab === 'T' ? 'TON / TOF / TP' : 'CTU / CTD'} block first, then its DONE bit will show up here.
          </p>
        </div>
      )}

      <div style={{ overflowY: 'auto', flex: 1 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
          {filtered.map(addr => (
            <button
              key={addr}
              onClick={() => onSelect(addr)}
              style={{
                height: 44, borderRadius: 10, border: `1px solid ${addr === initialAddress ? '#F59E0B' : border}`,
                backgroundColor: addr === initialAddress ? '#F59E0B22' : isDark ? '#333' : '#F7F7F7',
                color: text, fontFamily: 'JetBrains Mono', fontWeight: 500, fontSize: 13, cursor: 'pointer', transition: 'all 150ms ease',
              }}
            >{addr}</button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ===========================
// Timer Config Sheet
// ===========================
function TimerConfigSheet({ isDark, timerType, initialPreset, initialUnit, editing, onConfirm, onDelete, onClose }: {
  isDark: boolean
  timerType: 'TON' | 'TOF' | 'TP'
  initialPreset?: number
  initialUnit?: string
  editing?: boolean
  onConfirm: (preset: number, unit: string) => void
  onDelete?: () => void
  onClose: () => void
}) {
  const [preset, setPreset] = useState(initialPreset ?? 1000)
  const [unit, setUnit] = useState(initialUnit ?? 'ms')
  const card = isDark ? '#2A2A2A' : '#FFFFFF'
  const text = isDark ? '#F5F5F5' : '#1C1C1C'
  const muted = isDark ? '#9E9E9E' : '#757575'
  const border = isDark ? '#404040' : '#E0E0E0'
  const inputBg = isDark ? '#333' : '#F7F7F7'

  const timerNames = { TON: 'Timer ON-Delay', TOF: 'Timer OFF-Delay', TP: 'Pulse Timer' }

  return (
    <div style={{ width: '100vw', maxWidth: 430, backgroundColor: card, borderRadius: '20px 20px 0 0', padding: '0 20px 40px' }}>
      <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 8px' }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: border }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: '#D9770622', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#D97706', fontFamily: 'JetBrains Mono' }}>{timerType}</span>
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: text, fontFamily: 'Inter' }}>{editing ? 'Edit Timer' : 'Timer Configuration'}</h3>
            <p style={{ margin: 0, fontSize: 12, color: muted, fontFamily: 'Inter' }}>{timerNames[timerType]}</p>
          </div>
        </div>
        {editing && onDelete && (
          <button onClick={onDelete} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#EF4444', fontSize: 12, fontWeight: 700, fontFamily: 'Inter' }}>Delete</button>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={{ fontSize: 13, fontWeight: 500, color: text, fontFamily: 'Inter', display: 'block', marginBottom: 6 }}>Preset Time</label>
          <input
            type="number"
            value={preset}
            onChange={e => setPreset(Number(e.target.value))}
            style={{ width: '100%', height: 52, borderRadius: 12, border: `1.5px solid ${border}`, backgroundColor: inputBg, padding: '0 16px', fontSize: 20, fontFamily: 'JetBrains Mono', fontWeight: 600, color: '#D97706', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
        <div>
          <label style={{ fontSize: 13, fontWeight: 500, color: text, fontFamily: 'Inter', display: 'block', marginBottom: 6 }}>Time Unit</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {['ms', 's', 'min'].map(u => (
              <button key={u} onClick={() => setUnit(u)} style={{ flex: 1, height: 44, borderRadius: 10, border: `1.5px solid ${unit === u ? '#D97706' : border}`, backgroundColor: unit === u ? '#D9770622' : inputBg, color: unit === u ? '#D97706' : muted, fontFamily: 'JetBrains Mono', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>{u}</button>
            ))}
          </div>
        </div>

        <div style={{ backgroundColor: isDark ? '#2D1A00' : '#FFF8EE', borderRadius: 10, padding: '12px 14px', border: `1px solid #D9770633` }}>
          <p style={{ margin: 0, fontSize: 11, color: muted, fontFamily: 'Inter' }}>Preview</p>
          <p style={{ margin: '4px 0 0', fontSize: 16, fontWeight: 700, color: '#D97706', fontFamily: 'JetBrains Mono' }}>{timerType}: PT={preset}{unit}</p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, height: 52, borderRadius: 12, border: `1.5px solid ${border}`, backgroundColor: 'transparent', color: muted, fontSize: 15, fontWeight: 500, fontFamily: 'Inter', cursor: 'pointer' }}>Cancel</button>
          <button onClick={() => onConfirm(preset, unit)} style={{ flex: 2, height: 52, borderRadius: 12, backgroundColor: '#F59E0B', border: 'none', color: '#1C1C1C', fontSize: 15, fontWeight: 700, fontFamily: 'Inter', cursor: 'pointer' }}>Confirm</button>
        </div>
      </div>
    </div>
  )
}

// ===========================
// Counter Config Sheet
// ===========================
function CounterConfigSheet({ isDark, counterType, initialPreset, editing, onConfirm, onDelete, onClose }: {
  isDark: boolean
  counterType: 'CTU' | 'CTD'
  initialPreset?: number
  editing?: boolean
  onConfirm: (preset: number) => void
  onDelete?: () => void
  onClose: () => void
}) {
  const [preset, setPreset] = useState(initialPreset ?? 10)
  const card = isDark ? '#2A2A2A' : '#FFFFFF'
  const text = isDark ? '#F5F5F5' : '#1C1C1C'
  const muted = isDark ? '#9E9E9E' : '#757575'
  const border = isDark ? '#404040' : '#E0E0E0'
  const inputBg = isDark ? '#333' : '#F7F7F7'

  return (
    <div style={{ width: '100vw', maxWidth: 430, backgroundColor: card, borderRadius: '20px 20px 0 0', padding: '0 20px 40px' }}>
      <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 8px' }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: border }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: '#2563EB22', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#2563EB', fontFamily: 'JetBrains Mono' }}>{counterType}</span>
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: text, fontFamily: 'Inter' }}>{editing ? 'Edit Counter' : 'Counter Configuration'}</h3>
            <p style={{ margin: 0, fontSize: 12, color: muted, fontFamily: 'Inter' }}>{counterType === 'CTU' ? 'Count Up' : 'Count Down'} Counter</p>
          </div>
        </div>
        {editing && onDelete && (
          <button onClick={onDelete} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#EF4444', fontSize: 12, fontWeight: 700, fontFamily: 'Inter' }}>Delete</button>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={{ fontSize: 13, fontWeight: 500, color: text, fontFamily: 'Inter', display: 'block', marginBottom: 6 }}>Preset Count (PV)</label>
          <input
            type="number"
            value={preset}
            onChange={e => setPreset(Number(e.target.value))}
            style={{ width: '100%', height: 52, borderRadius: 12, border: `1.5px solid ${border}`, backgroundColor: inputBg, padding: '0 16px', fontSize: 20, fontFamily: 'JetBrains Mono', fontWeight: 600, color: '#2563EB', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ backgroundColor: isDark ? '#001A2D' : '#EFF6FF', borderRadius: 10, padding: '12px 14px', border: '1px solid #2563EB22' }}>
          <p style={{ margin: 0, fontSize: 11, color: muted, fontFamily: 'Inter' }}>Preview</p>
          <p style={{ margin: '4px 0 0', fontSize: 16, fontWeight: 700, color: '#2563EB', fontFamily: 'JetBrains Mono' }}>{counterType}: PV={preset} / CV=0</p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, height: 52, borderRadius: 12, border: `1.5px solid ${border}`, backgroundColor: 'transparent', color: muted, fontSize: 15, fontWeight: 500, fontFamily: 'Inter', cursor: 'pointer' }}>Cancel</button>
          <button onClick={() => onConfirm(preset)} style={{ flex: 2, height: 52, borderRadius: 12, backgroundColor: '#F59E0B', border: 'none', color: '#1C1C1C', fontSize: 15, fontWeight: 700, fontFamily: 'Inter', cursor: 'pointer' }}>Confirm</button>
        </div>
      </div>
    </div>
  )
}
