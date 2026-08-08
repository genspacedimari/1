import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useLadderEditorStore } from '@/stores/ladderEditorStore';
import { usePlcStore } from '@/stores/plcStore';
import type { Address, AddressType } from '@/simulator/types/address';
import type { LadderElement } from '@/simulator/types/ladder';
import { nextAvailableAddress } from '../utils/addressAllocation';
import { AddElementMenu, INPUT_ITEMS, OUTPUT_ITEMS } from './ComponentPalette';
import { PropertyDialog } from './PropertyDialog';
import { simPalette, SIM_KIND_COLOR, SIM_FONT_MONO, useSimIsDark } from '../theme';

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
  onClick,
  onDelete,
}: {
  element: LadderElement;
  isSimulating: boolean;
  onClick: () => void;
  onDelete: () => void;
}) {
  const isDark = useSimIsDark();
  const p = simPalette(isDark);
  const powered = usePlcStore((s) => (isSimulating ? !!s.poweredElements[element.id] : false));
  const color = elementColor(element);

  const label = (() => {
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
        title="Klik untuk edit — alamat, komentar, alias"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
          height: 56,
          minWidth: 64,
          borderRadius: 10,
          border: `1.5px solid ${powered ? SIM_KIND_COLOR.powerOn : color + '55'}`,
          backgroundColor: powered ? SIM_KIND_COLOR.powerOn + '1A' : p.rungBg,
          transition: 'all 180ms ease',
          cursor: 'pointer',
          padding: '4px 6px',
        }}
      >
        <ElementGlyph element={element} powered={powered} color={color} />
        <span
          style={{
            fontFamily: SIM_FONT_MONO,
            fontSize: 10,
            fontWeight: 700,
            color: powered ? SIM_KIND_COLOR.powerOn : color,
            lineHeight: 1,
          }}
        >
          {label}
        </span>
        <span style={{ fontFamily: SIM_FONT_MONO, fontSize: 9, color: p.muted, lineHeight: 1 }}>
          {element.alias || addressLabel}
        </span>
      </button>
      {!isSimulating && (
        <button
          onClick={onDelete}
          title="Hapus"
          className="absolute -right-1.5 -top-1.5 hidden h-4 w-4 items-center justify-center rounded-full text-white group-hover:flex"
          style={{ backgroundColor: SIM_KIND_COLOR.delete }}
        >
          <Trash2 size={10} />
        </button>
      )}
    </div>
  );
}

function RungBlock({ rungId, isSimulating }: { rungId: string; isSimulating: boolean }) {
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
  const doc = useLadderEditorStore((s) => s.document);

  const [editing, setEditing] = useState<{ elementId: string } | null>(null);

  function allocate(type: AddressType): Address {
    return { type, number: nextAvailableAddress(doc, type) };
  }

  const editingElement = editing ? rung.elements[editing.elementId] : null;

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
            className="flex items-center gap-1.5 pl-2"
          >
            {row.cells.map((elId, idx) => (
              <ElementBox
                key={elId}
                element={rung.elements[elId]}
                isSimulating={isSimulating}
                onClick={() => !isSimulating && setEditing({ elementId: elId })}
                onDelete={() => removeCell(rungId, row.id, idx)}
              />
            ))}
            {!isSimulating && (
              <AddElementMenu
                items={INPUT_ITEMS}
                allocateAddress={allocate}
                onPick={(spec) => placeInRow(rungId, row.id, spec)}
                title="Tambah kontak ke baris ini"
              />
            )}
            {!isSimulating && rung.rows.length > 1 && (
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
        {!isSimulating && (
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
        style={{ borderLeft: `1px solid ${p.border}` }}
        className="flex flex-col items-center justify-center gap-1.5 pl-3"
      >
        {rung.outputs.map((elId, idx) => (
          <ElementBox
            key={elId}
            element={rung.elements[elId]}
            isSimulating={isSimulating}
            onClick={() => !isSimulating && setEditing({ elementId: elId })}
            onDelete={() => removeOutput(rungId, idx)}
          />
        ))}
        {!isSimulating && (
          <AddElementMenu
            items={OUTPUT_ITEMS}
            allocateAddress={allocate}
            onPick={(spec) => placeOutput(rungId, spec)}
            title="Tambah output (coil/timer/counter)"
          />
        )}
      </div>

      {!isSimulating && rungOrderLength > 1 && (
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
        />
      )}
    </div>
  );
}

export function LadderGrid({ isSimulating }: { isSimulating: boolean }) {
  const isDark = useSimIsDark();
  const p = simPalette(isDark);
  const rungOrder = useLadderEditorStore((s) => s.document.rungOrder);

  return (
    <div
      className="flex h-full flex-col gap-3 overflow-y-auto p-3"
      style={{ backgroundColor: p.workspace }}
    >
      {rungOrder.map((rungId) => (
        <RungBlock key={rungId} rungId={rungId} isSimulating={isSimulating} />
      ))}
    </div>
  );
}
