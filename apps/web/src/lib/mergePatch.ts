/**
 * RFC-7386-style JSON merge patch, as specified by API_CONTRACT.md for `partial` events:
 *
 *   - Objects merge recursively.
 *   - Arrays in the patch replace the target array (no index merging).
 *   - A `null` value deletes the key.
 *   - Scalars overwrite.
 *
 * Only used for progress while streaming. The final `complete.trip` replaces the working
 * copy, which is why this is untyped (`unknown` in/out).
 */
function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function applyMergePatch<T>(target: T, patch: unknown): T {
  if (!isPlainObject(patch)) {
    // A non-object patch replaces the target wholesale.
    return patch as T;
  }

  const base: Record<string, unknown> = isPlainObject(target) ? { ...target } : {};

  for (const [key, value] of Object.entries(patch)) {
    if (value === null) {
      delete base[key];
    } else if (isPlainObject(value)) {
      base[key] = applyMergePatch(base[key], value);
    } else {
      // Arrays and scalars replace.
      base[key] = value;
    }
  }

  return base as T;
}
