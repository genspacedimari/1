import { useEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import type { Address, AddressType } from '@/simulator/types/address';
import type { NewComponentSpec } from '@/simulator/editor/componentSpec';
import { simPalette, SIM_KIND_COLOR, SIM_FONT_MONO, SIM_FONT_SANS, useSimIsDark } from '../theme';

interface PaletteItem {
  label: string;
  glyph: string;
  color: string;
  addressType: AddressType;
  build: (address: Address) => NewComponentSpec;
}

/** Components that belong in the input (series/parallel) area of a rung. */
export const INPUT_ITEMS: PaletteItem[] = [
  { label: 'Kontak NO', glyph: '┤├', color: SIM_KIND_COLOR.contactNO, addressType: 'I', build: (a) => ({ kind: 'CONTACT', mode: 'NO', address: a, at: { gridX: 0, gridY: 0 } }) },
  { label: 'Kontak NC', glyph: '┤/├', color: SIM_KIND_COLOR.contactNC, addressType: 'I', build: (a) => ({ kind: 'CONTACT', mode: 'NC', address: a, at: { gridX: 0, gridY: 0 } }) },
  { label: 'Rising Edge', glyph: '┤↑├', color: SIM_KIND_COLOR.contactEdge, addressType: 'I', build: (a) => ({ kind: 'CONTACT', mode: 'RISING_EDGE', address: a, at: { gridX: 0, gridY: 0 } }) },
  { label: 'Falling Edge', glyph: '┤↓├', color: SIM_KIND_COLOR.contactEdge, addressType: 'I', build: (a) => ({ kind: 'CONTACT', mode: 'FALLING_EDGE', address: a, at: { gridX: 0, gridY: 0 } }) },
  { label: 'Kontak Memory', glyph: '┤M├', color: SIM_KIND_COLOR.memoryContact, addressType: 'M', build: (a) => ({ kind: 'CONTACT', mode: 'NO', address: a, at: { gridX: 0, gridY: 0 } }) },
];

/** Components that belong in the output column of a rung. */
export const OUTPUT_ITEMS: PaletteItem[] = [
  { label: 'Output Coil', glyph: '( )', color: SIM_KIND_COLOR.coil, addressType: 'O', build: (a) => ({ kind: 'COIL', address: a, at: { gridX: 0, gridY: 0 }, coilMode: 'NORMAL' }) },
  { label: 'SET Coil', glyph: '(S)', color: SIM_KIND_COLOR.coilSet, addressType: 'O', build: (a) => ({ kind: 'COIL', address: a, at: { gridX: 0, gridY: 0 }, coilMode: 'SET' }) },
  { label: 'RESET Coil', glyph: '(R)', color: SIM_KIND_COLOR.coilReset, addressType: 'O', build: (a) => ({ kind: 'COIL', address: a, at: { gridX: 0, gridY: 0 }, coilMode: 'RESET' }) },
  { label: 'Memory Coil', glyph: '(M)', color: SIM_KIND_COLOR.memoryContact, addressType: 'M', build: (a) => ({ kind: 'COIL', address: a, at: { gridX: 0, gridY: 0 }, coilMode: 'NORMAL' }) },
  { label: 'Timer TON', glyph: 'TON', color: SIM_KIND_COLOR.timer, addressType: 'TIM', build: (a) => ({ kind: 'TIMER', address: a, presetMs: 2000, at: { gridX: 0, gridY: 0 }, timerType: 'TON' }) },
  { label: 'Timer TOF', glyph: 'TOF', color: SIM_KIND_COLOR.timer, addressType: 'TIM', build: (a) => ({ kind: 'TIMER', address: a, presetMs: 2000, at: { gridX: 0, gridY: 0 }, timerType: 'TOF' }) },
  { label: 'Timer TP', glyph: 'TP', color: SIM_KIND_COLOR.timer, addressType: 'TIM', build: (a) => ({ kind: 'TIMER', address: a, presetMs: 2000, at: { gridX: 0, gridY: 0 }, timerType: 'TP' }) },
  { label: 'Counter CTU', glyph: 'CTU', color: SIM_KIND_COLOR.counter, addressType: 'CTU', build: (a) => ({ kind: 'COUNTER', address: a, presetCount: 3, at: { gridX: 0, gridY: 0 }, counterType: 'CTU' }) },
  { label: 'Counter CTD', glyph: 'CTD', color: SIM_KIND_COLOR.counter, addressType: 'CTU', build: (a) => ({ kind: 'COUNTER', address: a, presetCount: 3, at: { gridX: 0, gridY: 0 }, counterType: 'CTD' }) },
];

interface AddElementMenuProps {
  items: PaletteItem[];
  disabled?: boolean;
  allocateAddress: (type: AddressType) => Address;
  onPick: (spec: NewComponentSpec) => void;
  title: string;
}

/** A "+" button that opens a Figma-style bottom sheet — rounded top
 * corners, drag handle, a grid of colored component chips — matching the
 * "Insert Component" sheet from the Figma prototype. Replaces the old
 * small anchored dropdown; behavior (pick one, address auto-allocated) is
 * unchanged. */
export function AddElementMenu({ items, disabled, allocateAddress, onPick, title }: AddElementMenuProps) {
  const isDark = useSimIsDark();
  const p = simPalette(isDark);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div ref={ref}>
      <button
        disabled={disabled}
        onClick={() => setOpen(true)}
        title={title}
        style={{ borderColor: p.border, color: p.muted }}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-dashed transition-colors hover:opacity-80 disabled:opacity-40"
      >
        <Plus size={16} />
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 80, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100vw',
              maxWidth: 430,
              backgroundColor: p.cardBg,
              borderRadius: '20px 20px 0 0',
              padding: '0 16px 32px',
              maxHeight: '75vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 8px' }}>
              <div style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: p.border }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, padding: '0 4px' }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: p.text, fontFamily: SIM_FONT_SANS }}>Sisipkan Komponen</h3>
              <button onClick={() => setOpen(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: p.muted, fontSize: 20, padding: 4 }}>
                ✕
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {items.map((item) => (
                <button
                  key={item.label}
                  onClick={() => {
                    onPick(item.build(allocateAddress(item.addressType)));
                    setOpen(false);
                  }}
                  style={{
                    borderRadius: 14,
                    border: `1.5px solid ${item.color}33`,
                    backgroundColor: item.color + '11',
                    padding: '14px 8px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 6,
                    minHeight: 80,
                  }}
                >
                  <span style={{ fontSize: 15, fontWeight: 700, color: item.color, fontFamily: SIM_FONT_MONO }}>{item.glyph}</span>
                  <span style={{ fontSize: 10, color: p.text, fontFamily: SIM_FONT_SANS, textAlign: 'center', lineHeight: 1.3 }}>
                    {item.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
