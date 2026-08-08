import type { Address, AddressType } from '@/simulator/types/address';
import { isValidAddressNumber } from '@/simulator/models/addressRanges';

const ADDRESS_PATTERN = /^(I|O|TIM|CTU|M)(\d{1,2})$/;

/** Parses a raw address string like "I7", "TIM12", "CTU3", "M26". */
export function parseAddress(raw: string): Address {
  const match = ADDRESS_PATTERN.exec(raw.trim().toUpperCase());
  if (!match) {
    throw new Error(
      `Invalid address format: "${raw}". Expected e.g. I1, O26, TIM3, CTU10, M5.`
    );
  }
  const [, type, numStr] = match;
  const number = parseInt(numStr, 10);
  if (!isValidAddressNumber(number)) {
    throw new Error(`Address number out of range (1-26): "${raw}".`);
  }
  return { type: type as AddressType, number };
}

export function formatAddress(address: Address): string {
  return `${address.type}${address.number}`;
}
