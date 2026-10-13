/**
 * Escapes LIKE/ILIKE wildcards so a value such as `first_last@school.org` only
 * matches itself. PostgREST also treats `*` as `%`, so callers that compare
 * identities must still confirm the exact match with `sameEmail`.
 */
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export function normalizeEmail(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

/** Case-insensitive exact email comparison. Empty values never match. */
export function sameEmail(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = normalizeEmail(a);
  return left !== "" && left === normalizeEmail(b);
}
