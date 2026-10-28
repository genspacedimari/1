import { useState, Fragment } from 'react';
import { Plus, Trash2, Scissors, RotateCcw } from 'lucide-react';
import { useLadderEditorStore } from '@/stores/ladderEditorStore';
import { usePlcStore } from '@/stores/plcStore';
import type { Address, AddressType } from '@/simulator/types/address';
import type { LadderElement } from '@/simulator/types/ladder';
import { nextAvailableAddress } from '../utils/addressAllocation';
import { AddElementMenu, INPUT_ITEMS, OUTPUT_ITEMS } from './ComponentPalette';
import { PropertyDialog } from './PropertyDialog';
import { simPalette, SIM_KIND_COLOR, SIM_FONT_MONO, SIM_FONT_SANS, useSimIsDark } from '../theme';

/** Border/fill accent per element kind — matches the Figma toolbar's
 * per-component color coding exactly (blue NO, purple NC/Memory, green
 * Coil/SET, red RESET, amber Timer, cyan Counter). */
function elementColor(element: LadderElement): string {
  switch (element.kind) {
    case 'CONTACT':
      if ('address' in element && element.address?.type === 'M') return SIM_KIND_COLOR.memoryContact;
      return element.mode === 'NC' ? SIM_KIND_COLOR.contactNC : SIM_KIND_COLOR.contactNO;
    case 'COIL':
      if (element.coilMode === 'RESET') return SIM_KIND_COLOR.coilReset;
      return SIM_KIND_COLOR.coil;
    case 'TIMER':
      return SIM_KIND_COLOR.timer;
    case 'COUNTER':
      return SIM_KIND_COLOR.counter;
    case 'PLACEHOLDER':
      return '#F59E0B';
    default:
      return SIM_KIND_COLOR.wire;
  }
}

/** Figma-style glyph SVG for one instruction — a contact (┤├ / ┤/├), a
 * coil (circle), or a timer/counter block (rounded rect) — rendered with
 * the live green power-flow color when `powered` is true, exactly like the
 * CX-Programmer-inspired Figma cell renderer. */
