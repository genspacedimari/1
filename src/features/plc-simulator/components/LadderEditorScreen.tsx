import { useEffect, useState } from 'react';
import { useLadderEditorStore } from '@/stores/ladderEditorStore';
import { usePlcStore } from '@/stores/plcStore';
import { SimulatorToolbar } from './SimulatorToolbar';
import { LadderGrid } from './LadderGrid';
import { SimulationPanel } from './SimulationPanel';
import { DebuggerPanel } from './DebuggerPanel';
import { simPalette, SIM_FONT_MONO, SIM_KIND_COLOR, useSimIsDark } from '../theme';

/**
 * Top-level composition: Toolbar + ladder grid (rungs/rows/outputs) +
 * physical I/O panel, wired to useLadderEditorStore (rebuilt, plain
 * row/output grid model — no drag/connect/branch gestures) and usePlcStore
 * (engine, unmodified) for Run/highlight-active-path. Restyled to match the
 * Figma prototype's dark "PLC STATUS" bottom bar — visual only, no change
 * to the store wiring above.
 */
export function LadderEditorScreen() {
  const isDark = useSimIsDark();
  const p = simPalette(isDark);

  const [isSimulating, setIsSimulating] = useState(false);
  const [continuousMode, setContinuousMode] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showDebugger, setShowDebugger] = useState(false);

  const addRung = useLadderEditorStore((s) => s.addRung);
  const exportToLadderJson = useLadderEditorStore((s) => s.exportToLadderJson);
  const lastErrors = useLadderEditorStore((s) => s.lastErrors);

  const loadProject = usePlcStore((s) => s.loadProject);
  const start = usePlcStore((s) => s.start);
  const stop = usePlcStore((s) => s.stop);
  const step = usePlcStore((s) => s.step);
  const reset = usePlcStore((s) => s.reset);
  const scanCount = usePlcStore((s) => s.state.scanCount);
  const lastScanDurationMs = usePlcStore((s) => s.state.lastScanDurationMs);

  useEffect(() => {
    if (!errorMessage) return;
    const timer = setTimeout(() => setErrorMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [errorMessage]);

  useEffect(() => {
    if (lastErrors.length > 0) setErrorMessage(lastErrors[lastErrors.length - 1]);
  }, [lastErrors]);

  function armSimulation(): boolean {
    const { project, errors } = exportToLadderJson();
    if (errors.length > 0) {
      setErrorMessage(errors[0]);
      return false;
    }
    loadProject(project);
    return true;
  }

  function handleToggleSimulate() {
    if (isSimulating) {
      stop();
      setIsSimulating(false);
      return;
    }
    if (!armSimulation()) return;
    if (continuousMode) start();
    setIsSimulating(true);
  }

  function handleStep() {
    if (!isSimulating) {
      if (!armSimulation()) return;
      setIsSimulating(true);
    }
    step();
  }

  function handleReset() {
    reset();
    setIsSimulating(false);
  }

  return (
    <div className="flex h-[calc(100vh-180px)] min-h-[520px] flex-col gap-3 md:h-[calc(100vh-140px)]">
      <SimulatorToolbar
        isSimulating={isSimulating}
        continuousMode={continuousMode}
        onContinuousModeChange={setContinuousMode}
        onToggleSimulate={handleToggleSimulate}
        onStep={handleStep}
        onReset={handleReset}
        onAddRung={() => addRung()}
        errorMessage={errorMessage}
        scanCount={scanCount}
        lastScanDurationMs={lastScanDurationMs}
      />

      <div className="flex justify-end">
        <button
          onClick={() => setShowDebugger((v) => !v)}
          style={{
            borderRadius: 10, border: `1px solid ${p.border}`, color: p.muted,
            fontFamily: SIM_FONT_MONO, fontSize: 11,
          }}
          className="px-2.5 py-1 font-medium transition-colors hover:opacity-80"
        >
          {showDebugger ? 'SEMBUNYIKAN DEBUGGER' : 'TAMPILKAN DEBUGGER'}
        </button>
      </div>

      <div className="flex flex-1 gap-3 overflow-hidden">
        <div
          className="flex-1 overflow-hidden rounded-3xl p-1"
          style={{ backgroundColor: p.rungBg, border: `1px solid ${p.border}` }}
        >
          <LadderGrid isSimulating={isSimulating} />
        </div>
        <SimulationPanel isSimulating={isSimulating} />
        {showDebugger && <DebuggerPanel />}
      </div>

      {/* === PLC STATUS bar — matches the Figma prototype's bottom status strip === */}
      <div
        className="flex items-center gap-2 rounded-2xl px-4 py-2"
        style={{ backgroundColor: p.appBar, border: `1px solid ${p.border}` }}
      >
        <span
          style={{
            width: 8, height: 8, borderRadius: 4,
            backgroundColor: isSimulating ? SIM_KIND_COLOR.powerOn : p.muted,
          }}
        />
        <span style={{ fontFamily: SIM_FONT_MONO, fontSize: 12, fontWeight: 600, color: p.text }}>
          PLC STATUS · {isSimulating ? 'RUN' : 'STOP'}
        </span>
      </div>
    </div>
  );
}
