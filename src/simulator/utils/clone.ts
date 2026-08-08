/** Deep-clones plain JSON-like state. Prefers the native structuredClone
 * (Node 17+, all modern browsers) and falls back to JSON round-tripping. */
export function deepClone<T>(value: T): T {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}
