import type { AddressType } from '@/simulator/types/address';
import type { EditorDocument } from '@/simulator/editor/types';

/**
 * Picks the smallest unused address number (1-26) of the given type across
 * the whole document, so adding a component never forces an address-picker
 * dialog up front — the user can still change it afterward via the
 * properties dialog (double-click).
 */
export function nextAvailableAddress(doc: EditorDocument, type: AddressType): number {
  const used = new Set<number>();
  for (const rungId of doc.rungOrder) {
    for (const el of Object.values(doc.rungs[rungId].elements)) {
      if ('address' in el && el.address?.type === type) used.add(el.address.number);
    }
  }
  for (let n = 1; n <= 26; n++) {
    if (!used.has(n)) return n;
  }
  return 26; // every address of this type is in use — reuse the last one rather than throw
}
