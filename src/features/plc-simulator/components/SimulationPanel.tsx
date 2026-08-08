import { usePlcStore } from '@/stores/plcStore';
import { ADDRESS_RANGE } from '@/simulator/types/plcState';
import { simPalette, SIM_KIND_COLOR, SIM_FONT_MONO, useSimIsDark } from '../theme';

function PanelHeading({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <p style={{ margin: '0 0 6px', fontSize: 10, letterSpacing: 0.5, color, fontFamily: SIM_FONT_MONO, fontWeight: 700 }}>
      {children}
    </p>
  );
}

/**
 * Physical I/O panel: toggle switches for every input address, LED tags for
 * every output address — restyled to match the Figma prototype's floating
 * "INPUT SIMULATION" / "OUTPUT" panels (LED dot + JetBrains Mono label,
 * green when energized). Only interactive while a simulation is actually
 * running; outputs are always read-only (they only change as a *result* of
 * the scan cycle, never by direct user action).
 */
export function SimulationPanel({ isSimulating }: { isSimulating: boolean }) {
  const isDark = useSimIsDark();
  const p = simPalette(isDark);
  const inputs = usePlcStore((s) => s.state.inputs);
  const outputs = usePlcStore((s) => s.state.outputs);
  const setInput = usePlcStore((s) => s.setInput);

  return (
    <div
      className="flex flex-col gap-3 rounded-2xl p-3 md:w-56 md:shrink-0"
      style={{ backgroundColor: p.cardBg, border: `1px solid ${p.border}` }}
    >
      <div>
        <PanelHeading color={p.muted}>INPUT SIMULATION</PanelHeading>
        <div className="grid grid-cols-6 gap-1.5 md:grid-cols-4">
          {ADDRESS_RANGE.map((n) => {
            const on = !!inputs[n];
            return (
              <button
                key={n}
                disabled={!isSimulating}
                onClick={() => setInput(n, !inputs[n])}
                title={`I${n}`}
                style={{
                  height: 32,
                  borderRadius: 8,
                  border: `1.5px solid ${on ? SIM_KIND_COLOR.powerOn : p.border}`,
                  backgroundColor: on ? SIM_KIND_COLOR.powerOn + '22' : p.inputBg,
                  color: on ? SIM_KIND_COLOR.powerOn : p.muted,
                  fontFamily: SIM_FONT_MONO,
                  fontWeight: 700,
                  fontSize: 11,
                  opacity: isSimulating ? 1 : 0.4,
                }}
              >
                I{n}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <PanelHeading color={p.muted}>OUTPUT</PanelHeading>
        <div className="grid grid-cols-6 gap-1.5 md:grid-cols-4">
          {ADDRESS_RANGE.map((n) => {
            const on = !!outputs[n];
            return (
              <div
                key={n}
                title={`O${n}`}
                style={{
                  height: 32,
                  borderRadius: 8,
                  border: `1.5px solid ${on ? SIM_KIND_COLOR.powerOn : p.border}`,
                  backgroundColor: on ? SIM_KIND_COLOR.powerOn + '22' : p.inputBg,
                  color: on ? SIM_KIND_COLOR.powerOn : p.muted,
                  fontFamily: SIM_FONT_MONO,
                  fontWeight: 700,
                  fontSize: 11,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                O{n}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
