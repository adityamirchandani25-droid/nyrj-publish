// Server-only helpers for ambassador auth.
// The shared ambassador password lives only in the AMBASSADOR_PASSWORD
// environment secret — never as a literal in the source tree.
import { timingSafeEqual, createHash } from "crypto";

function ambassadorPassword(): string {
  const p = process.env.AMBASSADOR_PASSWORD;
  if (!p)
    throw new Error("Ambassador sign-in is not configured. Please contact NYRJINFO@Gmail.com.");
  return p;
}

function h(s: string): Buffer {
  return createHash("sha256").update(s, "utf8").digest();
}

export function checkAmbassadorPassword(input: string): boolean {
  if (typeof input !== "string" || input.length === 0) return false;
  return timingSafeEqual(h(input), h(ambassadorPassword()));
}

export function assertAmbassador(input: string): void {
  if (!checkAmbassadorPassword(input)) {
    throw new Error("Incorrect ambassador password.");
  }
}
