import type { Address, AddressType } from '@/simulator/types/address';
import type { LadderElement, LadderProject } from '@/simulator/types/ladder';

/**
 * Phase 5.5 — Cross Reference.
 *
 * Read-only over an already-loaded `LadderProject` (the same JSON
 * `parseLadder` already consumes) — no changes to the parser or the
 * compiled runtime tree needed, since every usage site (address ->
 * elements) is already sitting in `project.rungs[].elements[].address`.
 * This just indexes what's already there.
 */

export type CrossRefRole = 'read' | 'write' | 'block';

export interface CrossRefUsage {
  rungId: string;
  elementId: string;
  kind: LadderElement['kind'];
  /** 'read' — a CONTACT reading this bit/done-bit.
   *  'write' — a COIL writing this bit.
   *  'block' — the TIMER/COUNTER instance that OWNS this TIM/CTU address
   *   (its Preset/Current Value/Done Bit all live here — this is "Find
   *   Definition" for a TIM/CTU address; a CONTACT reading that same
   *   address elsewhere is "Find Usage"). */
  role: CrossRefRole;
  comment?: string;
}

function addressKey(address: Address): string {
  return `${address.type}${address.number}`;
}

/** Builds a full address -> usages index for the whole project in one
 * pass. Prefer this over calling `findUsages` in a loop when the Debugger
 * needs to answer "list every address that's used" (e.g. for a Watch
 * Window's address picker). */
export function buildCrossReferenceIndex(project: LadderProject): Map<string, CrossRefUsage[]> {
  const index = new Map<string, CrossRefUsage[]>();

  const push = (address: Address, usage: CrossRefUsage) => {
    const key = addressKey(address);
    const list = index.get(key) ?? [];
    list.push(usage);
    index.set(key, list);
  };

  for (const rung of project.rungs) {
    for (const el of rung.elements) {
      if (el.kind === 'CONTACT') {
        push(el.address, { rungId: rung.id, elementId: el.id, kind: el.kind, role: 'read', comment: el.comment });
      } else if (el.kind === 'COIL') {
        push(el.address, { rungId: rung.id, elementId: el.id, kind: el.kind, role: 'write', comment: el.comment });
      } else if (el.kind === 'TIMER') {
        push(el.address, { rungId: rung.id, elementId: el.id, kind: el.kind, role: 'block', comment: el.comment });
        if (el.resetAddress) {
          push(el.resetAddress, { rungId: rung.id, elementId: el.id, kind: el.kind, role: 'read', comment: 'RES input' });
        }
      } else if (el.kind === 'COUNTER') {
        push(el.address, { rungId: rung.id, elementId: el.id, kind: el.kind, role: 'block', comment: el.comment });
        if (el.resetAddress) {
          push(el.resetAddress, { rungId: rung.id, elementId: el.id, kind: el.kind, role: 'read', comment: 'RES input' });
        }
      }
    }
  }

  return index;
}

/** Find Usage / Find Definition for one specific address, e.g.
 * `findUsages(project, { type: 'O', number: 1 })` for "Q1" (Omron-style
 * output naming maps directly onto this engine's `O` address type). */
export function findUsages(project: LadderProject, address: Address): CrossRefUsage[] {
  return buildCrossReferenceIndex(project).get(addressKey(address)) ?? [];
}

/** Parses a human-typed address like "Q1", "I3", "M10", "T2", "C5" into
 * this engine's `{ type, number }` shape, for a Cross Reference search box.
 * Accepts both the Omron-flavored letters the brief uses (Q for output, T
 * for timer, C for counter) and the engine's own type strings. */
export function parseAddressLabel(label: string): Address | null {
  const match = /^\s*([A-Za-z]+)\s*(\d+)\s*$/.exec(label);
  if (!match) return null;
  const [, rawType, rawNumber] = match;
  const number = Number(rawNumber);
  const upper = rawType.toUpperCase();
  const aliasMap: Record<string, AddressType> = {
    I: 'I',
    Q: 'O',
    O: 'O',
    M: 'M',
    T: 'TIM',
    TIM: 'TIM',
    C: 'CTU',
    CTU: 'CTU',
  };
  const type = aliasMap[upper];
  if (!type) return null;
  return { type, number };
}
