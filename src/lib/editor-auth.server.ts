// Server-only helpers for editor (initial reviewer) accounts.
// Passwords reuse the PBKDF2 helpers from the peer-review module; sessions are
// short-lived HMAC tokens, namespaced so an editor token can never be mistaken
// for a reviewer or staff token.
import { createHmac, timingSafeEqual } from "crypto";

const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

function secret(): string {
  const s = process.env.STAFF_PASSWORD;
  if (!s) throw new Error("Server is missing STAFF_PASSWORD configuration.");
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(`editor:${payload}`).digest("hex");
}

export function issueEditorToken(editorId: string): { token: string; expiresAt: number } {
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  const payload = `${editorId}:${expiresAt}`;
  return { token: `${payload}.${sign(payload)}`, expiresAt };
}

export function verifyEditorToken(token: string | undefined | null): string {
  if (!token || typeof token !== "string") throw new Error("Unauthorized");
  const dot = token.lastIndexOf(".");
  if (dot <= 0) throw new Error("Unauthorized");
  const payload = token.slice(0, dot);
  const provided = Buffer.from(token.slice(dot + 1), "hex");
  const expected = Buffer.from(sign(payload), "hex");
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    throw new Error("Unauthorized");
  }
  const [editorId, expiresRaw] = payload.split(":");
  const expiresAt = Number(expiresRaw);
  if (!editorId || !Number.isFinite(expiresAt) || Date.now() > expiresAt) {
    throw new Error("Your editor session expired. Please sign in again.");
  }
  return editorId;
}

export type EditorIdentity = { id: string; name: string; email: string };

/** Resolves an editor token to an approved, active editor account. */
export async function requireEditor(token: string): Promise<EditorIdentity> {
  const id = verifyEditorToken(token);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("editor_accounts")
    .select("id, name, email, status")
    .eq("id", id)
    .maybeSingle();
  const row = data as { id: string; name: string; email: string; status: string } | null;
  if (!row) throw new Error("Unauthorized");
  if (row.status !== "approved") {
    throw new Error("Your editor account is awaiting approval by our editorial staff.");
  }
  return { id: row.id, name: row.name, email: row.email };
}

/** Random URL-safe token used for author resubmission links. */
export function newResubmitToken(): string {
  const a = new Uint8Array(24);
  crypto.getRandomValues(a);
  return Array.from(a)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
