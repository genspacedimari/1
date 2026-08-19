import type {
  LadderProject, Rung, LadderElement, ContactElement, CoilElement,
  TimerElement, CounterElement, WireElement, Address,
} from '@/simulator/types/ladder';
import { generateId } from '@/simulator/utils/id';

// ─── The real Simulator's own grid format ───────────────────────────────
// This is a structural mirror of the private types inside
// SimulatorEditorScreen.tsx (rows/links grid model). It is NOT the same
// shape as LadderProject (rungs/elements graph model) — see
// importFromGridJson() below for why the two need a converter at all.
type GridCellType = 'WIRE' | 'NO' | 'NC' | 'COIL' | 'SET' | 'RST' | 'TON' | 'TOF' | 'TP' | 'CTU' | 'CTD' | 'RES' | 'MEM';
interface GridCell { type: GridCellType; address: string; preset?: number; timeUnit?: string }
type GridCellSlot = GridCell | null;
interface GridVLink { rowA: number; rowB: number; col: number }
interface GridRung { id: number; cols: number; rows: GridCellSlot[][]; links: GridVLink[]; comment?: string }

const unitMs = (u?: string) => (u === 's' ? 1000 : u === 'min' ? 60000 : 1);

/** "Q3" -> {type:'O', number:3}. Grid uses Q/TIM/CTU/I/M; engine uses
 * O/TIM/CTU/I/M — only the output prefix differs (Q vs O). */
function parseGridAddress(raw: string): Address | null {
  const m = /^([A-Za-z]+)(\d+)$/.exec(raw.trim());
  if (!m) return null;
  const prefix = m[1].toUpperCase();
  const number = Number(m[2]);
  const map: Record<string, Address['type']> = { I: 'I', Q: 'O', M: 'M', TIM: 'TIM', CTU: 'CTU', CTD: 'CTU' };
  const type = map[prefix];
  return type ? { type, number } : null;
}

function looksLikeGridJson(parsed: unknown): parsed is GridRung[] {
  return Array.isArray(parsed) && parsed.every((r) => r && typeof r === 'object' && 'rows' in r && 'links' in r && 'cols' in r);
}

/**
 * Converts the real Simulator's row/link grid format into a LadderProject
 * graph, so it can be loaded into the Challenge editor (which only speaks
 * the graph format) and graded by PlcRuntime (same format). Returns null
 * if the input doesn't look like grid JSON at all.
 *
 * Two format gaps, by design of the target editor/grading engine:
 *  - RES (standalone "reset this timer/counter" instruction) has no
 *    equivalent LadderElement kind — the graph format only supports
 *    reset-via-resetAddress baked into the TIMER/COUNTER element itself.
 *    RES cells are dropped (treated as a pass-through wire) and reported
 *    as a warning so the teacher can notice and re-wire the reset.
 *  - Junctions are resolved assuming each row is a single, gap-free linear
 *    chain that joins another row at exactly the column where its own
 *    content starts — true for anything the grid editor itself can
 *    produce (validateRung enforces this), so this covers every program a
 *    teacher could actually have built and saved there.
 */
export function importFromGridJson(json: string, projectName = 'Imported'): { project: LadderProject; warnings: string[] } | null {
  let parsed: unknown;
  try { parsed = JSON.parse(json); } catch { return null; }
  if (!looksLikeGridJson(parsed)) return null;

  const warnings: string[] = [];
  const now = new Date().toISOString();
  const rungs: Rung[] = parsed.map((gridRung, rungIndex) => convertRung(gridRung, rungIndex, warnings));

  return {
    project: {
      id: generateId('proj'),
      name: projectName,
      rungs,
      meta: { createdAt: now, updatedAt: now, engineVersion: 'grid-import-1' },
    },
    warnings,
  };
}

