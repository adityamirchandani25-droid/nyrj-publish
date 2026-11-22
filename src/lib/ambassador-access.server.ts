import { createHash, timingSafeEqual } from "node:crypto";

/** The current shared registration code; rotation invalidates the old one. */
export function checkAmbassadorAccessCode(candidate: string): boolean {
  const expected = (process.env.AMBASSADOR_ACCESS_CODE ?? process.env.AMBASSADOR_PASSWORD)?.trim();
  if (!expected) {
    throw new Error("Ambassador registration is not configured. Please contact NYRJ staff.");
  }
  const left = createHash("sha256").update(candidate.trim(), "utf8").digest();
  const right = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(left, right);
}
