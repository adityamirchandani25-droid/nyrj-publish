/**
 * Returns the URL only when it is an absolute http(s) link. Anything else
 * (javascript:, data:, relative or malformed values) yields null so it is
 * never rendered as a clickable href.
 */
export function safeHttpUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}
