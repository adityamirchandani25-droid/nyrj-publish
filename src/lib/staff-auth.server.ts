// Server-only helpers for staff authentication.
// The staff password lives in process.env.STAFF_PASSWORD and never reaches the client.
// On successful login, we issue a short-lived HMAC token the client stores and
// re-presents on every privileged server call.
import { createHmac, timingSafeEqual } from "crypto";

const TOKEN_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

function getSecret(): string {
  const s = process.env.STAFF_PASSWORD;
  if (!s) throw new Error("Server is missing STAFF_PASSWORD configuration.");
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("hex");
}

const HMAC_KEY = "nyrj-staff-auth-key";

function hmac(s: string): Buffer {
  return createHmac("sha256", HMAC_KEY).update(s).digest();
}

export function checkStaffPassword(password: string): boolean {
  const expected = getSecret();
  return timingSafeEqual(hmac(password), hmac(expected));
}

export function issueStaffToken(): { token: string; expiresAt: number } {
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  const payload = String(expiresAt);
  const token = `${payload}.${sign(payload)}`;
  return { token, expiresAt };
}

export function verifyStaffToken(token: string | undefined | null): void {
  if (!token || typeof token !== "string") throw new Error("Unauthorized");
  const dot = token.indexOf(".");
  if (dot <= 0) throw new Error("Unauthorized");
  const payload = token.slice(0, dot);
  const provided = token.slice(dot + 1);
  const expected = sign(payload);
  const a = Buffer.from(provided, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error("Unauthorized");
  const expiresAt = Number(payload);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) {
    throw new Error("Session expired. Please sign in again.");
  }
}
