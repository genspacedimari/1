import { Play, Square, Plus, AlertCircle, RotateCcw, StepForward } from 'lucide-react';
import { simPalette, SIM_KIND_COLOR, SIM_FONT_MONO, SIM_FONT_SANS, useSimIsDark } from '../theme';

interface SimulatorToolbarProps {
  isSimulating: boolean;
  continuousMode: boolean;
  onContinuousModeChange: (continuous: boolean) => void;
  onToggleSimulate: () => void;
  onStep: () => void;
  onReset: () => void;
  onAddRung: () => void;
  errorMessage: string | null;
  scanCount: number;
  lastScanDurationMs: number;
}

/** Restyled to match the Figma prototype's top toolbar: a segmented
 * Continuous/Single-Scan control, a JetBrains Mono RUN/STOP pill (green
 * while stopped, red while running — same colors the Figma app bar uses),
 * and a monospace scan-status line. All logic/behavior is unchanged from
 * before — this is a visual pass only. */
export function SimulatorToolbar({
  isSimulating,
  continuousMode,
  onContinuousModeChange,
  onToggleSimulate,
  onStep,
  onReset,
  onAddRung,
  errorMessage,
  scanCount,
  lastScanDurationMs,
}: SimulatorToolbarProps) {
  const isDark = useSimIsDark();
  const p = simPalette(isDark);

  return (
    <div className="flex flex-col gap-2">
      <div
        className="flex flex-wrap items-center gap-2 rounded-2xl p-2"
        style={{ backgroundColor: p.toolbar, border: `1px solid ${p.border}` }}
      >
        <button
          onClick={onAddRung}
          disabled={isSimulating}
          title="Tambah Rung"
          style={{
            display: 'flex', alignItems: 'center', gap: 5, height: 36, borderRadius: 10, border: 'none',
            backgroundColor: 'transparent', color: p.text, fontFamily: SIM_FONT_SANS, fontWeight: 600, fontSize: 13,
            padding: '0 10px', opacity: isSimulating ? 0.4 : 1, cursor: isSimulating ? 'default' : 'pointer',
          }}
        >
          <Plus size={15} /> Rung
        </button>

        <div className="flex items-center gap-1 pl-2" style={{ borderLeft: `1px solid ${p.border}` }}>
          <button
            onClick={() => onContinuousModeChange(true)}
            title="Continuous Scan"
            style={{
              height: 32, borderRadius: 8, border: `1.5px solid ${continuousMode ? SIM_KIND_COLOR.fab : p.border}`,
              backgroundColor: continuousMode ? SIM_KIND_COLOR.fab + '22' : 'transparent',
              color: continuousMode ? SIM_KIND_COLOR.fab : p.muted, fontFamily: SIM_FONT_MONO, fontWeight: 600,
              fontSize: 11, padding: '0 10px', cursor: 'pointer',
            }}
          >
            CONTINUOUS
          </button>
          <button
            onClick={() => onContinuousModeChange(false)}
            title="Single Scan — maju satu siklus scan setiap kali"
            style={{
              height: 32, borderRadius: 8, border: `1.5px solid ${!continuousMode ? SIM_KIND_COLOR.fab : p.border}`,
              backgroundColor: !continuousMode ? SIM_KIND_COLOR.fab + '22' : 'transparent',
              color: !continuousMode ? SIM_KIND_COLOR.fab : p.muted, fontFamily: SIM_FONT_MONO, fontWeight: 600,
              fontSize: 11, padding: '0 10px', cursor: 'pointer',
            }}
          >
            SINGLE SCAN
          </button>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          {!continuousMode && (
            <button
              onClick={onStep}
              title="Eksekusi tepat satu siklus scan"
              style={{
                display: 'flex', alignItems: 'center', gap: 5, height: 36, borderRadius: 10,
                border: `1.5px solid ${p.border}`, backgroundColor: 'transparent', color: p.text,
                fontFamily: SIM_FONT_SANS, fontWeight: 600, fontSize: 13, padding: '0 12px', cursor: 'pointer',
              }}
            >
              <StepForward size={15} /> Step
            </button>
          )}

          {!isSimulating ? (
            <button
              onClick={onToggleSimulate}
              title="Jalankan simulasi"
              style={{
                height: 36, borderRadius: 10, backgroundColor: SIM_KIND_COLOR.run, border: 'none', padding: '0 16px',
                display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                fontFamily: SIM_FONT_SANS, fontWeight: 700, fontSize: 13, color: '#fff',
              }}
            >
              <Play size={14} fill="white" /> RUN
            </button>
          ) : (
            <button
              onClick={onToggleSimulate}
              title="Hentikan simulasi"
              style={{
                height: 36, borderRadius: 10, backgroundColor: SIM_KIND_COLOR.stop, border: 'none', padding: '0 16px',
                display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                fontFamily: SIM_FONT_SANS, fontWeight: 700, fontSize: 13, color: '#fff',
              }}
            >
              <Square size={13} fill="white" /> STOP
            </button>
          )}

          <button
            onClick={onReset}
            title="Reset — menghapus semua I/O, timer, counter"
            style={{
              height: 36, width: 36, borderRadius: 10, border: 'none', backgroundColor: 'transparent',
              color: p.muted, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            }}
          >
            <RotateCcw size={15} />
          </button>

          {isSimulating && (
            <span
              style={{
                display: 'flex', alignItems: 'center', gap: 5, height: 24, borderRadius: 12,
                backgroundColor: SIM_KIND_COLOR.powerOn + '22', color: SIM_KIND_COLOR.powerOn,
                fontFamily: SIM_FONT_MONO, fontWeight: 700, fontSize: 10, padding: '0 10px',
              }}
            >
              <span
                style={{
                  width: 6, height: 6, borderRadius: 4, backgroundColor: SIM_KIND_COLOR.powerOn,
                  animation: 'sim-pulse-glow 1s ease infinite',
                }}
              />
              LIVE
            </span>
          )}
        </div>
      </div>

      {isSimulating && (
        <div className="flex justify-end px-1">
          <span style={{ fontFamily: SIM_FONT_MONO, fontSize: 11, color: p.muted }}>
            Scan #{scanCount} · {lastScanDurationMs.toFixed(1)} ms
          </span>
        </div>
      )}

      {errorMessage && (
        <div
          className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs"
          style={{
            border: `1px solid ${SIM_KIND_COLOR.stop}55`,
            backgroundColor: SIM_KIND_COLOR.stop + '18',
            color: SIM_KIND_COLOR.stop,
            fontFamily: SIM_FONT_SANS,
          }}
        >
          <AlertCircle size={14} />
          {errorMessage}
        </div>
      )}

      <style>{`@keyframes sim-pulse-glow { 0%,100% { opacity: 1 } 50% { opacity: 0.35 } }`}</style>
    </div>
  );
}
