import { useEffect, useRef, useState } from 'react';
import { usePlcStore } from '@/stores/plcStore';
import { ADDRESS_RANGE, WORD_ADDRESS_RANGE } from '@/simulator/types/plcState';
import { parseAddressLabel, type CrossRefUsage } from '@/simulator/engine/crossReference';
import { runAllRuntimeTests, type RuntimeTestResult } from '@/simulator/engine/runtimeVerification';
import type { DiagnosticCategory } from '@/simulator/engine/runtimeDiagnostics';
import { cn } from '@/utils/cn';
import { simPalette, SIM_FONT_MONO, useSimIsDark } from '../theme';

/**
 * Phase 5.5 — the Debugger.
 *
 * Every section here is read-only presentation over data the Runtime
 * already produces every scan (Watch Window / Live Memory Viewer /
 * Scan Time Monitor / Diagnostics all come straight from
 * `usePlcStore`/`plcRuntime`'s existing snapshot, extended additively in
 * Phase 5.5 — see runtime/plcRuntime.ts) plus two small interactive
 * pieces (Force Mode, Cross Reference search) that call the equally
 * additive `forceBit`/`findUsages` actions. No new simulation logic lives
 * in this file — it is, per the brief, "hanya alat" (just a tool).
 */

type WatchTab = 'I' | 'O' | 'M' | 'T' | 'C' | 'D';
const WATCH_TABS: WatchTab[] = ['I', 'O', 'M', 'T', 'C', 'D'];

export function DebuggerPanel() {
  const isDark = useSimIsDark();
  const p = simPalette(isDark);
  const [tab, setTab] = useState<'watch' | 'memory' | 'force' | 'scan' | 'diag' | 'xref' | 'test'>('watch');

  const tabs: Array<{ id: typeof tab; label: string }> = [
    { id: 'watch', label: 'Watch Window' },
    { id: 'memory', label: 'Live Memory' },
    { id: 'force', label: 'Force Mode' },
    { id: 'scan', label: 'Scan Monitor' },
    { id: 'diag', label: 'Diagnostics' },
    { id: 'xref', label: 'Cross Ref' },
    { id: 'test', label: 'Auto Test' },
  ];

  return (
    <div
      className="flex flex-col gap-2 rounded-2xl p-3 md:w-72 md:shrink-0"
      style={{ backgroundColor: p.cardBg, border: `1px solid ${p.border}` }}
    >
      <h3 style={{ fontFamily: SIM_FONT_MONO, color: p.muted }} className="text-xs font-semibold">
        DEBUGGER
      </h3>
      <div className="flex flex-wrap gap-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={
              tab === t.id
                ? { backgroundColor: '#D9770622', color: '#D97706', fontFamily: SIM_FONT_MONO }
                : { color: p.muted, fontFamily: SIM_FONT_MONO }
            }
            className="rounded-lg px-2 py-1 text-[10px] font-medium transition-colors hover:opacity-80"
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="max-h-[420px] overflow-y-auto">
        {tab === 'watch' && <WatchWindow />}
        {tab === 'memory' && <LiveMemoryViewer />}
        {tab === 'force' && <ForcePanel />}
        {tab === 'scan' && <ScanTimeMonitor />}
        {tab === 'diag' && <DiagnosticsPanel />}
        {tab === 'xref' && <CrossReferencePanel />}
        {tab === 'test' && <AutomatedTestPanel />}
      </div>
    </div>
  );
}

// ── Watch Window ───────────────────────────────────────────────────────
/** Monitors I/Q(O)/M/T/C/D straight from PlcState every scan — this
 * component reads nothing but `usePlcStore((s) => s.state)`, the same
 * reactive slice the rest of the app already uses, so "Realtime setiap
 * Scan" (real-time every scan) falls out of the existing subscribe/emit
 * loop in plcRuntime.ts for free. */
