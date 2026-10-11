import { createHmac, timingSafeEqual } from "node:crypto";

type DeveloperTokenPurpose = "tools";
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

function password(): string {
  return process.env.DEVELOPER_PASSWORD?.trim() || "SOFTWARENYRJ";
}

function signingSecret(): string {
  const secret = process.env.DEVELOPER_SESSION_SECRET?.trim() || process.env.STAFF_PASSWORD?.trim();
  if (!secret) throw new Error("Developer sessions are not configured on the server.");
  return secret;
}

function digest(value: string, key: string): Buffer {
  return createHmac("sha256", key).update(value).digest();
}

export function checkDeveloperPassword(candidate: string): boolean {
  return timingSafeEqual(
    digest(candidate, "nyrj-developer-password"),
    digest(password(), "nyrj-developer-password"),
  );
}

export function issueDeveloperToken(purpose: DeveloperTokenPurpose): {
  token: string;
  expiresAt: number;
} {
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  const payload = `${purpose}.${expiresAt}`;
  const signature = digest(payload, signingSecret()).toString("hex");
  return { token: `${payload}.${signature}`, expiresAt };
}

export function verifyDeveloperToken(
  token: string | null | undefined,
  purpose: DeveloperTokenPurpose,
): void {
  if (!token) throw new Error("Unauthorized");
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== purpose) throw new Error("Unauthorized");
  const payload = `${parts[0]}.${parts[1]}`;
  const provided = Buffer.from(parts[2], "hex");
  const expected = digest(payload, signingSecret());
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    throw new Error("Unauthorized");
  }
  const expiresAt = Number(parts[1]);
  if (!Number.isSafeInteger(expiresAt) || Date.now() > expiresAt) {
    throw new Error("Developer session expired. Please sign in again.");
  }
}