function ElementGlyph({ element, powered, color }: { element: LadderElement; powered: boolean; color: string }) {
  const stroke = powered ? SIM_KIND_COLOR.powerOn : color;
  const common = { width: 34, height: 28, viewBox: '0 0 34 28' } as const;

  switch (element.kind) {
    case 'PLACEHOLDER': {
      return (
        <svg {...common}>
          <line x1="0" y1="14" x2="6" y2="14" stroke="#F59E0B" strokeWidth="2" strokeDasharray="2 2" />
          <rect x="6" y="4" width="22" height="20" rx="4" fill="rgba(245, 158, 11, 0.15)" stroke="#F59E0B" strokeWidth="1.8" strokeDasharray="3 3" />
          <text x="17" y="18" textAnchor="middle" fill="#D97706" fontSize="12" fontWeight="bold" fontFamily={SIM_FONT_MONO}>?</text>
          <line x1="28" y1="14" x2="34" y2="14" stroke="#F59E0B" strokeWidth="2" strokeDasharray="2 2" />
        </svg>
      );
    }
    case 'CONTACT': {
      const isNC = element.mode === 'NC';
      return (
        <svg {...common}>
          <line x1="0" y1="14" x2="10" y2="14" stroke={stroke} strokeWidth="2" />
          <line x1="10" y1="6" x2="10" y2="22" stroke={stroke} strokeWidth="2.2" strokeLinecap="round" />
          <line x1="24" y1="6" x2="24" y2="22" stroke={stroke} strokeWidth="2.2" strokeLinecap="round" />
          {isNC && <line x1="13" y1="6" x2="21" y2="22" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" />}
          <line x1="24" y1="14" x2="34" y2="14" stroke={stroke} strokeWidth="2" />
        </svg>
      );
    }
    case 'COIL':
      return (
        <svg {...common}>
          <line x1="0" y1="14" x2="9" y2="14" stroke={stroke} strokeWidth="2" />
          <circle cx="17" cy="14" r="8" fill={powered ? SIM_KIND_COLOR.powerOn + '22' : 'none'} stroke={stroke} strokeWidth="2" />
          <line x1="25" y1="14" x2="34" y2="14" stroke={stroke} strokeWidth="2" />
        </svg>
      );
    case 'TIMER':
      return (
        <svg {...common}>
          <line x1="0" y1="14" x2="6" y2="14" stroke={stroke} strokeWidth="2" />
          <rect x="6" y="4" width="22" height="20" rx="3" fill={powered ? stroke + '22' : 'none'} stroke={stroke} strokeWidth="1.6" />
          <circle cx="17" cy="13" r="5.5" fill="none" stroke={stroke} strokeWidth="1.3" />
          <line x1="17" y1="13" x2="17" y2="9.5" stroke={stroke} strokeWidth="1.3" strokeLinecap="round" />
          <line x1="17" y1="13" x2="19.5" y2="14.5" stroke={stroke} strokeWidth="1.3" strokeLinecap="round" />
          <line x1="28" y1="14" x2="34" y2="14" stroke={stroke} strokeWidth="2" />
        </svg>
      );
    case 'COUNTER': {
      const up = element.counterType === 'CTU';
      return (
        <svg {...common}>
          <line x1="0" y1="14" x2="6" y2="14" stroke={stroke} strokeWidth="2" />
          <rect x="6" y="4" width="22" height="20" rx="3" fill={powered ? stroke + '22' : 'none'} stroke={stroke} strokeWidth="1.6" />
          <path d={up ? 'M12 18l5-8 5 8' : 'M12 10l5 8 5-8'} fill="none" stroke={stroke} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
          <line x1="28" y1="14" x2="34" y2="14" stroke={stroke} strokeWidth="2" />
        </svg>
      );
    }
    default:
      return (
        <svg {...common}>
          <line x1="0" y1="14" x2="34" y2="14" stroke={stroke} strokeWidth="2" />
        </svg>
      );
  }
}

/** One instruction box — a contact in a row, or an output (coil/timer/
 * counter). Same look everywhere so the diagram reads consistently. */
function ElementBox({
  element,
  isSimulating,
  readOnly = false,
  isTeacher = false,
  onClick,
  onDelete,
  onMakePlaceholder,
  onRestore,
}: {
  element: LadderElement;
  isSimulating: boolean;
  readOnly?: boolean;
  isTeacher?: boolean;
  onClick: () => void;
  onDelete: () => void;
  onMakePlaceholder?: () => void;
  onRestore?: () => void;
}) {
  const isDark = useSimIsDark();
  const p = simPalette(isDark);
  const powered = usePlcStore((s) => (isSimulating ? !!s.poweredElements[element.id] : false));
  const color = elementColor(element);

  const isPlaceholder = element.kind === 'PLACEHOLDER';

  const label = (() => {
    if (isPlaceholder) return 'KOSONG';
    switch (element.kind) {
      case 'TIMER':
        return element.timerType;
      case 'COUNTER':
        return element.counterType;
      case 'COIL':
        return element.coilMode === 'SET' ? 'S' : element.coilMode === 'RESET' ? 'R' : '';
      default:
        return '';
    }
  })();

  const addressLabel = 'address' in element && element.address ? `${element.address.type}${element.address.number}` : '';

  return (
    <div className="group relative">
      <button
        onClick={onClick}
        title={
          isPlaceholder
            ? 'Komponen [ KOSONG ] — Klik untuk melengkapi komponen rangkaian ini'
            : readOnly
            ? 'Kunci Jawaban Asli (Terkunci)'
            : 'Klik untuk edit — alamat, komentar, alias'
        }
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
          height: 56,
          minWidth: isPlaceholder ? 72 : 64,
          borderRadius: 10,
          border: isPlaceholder
            ? '2px dashed #F59E0B'
            : `1.5px solid ${powered ? SIM_KIND_COLOR.powerOn : color + '55'}`,
          backgroundColor: isPlaceholder
            ? 'rgba(245, 158, 11, 0.08)'
            : powered
            ? SIM_KIND_COLOR.powerOn + '1A'
            : p.rungBg,
          transition: 'all 180ms ease',
          cursor: readOnly ? 'default' : 'pointer',
          padding: '4px 6px',
        }}
      >
        <ElementGlyph element={element} powered={powered} color={color} />
        <span
          style={{
            fontFamily: SIM_FONT_MONO,
            fontSize: isPlaceholder ? 9 : 10,
            fontWeight: 700,
            color: isPlaceholder ? '#D97706' : powered ? SIM_KIND_COLOR.powerOn : color,
            lineHeight: 1,
          }}
        >
          {label}
        </span>
        <span style={{ fontFamily: SIM_FONT_MONO, fontSize: 8.5, color: isPlaceholder ? '#B45309' : p.muted, lineHeight: 1 }}>
          {isPlaceholder ? 'Lengkapi' : element.alias || addressLabel}
        </span>
      </button>

      {!isSimulating && !readOnly && (
        <div className="absolute -right-2 -top-2 hidden items-center gap-1 group-hover:flex z-10">
          {isPlaceholder && onRestore && (
            <button
              onClick={(e) => { e.stopPropagation(); onRestore(); }}
              title="Pulihkan komponen asli"
              className="flex h-5 w-5 items-center justify-center rounded-full text-white bg-blue-600 hover:bg-blue-700 shadow-sm"
            >
              <RotateCcw size={10} />
            </button>
          )}
          {!isPlaceholder && isTeacher && onMakePlaceholder && (
            <button
              onClick={(e) => { e.stopPropagation(); onMakePlaceholder(); }}
              title="Kosongkan komponen ini (jadikan bagian soal siswa)"
              className="flex h-5 w-5 items-center justify-center rounded-full text-white bg-amber-500 hover:bg-amber-600 shadow-sm"
            >
              <Scissors size={10} />
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            title="Hapus"
            className="flex h-5 w-5 items-center justify-center rounded-full text-white shadow-sm"
            style={{ backgroundColor: SIM_KIND_COLOR.delete }}
          >
            <Trash2 size={10} />
          </button>
        </div>
      )}
    </div>
  );
}

function FillPlaceholderDialog({
  rungId,
  element,
  onClose,
  onApply,
}: {
  rungId: string;
  element: LadderElement;
  onClose: () => void;
  onApply: (spec: any) => void;
}) {
  const isDark = useSimIsDark();
  const p = simPalette(isDark);
  void rungId; // passed for context but not used in UI
  const isOut = (element as any).placeholderType === 'COIL';

  const [type, setType] = useState<'NO' | 'NC' | 'COIL' | 'SET' | 'RESET'>(isOut ? 'COIL' : 'NO');
  const [addrType, setAddrType] = useState<AddressType>(isOut ? 'O' : 'I');
  const [addrNumber, setAddrNumber] = useState(1);

  const handleApply = () => {
    const at = { gridX: element.gridX ?? 0, gridY: element.gridY ?? 0 };
    if (type === 'NO' || type === 'NC') {
      onApply({
        kind: 'CONTACT',
        mode: type,
        address: { type: addrType, number: addrNumber },
        at,
      });
    } else {
      onApply({
        kind: 'COIL',
        coilMode: type === 'COIL' ? 'NORMAL' : type === 'SET' ? 'SET' : 'RESET',
        address: { type: addrType === 'I' ? 'O' : addrType, number: addrNumber },
        at,
      });
    }
    onClose();
  };

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 420, backgroundColor: p.cardBg, borderRadius: 20, border: `1px solid ${p.border}`, padding: 24, boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: p.text, fontFamily: SIM_FONT_SANS }}>
              Lengkapi Bagian [ KOSONG ]
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: p.muted, fontFamily: SIM_FONT_SANS }}>
              Pilih komponen dan alamat yang sesuai untuk melengkapi rangkaian
            </p>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: p.muted, fontSize: 20, padding: 4 }}>✕</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: p.muted, fontFamily: SIM_FONT_SANS, display: 'block', marginBottom: 8 }}>
              Jenis Komponen
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {!isOut ? (
                <>
                  <button
                    type="button"
                    onClick={() => { setType('NO'); setAddrType('I'); }}
                    style={{
                      padding: '10px 8px', borderRadius: 12, border: `1.5px solid ${type === 'NO' ? '#2563EB' : p.border}`,
                      backgroundColor: type === 'NO' ? 'rgba(37,99,235,0.1)' : 'transparent',
                      color: type === 'NO' ? '#2563EB' : p.text, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    ┤ ├ Kontak NO
                  </button>
                  <button
                    type="button"
                    onClick={() => { setType('NC'); setAddrType('I'); }}
                    style={{
                      padding: '10px 8px', borderRadius: 12, border: `1.5px solid ${type === 'NC' ? '#7C3AED' : p.border}`,
                      backgroundColor: type === 'NC' ? 'rgba(124,58,237,0.1)' : 'transparent',
                      color: type === 'NC' ? '#7C3AED' : p.text, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    ┤/├ Kontak NC
                  </button>
                  <button
                    type="button"
                    onClick={() => { setType('NO'); setAddrType('O'); }}
                    style={{
                      padding: '10px 8px', borderRadius: 12, border: `1.5px solid ${type === 'NO' && addrType === 'O' ? '#059669' : p.border}`,
                      backgroundColor: type === 'NO' && addrType === 'O' ? 'rgba(5,150,105,0.1)' : 'transparent',
                      color: type === 'NO' && addrType === 'O' ? '#059669' : p.text, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    ┤ ├ Kontak Latch (O)
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => { setType('COIL'); setAddrType('O'); }}
                    style={{
                      padding: '10px 8px', borderRadius: 12, border: `1.5px solid ${type === 'COIL' ? '#059669' : p.border}`,
                      backgroundColor: type === 'COIL' ? 'rgba(5,150,105,0.1)' : 'transparent',
                      color: type === 'COIL' ? '#059669' : p.text, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    -( )- Koil Output
                  </button>
                  <button
                    type="button"
                    onClick={() => { setType('SET'); setAddrType('O'); }}
                    style={{
                      padding: '10px 8px', borderRadius: 12, border: `1.5px solid ${type === 'SET' ? '#059669' : p.border}`,
                      backgroundColor: type === 'SET' ? 'rgba(5,150,105,0.1)' : 'transparent',
                      color: type === 'SET' ? '#059669' : p.text, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    -(S)- SET
                  </button>
                  <button
                    type="button"
                    onClick={() => { setType('RESET'); setAddrType('O'); }}
                    style={{
                      padding: '10px 8px', borderRadius: 12, border: `1.5px solid ${type === 'RESET' ? '#DC2626' : p.border}`,
                      backgroundColor: type === 'RESET' ? 'rgba(220,38,38,0.1)' : 'transparent',
                      color: type === 'RESET' ? '#DC2626' : p.text, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    -(R)- RESET
                  </button>
                </>
              )}
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: p.muted, fontFamily: SIM_FONT_SANS, display: 'block', marginBottom: 8 }}>
              Alamat I/O
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <select
                value={addrType}
                onChange={(e) => setAddrType(e.target.value as AddressType)}
                style={{
                  height: 44, borderRadius: 10, border: `1.5px solid ${p.border}`, backgroundColor: p.inputBg,
                  padding: '0 12px', fontSize: 14, fontFamily: SIM_FONT_MONO, fontWeight: 600, color: p.text, outline: 'none',
                }}
              >
                {!isOut && <option value="I">Input (I)</option>}
                <option value="O">Output (O)</option>
                <option value="M">Memory (M)</option>
              </select>
              <input
                type="number"
                min={1}
                max={32}
                value={addrNumber}
                onChange={(e) => setAddrNumber(Math.max(1, parseInt(e.target.value) || 1))}
                style={{
                  flex: 1, height: 44, borderRadius: 10, border: `1.5px solid ${p.border}`, backgroundColor: p.inputBg,
                  padding: '0 12px', fontSize: 16, fontFamily: SIM_FONT_MONO, fontWeight: 700, color: '#F26B3A', outline: 'none',
                }}
                placeholder="Nomor (mis. 1 untuk I1 atau O1)"
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, paddingTop: 8 }}>
            <button
              onClick={onClose}
              style={{
                flex: 1, height: 44, borderRadius: 12, border: `1.5px solid ${p.border}`, backgroundColor: 'transparent',
                color: p.muted, fontSize: 14, fontWeight: 500, cursor: 'pointer',
              }}
            >
              Batal
            </button>
            <button
              onClick={handleApply}
              style={{
                flex: 2, height: 44, borderRadius: 12, border: 'none', backgroundColor: '#F26B3A',
                color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
              }}
            >
              Pasang Komponen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function RungBlock({
  rungId,
  isSimulating,
  readOnly = false,
  isTeacher = false,
}: {
  rungId: string;
  isSimulating: boolean;
  readOnly?: boolean;
  isTeacher?: boolean;
}) {
  const isDark = useSimIsDark();
  const p = simPalette(isDark);
  const rung = useLadderEditorStore((s) => s.document.rungs[rungId]);
  const rungOrderLength = useLadderEditorStore((s) => s.document.rungOrder.length);
  const placeInRow = useLadderEditorStore((s) => s.placeInRow);
  const removeCell = useLadderEditorStore((s) => s.removeCell);
  const placeOutput = useLadderEditorStore((s) => s.placeOutput);
  const removeOutput = useLadderEditorStore((s) => s.removeOutput);
  const addRow = useLadderEditorStore((s) => s.addRow);
  const deleteRow = useLadderEditorStore((s) => s.deleteRow);
  const deleteRung = useLadderEditorStore((s) => s.deleteRung);
  const updateElement = useLadderEditorStore((s) => s.updateElement);
  const makePlaceholder = useLadderEditorStore((s) => s.makePlaceholder);
  const restorePlaceholder = useLadderEditorStore((s) => s.restorePlaceholder);
  const replacePlaceholderWithSpec = useLadderEditorStore((s) => s.replacePlaceholderWithSpec);
  const doc = useLadderEditorStore((s) => s.document);

  const [editing, setEditing] = useState<{ elementId: string } | null>(null);
  const [fillingPlaceholder, setFillingPlaceholder] = useState<{ elementId: string } | null>(null);

  function allocate(type: AddressType): Address {
    return { type, number: nextAvailableAddress(doc, type) };
  }

  const editingElement = editing ? rung.elements[editing.elementId] : null;
  const fillingElement = fillingPlaceholder ? rung.elements[fillingPlaceholder.elementId] : null;

  // Wire color shared by rail + connecting lines, so contacts read as one
  // continuous circuit instead of separate floating boxes.
  const wireColor = `${p.railColor}66`;

  const handleElementClick = (el: LadderElement) => {
    if (isSimulating || readOnly) return;
    if (el.kind === 'PLACEHOLDER') {
      setFillingPlaceholder({ elementId: el.id });
    } else {
      setEditing({ elementId: el.id });
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'stretch',
        gap: 10,
        borderRadius: 16,
        border: `1px solid ${p.border}`,
        backgroundColor: p.rungBg,
        padding: 12,
      }}
    >
      <div className="flex flex-1 flex-col gap-2">
        {rung.rows.map((row) => (
          <div
            key={row.id}
            style={{ borderLeft: `3px solid ${p.railColor}55` }}
            className="flex items-center pl-2"
          >
            {row.cells.map((elId, idx) => (
              <Fragment key={elId}>
                <div style={{ width: 10, height: 2, backgroundColor: wireColor, flexShrink: 0 }} />
                <ElementBox
                  element={rung.elements[elId]}
                  isSimulating={isSimulating}
                  readOnly={readOnly}
                  isTeacher={isTeacher}
                  onClick={() => handleElementClick(rung.elements[elId])}
                  onDelete={() => removeCell(rungId, row.id, idx)}
                  onMakePlaceholder={() => makePlaceholder(rungId, elId)}
                  onRestore={() => restorePlaceholder(rungId, elId)}
                />
              </Fragment>
            ))}
            <div style={{ flex: 1, minWidth: 10, height: 2, backgroundColor: wireColor }} />
            {!isSimulating && !readOnly && (
              <AddElementMenu
                items={INPUT_ITEMS}
                allocateAddress={allocate}
                onPick={(spec) => placeInRow(rungId, row.id, spec)}
                title="Tambah kontak ke baris ini"
              />
            )}
            {!isSimulating && !readOnly && rung.rows.length > 1 && (
              <button
                onClick={() => deleteRow(rungId, row.id)}
                title="Hapus baris paralel ini"
                className="ml-1 flex h-8 w-8 items-center justify-center rounded-lg hover:opacity-80"
                style={{ color: p.muted }}
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
        {!isSimulating && !readOnly && (
          <button
            onClick={() => addRow(rungId)}
            style={{ color: p.muted, fontFamily: SIM_FONT_MONO }}
            className="flex w-fit items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium hover:opacity-80"
          >
            <Plus size={12} /> Baris paralel (OR)
          </button>
        )}
      </div>

      <div
        style={{ borderLeft: `2px solid ${wireColor}` }}
        className="flex flex-col items-center justify-center gap-1.5 pl-0"
      >
        {rung.outputs.map((elId, idx) => (
          <div key={elId} className="flex items-center">
            <div style={{ width: 12, height: 2, backgroundColor: wireColor, flexShrink: 0 }} />
            <ElementBox
              element={rung.elements[elId]}
              isSimulating={isSimulating}
              readOnly={readOnly}
              isTeacher={isTeacher}
              onClick={() => handleElementClick(rung.elements[elId])}
              onDelete={() => removeOutput(rungId, idx)}
              onMakePlaceholder={() => makePlaceholder(rungId, elId)}
              onRestore={() => restorePlaceholder(rungId, elId)}
            />
          </div>
        ))}
        {!isSimulating && !readOnly && (
          <div className="flex items-center pl-3">
            <AddElementMenu
              items={OUTPUT_ITEMS}
              allocateAddress={allocate}
              onPick={(spec) => placeOutput(rungId, spec)}
              title="Tambah output (coil/timer/counter)"
            />
          </div>
        )}
      </div>

      {!isSimulating && !readOnly && rungOrderLength > 1 && (
        <button
          onClick={() => deleteRung(rungId)}
          title="Hapus rung ini"
          className="flex h-8 w-8 shrink-0 items-center justify-center self-start rounded-lg hover:opacity-80"
          style={{ color: p.muted }}
        >
          <Trash2 size={14} />
        </button>
      )}

      {editingElement && (
        <PropertyDialog
          element={editingElement}
          onClose={() => setEditing(null)}
          onSave={(updates) => updateElement(rungId, editingElement.id, updates)}
          onMakePlaceholder={() => makePlaceholder(rungId, editingElement.id)}
          onRestore={() => restorePlaceholder(rungId, editingElement.id)}
        />
      )}

      {fillingElement && (
        <FillPlaceholderDialog
          rungId={rungId}
          element={fillingElement}
          onClose={() => setFillingPlaceholder(null)}
          onApply={(spec) => replacePlaceholderWithSpec(rungId, fillingElement.id, spec)}
        />
      )}
    </div>
  );
}

export function LadderGrid({
  isSimulating,
  readOnly = false,
  isTeacher = false,
}: {
  isSimulating: boolean;
  readOnly?: boolean;
  isTeacher?: boolean;
}) {
  const isDark = useSimIsDark();
  const p = simPalette(isDark);
  const rungOrder = useLadderEditorStore((s) => s.document.rungOrder);

  return (
    <div
      className="flex h-full flex-col gap-3 overflow-y-auto p-3"
      style={{ backgroundColor: p.workspace }}
    >
      {rungOrder.map((rungId) => (
        <RungBlock
          key={rungId}
          rungId={rungId}
          isSimulating={isSimulating}
          readOnly={readOnly}
          isTeacher={isTeacher}
        />
      ))}
    </div>
  );
}
