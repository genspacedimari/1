export const ADDRESS_MIN = 1;
export const ADDRESS_MAX = 26;

export function isValidAddressNumber(n: number): boolean {
  return Number.isInteger(n) && n >= ADDRESS_MIN && n <= ADDRESS_MAX;
}
