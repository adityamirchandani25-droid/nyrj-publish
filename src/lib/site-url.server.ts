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
    const localHost = ["localhost", "127.0.0.1", "0.0.0.0"].includes(url.hostname);
    const production = process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);
    if (production && localHost) return PRODUCTION_SITE_URL;
    return url.origin;
  } catch {
    return PRODUCTION_SITE_URL;
  }
}