function WatchWindow() {
  const [watchTab, setWatchTab] = useState<WatchTab>('I');
  const state = usePlcStore((s) => s.state);

  const rows: Array<{ label: string; value: string | boolean | number }> =
    watchTab === 'I'
      ? ADDRESS_RANGE.map((n) => ({ label: `I${n}`, value: !!state.inputs[n] }))
      : watchTab === 'O'
        ? ADDRESS_RANGE.map((n) => ({ label: `Q${n}`, value: !!state.outputs[n] }))
        : watchTab === 'M'
          ? ADDRESS_RANGE.map((n) => ({ label: `M${n}`, value: !!state.memory[n] }))
          : watchTab === 'T'
            ? Object.entries(state.timers).map(([n, t]) => ({
                label: `T${n}`,
                value: `${t.accumulatedMs}/${t.presetMs}ms DN=${t.done}`,
              }))
            : watchTab === 'C'
              ? Object.entries(state.counters).map(([n, c]) => ({
                  label: `C${n}`,
                  value: `${c.accumulatedCount}/${c.presetCount} DN=${c.done}`,
                }))
              : WORD_ADDRESS_RANGE.filter((n) => state.words[n] !== 0).map((n) => ({
                  label: `D${n}`,
                  value: state.words[n],
                }));

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-1">
        {WATCH_TABS.map((t) => (
          <button
            key={t}
            onClick={() => setWatchTab(t)}
            className={cn(
              'rounded px-1.5 py-0.5 text-[10px] font-semibold',
              watchTab === t ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-muted/40'
            )}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[11px]">
        {rows.length === 0 && <span className="col-span-2 text-muted-foreground">— no data —</span>}
        {rows.map((r) => (
          <div key={r.label} className="flex justify-between border-b border-border/40 py-0.5 dark:border-border-dark/40">
            <span className="text-muted-foreground">{r.label}</span>
            <span className={cn('font-mono', r.value === true && 'text-emerald-500')}>{String(r.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Live Memory Viewer ────────────────────────────────────────────────
/** Current Value / Previous Value / Last Scan Change / Address / Type —
 * "Previous Value" and "Last Scan Change" are computed client-side by
 * diffing against the last render's snapshot (a plain ref, no engine
 * change needed): PlcState itself only ever needs to carry "now", exactly
 * like a real PLC's memory table — the DIFFING is the Debugger's job, not
 * the Runtime's. */
interface MemRow {
  address: string;
  type: string;
  current: string;
  previous: string;
  changed: boolean;
}

function LiveMemoryViewer() {
  const state = usePlcStore((s) => s.state);
  const prevRef = useRef<Record<string, string>>({});

  const flat: Record<string, { value: string; type: string }> = {};
  for (const n of ADDRESS_RANGE) {
    flat[`I${n}`] = { value: String(!!state.inputs[n]), type: 'Input' };
    flat[`Q${n}`] = { value: String(!!state.outputs[n]), type: 'Output' };
    flat[`M${n}`] = { value: String(!!state.memory[n]), type: 'Memory' };
  }
  for (const [n, t] of Object.entries(state.timers)) {
    flat[`T${n}`] = { value: `${t.accumulatedMs}ms DN=${t.done}`, type: 'Timer' };
  }
  for (const [n, c] of Object.entries(state.counters)) {
    flat[`C${n}`] = { value: `${c.accumulatedCount} DN=${c.done}`, type: 'Counter' };
  }
  for (const n of WORD_ADDRESS_RANGE) {
    if (state.words[n] !== 0) flat[`D${n}`] = { value: String(state.words[n]), type: 'Word' };
  }

  const rows: MemRow[] = Object.entries(flat).map(([address, { value, type }]) => {
    const previous = prevRef.current[address] ?? value;
    return { address, type, current: value, previous, changed: previous !== value };
  });

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const [address, { value }] of Object.entries(flat)) next[address] = value;
    prevRef.current = next;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.scanCount]);

  const changedRows = rows.filter((r) => r.changed);
  const shown = changedRows.length > 0 ? changedRows : rows.slice(0, 20);

  return (
    <div className="flex flex-col gap-1 text-[11px]">
      <div className="text-muted-foreground">
        {changedRows.length > 0 ? `${changedRows.length} changed last scan` : 'No change last scan — showing first 20'}
      </div>
      {shown.map((r) => (
        <div key={r.address} className={cn('rounded px-1.5 py-1', r.changed && 'bg-primary/10')}>
          <div className="flex justify-between font-mono">
            <span>{r.address}</span>
            <span className="text-muted-foreground">{r.type}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>prev: {r.previous}</span>
            <span className={cn(r.changed && 'font-semibold text-primary')}>now: {r.current}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Force Mode ─────────────────────────────────────────────────────────
/** Force ON / Force OFF / Release Force. Never touches the Scan Cycle
 * itself — see PlcRuntime.forceBit's doc comment; forcing is an override
 * layer applied after every scan, so the scan keeps running exactly as
 * before, forced or not. */
function ForcePanel() {
  const forceBit = usePlcStore((s) => s.forceBit);
  const releaseForce = usePlcStore((s) => s.releaseForce);
  const releaseAllForces = usePlcStore((s) => s.releaseAllForces);
  const getForcedAddresses = usePlcStore((s) => s.getForcedAddresses);
  const state = usePlcStore((s) => s.state); // re-render on every scan so the forced list stays fresh

  const forced = getForcedAddresses();
  const groups: Array<{ type: 'I' | 'O' | 'M'; label: string; numbers: number[]; bits: Record<number, boolean> }> = [
    { type: 'I', label: 'Inputs', numbers: forced.inputs, bits: state.inputs },
    { type: 'O', label: 'Outputs', numbers: forced.outputs, bits: state.outputs },
    { type: 'M', label: 'Memory', numbers: forced.memory, bits: state.memory },
  ];

  const [type, setType] = useState<'I' | 'O' | 'M'>('I');
  const [number, setNumber] = useState(1);

  return (
    <div className="flex flex-col gap-3 text-[11px]">
      <div className="flex items-center gap-1">
        <select value={type} onChange={(e) => setType(e.target.value as 'I' | 'O' | 'M')} className="rounded border border-border bg-transparent px-1 py-0.5 dark:border-border-dark">
          <option value="I">I</option>
          <option value="O">Q</option>
          <option value="M">M</option>
        </select>
        <select value={number} onChange={(e) => setNumber(Number(e.target.value))} className="rounded border border-border bg-transparent px-1 py-0.5 dark:border-border-dark">
          {ADDRESS_RANGE.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <button onClick={() => forceBit(type, number, true)} className="rounded bg-emerald-500/15 px-2 py-0.5 font-medium text-emerald-600">
          Force ON
        </button>
        <button onClick={() => forceBit(type, number, false)} className="rounded bg-rose-500/15 px-2 py-0.5 font-medium text-rose-600">
          Force OFF
        </button>
      </div>
      <button onClick={releaseAllForces} className="self-start rounded bg-muted/60 px-2 py-1 text-muted-foreground dark:bg-white/5">
        Release All Forces
      </button>

      {groups.map((g) => (
        <div key={g.type}>
          <h4 className="mb-1 text-muted-foreground">{g.label} — forced</h4>
          {g.numbers.length === 0 && <p className="text-muted-foreground">none</p>}
          <div className="flex flex-wrap gap-1">
            {g.numbers.map((n) => (
              <span key={n} className="flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-amber-600">
                {g.type === 'O' ? 'Q' : g.type}
                {n}={String(!!g.bits[n])}
                <button onClick={() => releaseForce(g.type, n)} className="font-bold">
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Scan Time Monitor ─────────────────────────────────────────────────
function ScanTimeMonitor() {
  const stats = usePlcStore((s) => s.scanStats);
  const programSize = usePlcStore((s) => s.programSize);
  const scanCount = usePlcStore((s) => s.state.scanCount);

  const rows: Array<[string, string]> = [
    ['Current Scan', `${stats.currentMs.toFixed(2)} ms`],
    ['Average Scan', `${stats.averageMs.toFixed(2)} ms`],
    ['Maximum Scan', `${stats.maxMs.toFixed(2)} ms`],
    ['Minimum Scan', `${stats.minMs.toFixed(2)} ms`],
    ['Scan Count', String(scanCount)],
    ['Instruction Count', String(programSize.instructionCount)],
    ['Rung Count', String(programSize.rungCount)],
  ];

  return (
    <div className="flex flex-col gap-1 text-[11px]">
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between border-b border-border/40 py-1 dark:border-border-dark/40">
          <span className="text-muted-foreground">{label}</span>
          <span className="font-mono font-semibold">{value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Runtime Diagnostics ───────────────────────────────────────────────
const CATEGORY_LABEL: Record<DiagnosticCategory, string> = {
  BROKEN_WIRE: 'Broken Wire',
  FLOATING_BRANCH: 'Floating Branch',
  DUPLICATE_ADDRESS: 'Duplicate Address',
  INVALID_ADDRESS: 'Invalid Address',
  INSTRUCTION_ERROR: 'Instruction Error',
  MEMORY_OVERFLOW: 'Memory Overflow',
  INVALID_TIMER: 'Invalid Timer',
  INVALID_COUNTER: 'Invalid Counter',
  DEAD_BRANCH: 'Dead Branch',
  INVALID_LOOP: 'Invalid Loop',
  OTHER: 'Other',
};

function DiagnosticsPanel() {
  const diagnostics = usePlcStore((s) => s.diagnostics);

  if (diagnostics.length === 0) {
    return <p className="text-[11px] text-emerald-500">No diagnostics — Runtime is clean.</p>;
  }

  return (
    <div className="flex flex-col gap-1.5 text-[11px]">
      {diagnostics.map((d, i) => (
        <div key={i} className="rounded-lg bg-rose-500/10 p-1.5">
          <div className="font-semibold text-rose-600">{CATEGORY_LABEL[d.category]}</div>
          <div className="text-muted-foreground">{d.message}</div>
        </div>
      ))}
    </div>
  );
}

// ── Cross Reference ───────────────────────────────────────────────────
function CrossReferencePanel() {
  const findUsages = usePlcStore((s) => s.findUsages);
  const [query, setQuery] = useState('O1');
  const [results, setResults] = useState<CrossRefUsage[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function search() {
    const address = parseAddressLabel(query);
    if (!address) {
      setError(`"${query}" isn't a recognized address (try I1, Q1, M1, T1, C1).`);
      setResults(null);
      return;
    }
    setError(null);
    setResults(findUsages(address));
  }

  return (
    <div className="flex flex-col gap-2 text-[11px]">
      <div className="flex gap-1">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && search()}
          placeholder="e.g. Q1"
          className="w-full rounded border border-border bg-transparent px-1.5 py-0.5 dark:border-border-dark"
        />
        <button onClick={search} className="rounded bg-primary/15 px-2 py-0.5 font-medium text-primary">
          Find
        </button>
      </div>
      {error && <p className="text-rose-600">{error}</p>}
      {results && results.length === 0 && <p className="text-muted-foreground">No usages found.</p>}
      {results?.map((u, i) => (
        <div key={i} className="flex justify-between rounded bg-muted/40 px-1.5 py-1 dark:bg-white/5">
          <span>
            {u.kind} <span className="text-muted-foreground">({u.role})</span>
          </span>
          <span className="text-muted-foreground">rung {u.rungId}</span>
        </div>
      ))}
    </div>
  );
}

// ── Automated Runtime Test ────────────────────────────────────────────
function AutomatedTestPanel() {
  const [results, setResults] = useState<RuntimeTestResult[] | null>(null);
  const [running, setRunning] = useState(false);

  function run() {
    setRunning(true);
    // Yield a tick so the button visibly shows "Running..." before the
    // (synchronous, sub-10ms) suite executes.
    setTimeout(() => {
      setResults(runAllRuntimeTests());
      setRunning(false);
    }, 0);
  }

  const passCount = results?.filter((r) => r.pass).length ?? 0;

  return (
    <div className="flex flex-col gap-2 text-[11px]">
      <button
        onClick={run}
        disabled={running}
        className="self-start rounded bg-primary/15 px-2 py-1 font-medium text-primary disabled:opacity-50"
      >
        {running ? 'Running…' : 'Run Automated Runtime Test'}
      </button>
      {results && (
        <p className={cn('font-semibold', passCount === results.length ? 'text-emerald-500' : 'text-rose-600')}>
          {passCount}/{results.length} PASSED
        </p>
      )}
      {results?.map((r) => (
        <div key={r.name} className="flex items-center justify-between border-b border-border/40 py-1 dark:border-border-dark/40">
          <span className={cn(r.pass ? 'text-emerald-600' : 'text-rose-600')}>
            {r.pass ? '✓' : '✗'} {r.name}
          </span>
          <span className="text-muted-foreground">{r.executionTimeMs.toFixed(2)}ms</span>
        </div>
      ))}
    </div>
  );
}
