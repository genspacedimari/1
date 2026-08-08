/**
 * Every bit-addressable location in the address system. A single unified
 * type (rather than separate "readable" vs "writable" address types) keeps
 * this scalable — adding Arduino's DIGITAL_PIN/PWM later is one more member
 * of AddressType, not a parallel type hierarchy.
 */
export type AddressType = 'I' | 'O' | 'TIM' | 'CTU' | 'M';

export interface Address {
  type: AddressType;
  number: number; // 1-26 for this version
}

export const ADDRESS_TYPES: AddressType[] = ['I', 'O', 'TIM', 'CTU', 'M'];
