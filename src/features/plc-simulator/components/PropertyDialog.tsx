import { useEffect, useState } from 'react';
import type { LadderElement } from '@/simulator/types/ladder';
import type { AddressType } from '@/simulator/types/address';
import { simPalette, SIM_FONT_MONO, SIM_FONT_SANS, SIM_KIND_COLOR, useSimIsDark } from '../theme';

interface PropertyDialogProps {
  element: LadderElement;
  onClose: () => void;
  onSave: (updates: { address?: { type: AddressType; number: number }; comment?: string; alias?: string }) => void;
}

/** Valid address types per element kind — a CONTACT can read any bit, but a
 * COIL only ever targets O or M, and TIMER/COUNTER addresses are fixed to
 * their own namespace (changing a Timer's address type would turn it into
 * something else entirely, so that field is locked for those two kinds). */
function allowedTypesFor(element: LadderElement): AddressType[] {
  switch (element.kind) {
    case 'CONTACT':
      return ['I', 'O', 'M', 'TIM', 'CTU'];
    case 'COIL':
      return ['O', 'M'];
    case 'TIMER':
      return ['TIM'];
    case 'COUNTER':
      return ['CTU'];
    default:
      return [];
  }
}

/**
 * Double-click property editor — Address / Comment / Alias, per the Phase 5
 * brief ("Semua Contact, Coil, Timer, Counter harus bisa di-double click").
 * Restyled as a Figma-style bottom sheet (rounded top corners, drag handle,
 * JetBrains Mono inputs) to match the simulator screen's other dialogs —
 * behavior and validation are unchanged from before.
 */
export function PropertyDialog({ element, onClose, onSave }: PropertyDialogProps) {
  const isDark = useSimIsDark();
  const p = simPalette(isDark);
  const hasAddress = 'address' in element && !!element.address;
  const allowedTypes = allowedTypesFor(element);

  const [addressType, setAddressType] = useState<AddressType>(hasAddress ? element.address!.type : allowedTypes[0]);
  const [addressNumber, setAddressNumber] = useState(hasAddress ? element.address!.number : 1);
  const [comment, setComment] = useState(element.comment ?? '');
  const [alias, setAlias] = useState(element.alias ?? '');

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  function handleSave() {
    onSave({
      address: hasAddress ? { type: addressType, number: addressNumber } : undefined,
      comment,
      alias,
    });
    onClose();
  }

  const addressLocked = element.kind === 'TIMER' || element.kind === 'COUNTER';
  const accent = SIM_KIND_COLOR.timer;
  const fieldBg = p.inputBg;

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 80, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100vw', maxWidth: 430, backgroundColor: p.cardBg, borderRadius: '20px 20px 0 0', padding: '0 20px 32px' }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 8px' }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: p.border }} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: p.text, fontFamily: SIM_FONT_SANS }}>Properti Elemen</h3>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: p.muted, fontSize: 20, padding: 4 }}>
            ✕
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {hasAddress && (
            <div>
              <label style={{ fontSize: 13, fontWeight: 500, color: p.text, fontFamily: SIM_FONT_SANS, display: 'block', marginBottom: 6 }}>
                Alamat
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <select
                  value={addressType}
                  disabled={addressLocked}
                  onChange={(e) => setAddressType(e.target.value as AddressType)}
                  style={{
                    height: 44, borderRadius: 10, border: `1.5px solid ${p.border}`, backgroundColor: fieldBg,
                    padding: '0 10px', fontSize: 14, fontFamily: SIM_FONT_MONO, color: p.text, opacity: addressLocked ? 0.5 : 1,
                  }}
                >
                  {allowedTypes.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  max={26}
                  value={addressNumber}
                  onChange={(e) => setAddressNumber(Math.min(26, Math.max(1, Number(e.target.value) || 1)))}
                  style={{
                    height: 44, width: 90, borderRadius: 10, border: `1.5px solid ${p.border}`, backgroundColor: fieldBg,
                    padding: '0 12px', fontSize: 16, fontFamily: SIM_FONT_MONO, fontWeight: 600, color: accent, outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>
              {addressLocked && (
                <p style={{ marginTop: 6, fontSize: 11, color: p.muted, fontFamily: SIM_FONT_SANS }}>
                  Tipe alamat terkunci untuk blok {element.kind === 'TIMER' ? 'Timer' : 'Counter'} — hanya nomornya yang bisa diubah.
                </p>
              )}
            </div>
          )}

          <div>
            <label style={{ fontSize: 13, fontWeight: 500, color: p.text, fontFamily: SIM_FONT_SANS, display: 'block', marginBottom: 6 }}>
              Komentar
            </label>
            <input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="mis. Tombol Start"
              style={{
                width: '100%', height: 44, borderRadius: 10, border: `1.5px solid ${p.border}`, backgroundColor: fieldBg,
                padding: '0 12px', fontSize: 14, fontFamily: SIM_FONT_SANS, color: p.text, outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 500, color: p.text, fontFamily: SIM_FONT_SANS, display: 'block', marginBottom: 6 }}>
              Alias (opsional)
            </label>
            <input
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              placeholder="mis. START_BTN"
              style={{
                width: '100%', height: 44, borderRadius: 10, border: `1.5px solid ${p.border}`, backgroundColor: fieldBg,
                padding: '0 12px', fontSize: 14, fontFamily: SIM_FONT_SANS, color: p.text, outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
            <button
              onClick={onClose}
              style={{
                flex: 1, height: 48, borderRadius: 12, border: `1.5px solid ${p.border}`, backgroundColor: 'transparent',
                color: p.muted, fontSize: 14, fontWeight: 500, fontFamily: SIM_FONT_SANS, cursor: 'pointer',
              }}
            >
              Batal
            </button>
            <button
              onClick={handleSave}
              style={{
                flex: 2, height: 48, borderRadius: 12, border: 'none', backgroundColor: SIM_KIND_COLOR.fab,
                color: '#1C1C1C', fontSize: 14, fontWeight: 700, fontFamily: SIM_FONT_SANS, cursor: 'pointer',
              }}
            >
              Simpan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
