import { useEffect, useState } from 'react';
import { useLadderEditorStore } from '@/stores/ladderEditorStore';
import { usePlcStore } from '@/stores/plcStore';
import { SimulatorToolbar } from './SimulatorToolbar';
import { LadderGrid } from './LadderGrid';
import { SimulationPanel } from './SimulationPanel';
import { DebuggerPanel } from './DebuggerPanel';
import { simPalette, SIM_FONT_MONO, SIM_KIND_COLOR, useSimIsDark } from '../theme';
import type { LadderProject } from '@/simulator/types/ladder';

/**
 * Top-level composition: Toolbar + ladder grid (rungs/rows/outputs) +
 * physical I/O panel, wired to useLadderEditorStore (rebuilt, plain
 * row/output grid model — no drag/connect/branch gestures) and usePlcStore
 * (engine, unmodified) for Run/highlight-active-path. Restyled to match the
 * Figma prototype's dark "PLC STATUS" bottom bar — visual only, no change
 * to the store wiring above.
 */
export interface LadderEditorScreenProps {
  initialProject?: LadderProject | null;
  onSaveLadder?: (ladderJson: string) => void;
  saveLabel?: string;
  readOnly?: boolean;
  isTeacherMode?: boolean;
  onChangeLadder?: (ladderJson: string) => void;
}

export function LadderEditorScreen({
  initialProject = null,
  onSaveLadder,
  saveLabel = 'Simpan Program',
  readOnly = false,
  isTeacherMode = false,
  onChangeLadder,
}: LadderEditorScreenProps) {
  const isDark = useSimIsDark();
  const p = simPalette(isDark);

  const [isSimulating, setIsSimulating] = useState(false);
  const [continuousMode, setContinuousMode] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showDebugger, setShowDebugger] = useState(false);

  const addRung = useLadderEditorStore((s) => s.addRung);
  const exportToLadderJson = useLadderEditorStore((s) => s.exportToLadderJson);
  const lastErrors = useLadderEditorStore((s) => s.lastErrors);
  const resetDocument = useLadderEditorStore((s) => s.resetDocument);
  const editorLoadProject = useLadderEditorStore((s) => s.loadProject);
  const undo = useLadderEditorStore((s) => s.undo);
  const redo = useLadderEditorStore((s) => s.redo);
  const canUndo = useLadderEditorStore((s) => s.canUndo);
  const canRedo = useLadderEditorStore((s) => s.canRedo);
  const doc = useLadderEditorStore((s) => s.document);

  const loadProject = usePlcStore((s) => s.loadProject);
  const start = usePlcStore((s) => s.start);
  const stop = usePlcStore((s) => s.stop);
  const step = usePlcStore((s) => s.step);
  const reset = usePlcStore((s) => s.reset);
  const scanCount = usePlcStore((s) => s.state.scanCount);
  const lastScanDurationMs = usePlcStore((s) => s.state.lastScanDurationMs);

  useEffect(() => {
    if (initialProject) editorLoadProject(initialProject);
    else resetDocument('Untitled Ladder');
    return () => {
      resetDocument('Untitled Ladder');
      reset();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialProject]);

  useEffect(() => {
    if (onChangeLadder) {
      const res = exportToLadderJson({ validate: false });
      onChangeLadder(JSON.stringify(res.project));
    }
  }, [doc, onChangeLadder, exportToLadderJson]);

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

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {!readOnly && (
            <>
              <button
                type="button"
                onClick={undo}
                disabled={!canUndo()}
                style={{
                  borderRadius: 10, border: `1px solid ${p.border}`, color: canUndo() ? p.text : p.muted,
                  fontFamily: SIM_FONT_MONO, fontSize: 11, opacity: canUndo() ? 1 : 0.4,
                  cursor: canUndo() ? 'pointer' : 'default',
                }}
                className="px-2.5 py-1 font-medium transition-colors hover:bg-white/5"
                title="Undo (Ctrl+Z)"
              >
                ↩ Undo
              </button>
              <button
                type="button"
                onClick={redo}
                disabled={!canRedo()}
                style={{
                  borderRadius: 10, border: `1px solid ${p.border}`, color: canRedo() ? p.text : p.muted,
                  fontFamily: SIM_FONT_MONO, fontSize: 11, opacity: canRedo() ? 1 : 0.4,
                  cursor: canRedo() ? 'pointer' : 'default',
                }}
                className="px-2.5 py-1 font-medium transition-colors hover:bg-white/5"
                title="Redo (Ctrl+Y)"
              >
                ↪ Redo
              </button>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {onSaveLadder && (
            <button
              onClick={() => {
                const result = exportToLadderJson({ validate: false });
                onSaveLadder(JSON.stringify(result.project));
              }}
              className="rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              {saveLabel}
            </button>
          )}
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
      </div>

      <div className="flex flex-1 gap-3 overflow-hidden">
        <div
          className="flex-1 overflow-hidden rounded-3xl p-1"
          style={{ backgroundColor: p.rungBg, border: `1px solid ${p.border}` }}
        >
          <LadderGrid isSimulating={isSimulating} readOnly={readOnly} isTeacher={isTeacherMode} />
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
