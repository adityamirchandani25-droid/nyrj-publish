import { createHash, timingSafeEqual } from "node:crypto";

function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

/**
 * True when the request carries `Authorization: Bearer <secret>` for one of the
 * configured secrets. Secrets are only accepted in the header (never the query
 * string, which ends up in access logs) and are compared in constant time.
 */
export function hasBearerSecret(request: Request, secrets: Array<string | undefined>): boolean {
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return false;
  const provided = digest(header.slice("Bearer ".length));
  let matched = false;
  for (const secret of secrets) {
    if (secret?.trim() && timingSafeEqual(provided, digest(secret))) matched = true;
  }
  return matched;
}

/** Guards scheduled jobs. Returns an error response, or null when authorized. */
export function rejectUnauthorizedCron(
  request: Request,
  secrets: Array<string | undefined> = [process.env.CRON_SECRET],
): Response | null {
  if (!secrets.some((secret) => secret?.trim())) {
    return new Response("Not configured", { status: 500 });
  }
  return hasBearerSecret(request, secrets) ? null : new Response("Unauthorized", { status: 401 });
}
