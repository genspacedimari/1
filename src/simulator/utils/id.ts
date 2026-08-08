let counter = 0;

/** Cheap, dependency-free id generator — good enough for editor-created
 * elements; swap for crypto.randomUUID() later if global uniqueness across
 * devices ever matters (e.g. collaborative editing). */
export function generateId(prefix = 'el'): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter}`;
}
