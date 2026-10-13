/**
 * Phase C — section-scoped saves. Given the payload a Studio would send for its
 * edited model and the same payload built from the model it loaded, keep only
 * the top-level keys whose value actually changed. Every Studio PATCH handler
 * merges onto the stored record, so omitted keys keep their stored value and a
 * stale copy of an untouched field can never be resubmitted.
 *
 * Comparison is by JSON value. Keys whose new value is `undefined` are dropped
 * (they cannot be sent as JSON anyway).
 */
export function changedFields<T extends Record<string, unknown>>(next: T, base: T | null | undefined): Partial<T> {
  const out: Partial<T> = {};
  for (const key of Object.keys(next) as Array<keyof T>) {
    const value = next[key];
    if (value === undefined) continue;
    if (!base || JSON.stringify(value) !== JSON.stringify(base[key])) out[key] = value;
  }
  return out;
}
