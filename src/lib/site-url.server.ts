const PRODUCTION_SITE_URL = "https://nyrj.org";

/**
 * Returns a safe origin for links sent by server-side email jobs. A stale
 * localhost deployment variable must never leak into a production email.
 */
export function publicSiteUrl(): string {
  const configured = process.env.PUBLIC_SITE_URL?.trim();
  if (!configured) return PRODUCTION_SITE_URL;

  try {
    const url = new URL(configured);
    const host = url.hostname.toLowerCase();
    const localHost =
      ["localhost", "0.0.0.0", "[::1]"].includes(host) ||
      host.startsWith("127.") ||
      host.endsWith(".localhost") ||
      host.endsWith(".local");
    if (url.protocol !== "https:" || localHost || url.username || url.password)
      return PRODUCTION_SITE_URL;
    return url.origin;
  } catch {
    return PRODUCTION_SITE_URL;
  }
}