function convertRung(gridRung: GridRung, rungIndex: number, warnings: string[]): Rung {
  const nRows = gridRung.rows.length;
  const idAt: (string | null)[][] = gridRung.rows.map(() => []);
  const elements: LadderElement[] = [];

  // Pass 1 — one element per present cell, plus its within-row chain edges.
  for (let r = 0; r < nRows; r++) {
    const row = gridRung.rows[r];
    let prevId: string | null = null;
    let prevCol = -1;
    for (let c = 0; c < row.length; c++) {
      const cell = row[c];
      if (!cell) { idAt[r][c] = null; continue; }
      const id = `r${rungIndex}_row${r}_c${c}_${generateId('el')}`;
      const el = buildElement(id, cell, r, c, warnings, rungIndex);
      idAt[r][c] = el ? id : null;
      if (el) {
        elements.push(el);
        if (prevId !== null && prevCol === c - 1) {
          const prevEl = elements.find((e) => e.id === prevId)!;
          prevEl.connectsTo.push(id);
        }
        prevId = id;
        prevCol = c;
      }
    }
  }

  const cellAt = (r: number, c: number): string | null => idAt[r]?.[c] ?? null;
  const lastBefore = (r: number, col: number): string | 'RAIL' | null => {
    if (r === 0 && col === 0) return 'RAIL';
    for (let c = col - 1; c >= 0; c--) { const id = cellAt(r, c); if (id) return id; }
    return null;
  };

  const startIds = new Set<string>();
  // Row 0's own leading cell is tied to the rail; so is ANY row whose own
  // content starts right at column 0 (the grid engine's "seal-in" rule).
  for (let r = 0; r < nRows; r++) { const id = cellAt(r, 0); if (id) startIds.add(id); }

  const byId = new Map(elements.map((e) => [e.id, e]));
  const connect = (fromId: string, toId: string) => {
    const from = byId.get(fromId);
    if (from && !from.connectsTo.includes(toId)) from.connectsTo.push(toId);
  };

  for (const link of gridRung.links ?? []) {
    const targetA = cellAt(link.rowA, link.col);
    const targetB = cellAt(link.rowB, link.col);
    const srcFromA = lastBefore(link.rowA, link.col);
    const srcFromB = lastBefore(link.rowB, link.col);
    if (srcFromA === 'RAIL') { if (targetB) startIds.add(targetB); }
    else if (srcFromA && targetB) connect(srcFromA, targetB);
    if (srcFromB === 'RAIL') { if (targetA) startIds.add(targetA); }
    else if (srcFromB && targetA) connect(srcFromB, targetA);
  }

  return { id: generateId('rung'), startIds: Array.from(startIds), elements };
}

function buildElement(id: string, cell: GridCell, row: number, col: number, warnings: string[], rungIndex: number): LadderElement | null {
  const base = { id, gridX: col, gridY: row, connectsTo: [] as string[] };
  const addr = cell.address ? parseGridAddress(cell.address) : null;

  switch (cell.type) {
    case 'WIRE':
      return { ...base, kind: 'WIRE' } as WireElement;
    case 'RES':
      warnings.push(`Rung ${rungIndex + 1}: instruksi RES pada ${cell.address || '(tanpa alamat)'} tidak didukung editor Challenge dan dilewati — reset timer/counter ini perlu diatur ulang manual.`);
      return { ...base, kind: 'WIRE' } as WireElement; // pass-through, matches RES's "doesn't block power" behavior
    case 'NO':
    case 'NC':
      if (!addr) { warnings.push(`Rung ${rungIndex + 1}: alamat kontak "${cell.address}" tidak dikenali.`); return { ...base, kind: 'WIRE' } as WireElement; }
      return { ...base, kind: 'CONTACT', mode: cell.type, address: addr } as ContactElement;
    case 'MEM':
      if (!addr) { warnings.push(`Rung ${rungIndex + 1}: alamat memori "${cell.address}" tidak dikenali.`); return { ...base, kind: 'WIRE' } as WireElement; }
      return { ...base, kind: 'CONTACT', mode: 'NO', address: { type: 'M', number: addr.number } } as ContactElement;
    case 'COIL':
    case 'SET':
    case 'RST': {
      if (!addr) { warnings.push(`Rung ${rungIndex + 1}: alamat output "${cell.address}" tidak dikenali.`); return { ...base, kind: 'WIRE' } as WireElement; }
      const coilMode = cell.type === 'COIL' ? 'NORMAL' : cell.type === 'SET' ? 'SET' : 'RESET';
      return { ...base, kind: 'COIL', address: addr, coilMode } as CoilElement;
    }
    case 'TON':
    case 'TOF':
    case 'TP': {
      if (!addr) { warnings.push(`Rung ${rungIndex + 1}: alamat timer "${cell.address}" tidak dikenali.`); return { ...base, kind: 'WIRE' } as WireElement; }
      return { ...base, kind: 'TIMER', timerType: cell.type, address: addr, presetMs: (cell.preset ?? 1000) * unitMs(cell.timeUnit) } as TimerElement;
    }
    case 'CTU':
    case 'CTD': {
      if (!addr) { warnings.push(`Rung ${rungIndex + 1}: alamat counter "${cell.address}" tidak dikenali.`); return { ...base, kind: 'WIRE' } as WireElement; }
      return { ...base, kind: 'COUNTER', counterType: cell.type, address: addr, presetCount: cell.preset ?? 10 } as CounterElement;
    }
    default:
      return { ...base, kind: 'WIRE' } as WireElement;
  }
}
