/**
 * RFC-7386-style JSON merge patch, as specified by API_CONTRACT.md for `partial` events:
 *
 *   - Objects merge recursively.
 *   - Arrays in the patch REPLACE the target array (no index merging).
 *   - A `null` value deletes the key.
 *   - Scalars overwrite.
 *
 * Used only for perceived progress while streaming; the final `complete.trip` is
 * authoritative and replaces the working copy. We treat the working trip as a loose
 * partial during the stream, so this is intentionally untyped (`unknown` in/out).
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
