// Server-only helpers for the peer review system.
// - Reviewer passwords are hashed with PBKDF2-SHA256 (WebCrypto, worker-safe).
// - Reviewer sessions use a short-lived HMAC token, same shape as staff tokens.
import { createHmac, timingSafeEqual } from "crypto";

const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 days
const PBKDF2_ITERATIONS = 100_000;

function secret(): string {
  const s = process.env.STAFF_PASSWORD;
  if (!s) throw new Error("Server is missing STAFF_PASSWORD configuration.");
  return s;
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function newSalt(): string {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return Array.from(a)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function newToken(): string {
  const a = new Uint8Array(24);
  crypto.getRandomValues(a);
  return Array.from(a)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashPassword(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: enc.encode(salt), iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    key,
    256,
  );
  return toHex(bits);
}

export async function verifyPassword(
  password: string,
  salt: string,
  expectedHash: string,
): Promise<boolean> {
  const actual = await hashPassword(password, salt);
  const a = Buffer.from(actual, "hex");
  const b = Buffer.from(expectedHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

export function issueReviewerToken(reviewerId: string): { token: string; expiresAt: number } {
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  const payload = `${reviewerId}:${expiresAt}`;
  return { token: `${payload}.${sign(payload)}`, expiresAt };
}

const RESET_TTL_MS = 1000 * 60 * 60; // 1 hour

/** Password-reset link token. Bound to the current password hash so it is single-use. */
export function issueResetToken(reviewerId: string, currentHash: string): string {
  const expiresAt = Date.now() + RESET_TTL_MS;
  const payload = `${reviewerId}:${expiresAt}`;
  return `${payload}.${sign(`reset:${payload}:${currentHash}`)}`;
}

export function verifyResetToken(
  token: string | undefined | null,
): { reviewerId: string; expiresAt: number; signature: string } {
  if (!token || typeof token !== "string") throw new Error("This reset link is not valid.");
  const dot = token.lastIndexOf(".");
  if (dot <= 0) throw new Error("This reset link is not valid.");
  const payload = token.slice(0, dot);
  const [reviewerId, expiresRaw] = payload.split(":");
  const expiresAt = Number(expiresRaw);
  if (!reviewerId || !Number.isFinite(expiresAt)) throw new Error("This reset link is not valid.");
  if (Date.now() > expiresAt)
    throw new Error("This reset link has expired. Please request a new one.");
  return { reviewerId, expiresAt, signature: token.slice(dot + 1) };
}

/** Confirms the token signature against the stored password hash. */
export function resetTokenMatches(
  reviewerId: string,
  expiresAt: number,
  signature: string,
  currentHash: string,
): boolean {
  const expected = Buffer.from(sign(`reset:${reviewerId}:${expiresAt}:${currentHash}`), "hex");
  const provided = Buffer.from(signature, "hex");
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

/** Returns the reviewer id encoded in the token, or throws. */
export function verifyReviewerToken(token: string | undefined | null): string {
  if (!token || typeof token !== "string") throw new Error("Unauthorized");
  const dot = token.lastIndexOf(".");
  if (dot <= 0) throw new Error("Unauthorized");
  const payload = token.slice(0, dot);
  const provided = Buffer.from(token.slice(dot + 1), "hex");
  const expected = Buffer.from(sign(payload), "hex");
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    throw new Error("Unauthorized");
  }
  const [reviewerId, expiresRaw] = payload.split(":");
  const expiresAt = Number(expiresRaw);
  if (!reviewerId || !Number.isFinite(expiresAt) || Date.now() > expiresAt) {
    throw new Error("Your reviewer session expired. Please sign in again.");
  }
  return reviewerId;
}

const MIME: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
  csv: "text/csv",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  zip: "application/zip",
};

/**
 * Gathers the manuscript and supplementary files for a reviewer email:
 * attaches them (up to ~18 MB total) and always returns 30-day download links.
 * Consent forms are excluded — they contain participants' personal data.
 */
export async function buildReviewerFiles(submissionId: string): Promise<{
  attachments: { filename: string; content: string; type: string }[];
  files: { filename: string; url: string; description: string }[];
}> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: sub } = await supabaseAdmin
    .from("manuscript_submissions")
    .select("manuscript_path, manuscript_filename, supplementary_paths")
    .eq("id", submissionId)
    .single();
  const s = (sub ?? {}) as {
    manuscript_path?: string;
    manuscript_filename?: string;
    supplementary_paths?: unknown;
  };
  const list: { path: string; filename: string; description: string }[] = [];
  if (s.manuscript_path)
    list.push({
      path: s.manuscript_path,
      filename: s.manuscript_filename || "manuscript",
      description: "Manuscript",
    });
  if (Array.isArray(s.supplementary_paths)) {
    for (const f of s.supplementary_paths as Array<{
      path?: string;
      filename?: string;
      description?: string;
    }>) {
      if (f?.path)
        list.push({
          path: f.path,
          filename: f.filename || "supplementary-file",
          description: f.description || "Supplementary file",
        });
    }
  }

  const attachments: { filename: string; content: string; type: string }[] = [];
  const files: { filename: string; url: string; description: string }[] = [];
  let total = 0;
  const LIMIT = 18 * 1024 * 1024;
  for (const f of list) {
    const { data: signed } = await supabaseAdmin.storage
      .from("submissions")
      .createSignedUrl(f.path, 60 * 60 * 24 * 30, { download: f.filename });
    if (signed?.signedUrl)
      files.push({ filename: f.filename, url: signed.signedUrl, description: f.description });
    try {
      const { data: blob } = await supabaseAdmin.storage.from("submissions").download(f.path);
      if (!blob) continue;
      const buf = Buffer.from(await blob.arrayBuffer());
      if (total + buf.length > LIMIT) continue;
      total += buf.length;
      const ext = f.filename.split(".").pop()?.toLowerCase() ?? "";
      attachments.push({
        filename: f.filename,
        content: buf.toString("base64"),
        type: MIME[ext] || blob.type || "application/octet-stream",
      });
    } catch (e) {
      console.error("[server] could not attach file:", e);
    }
  }
  return { attachments, files };
}

export async function audit(
  submissionId: string | null,
  actor: string,
  action: string,
  detail = "",
): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("review_audit_log")
      .insert({ submission_id: submissionId, actor, action, detail } as never);
  } catch (e) {
    console.error("[server] audit log failed:", e);
  }
}

/**
 * Gentle follow-ups:
 *  - no response 7 days after the invitation was sent
 *  - accepted but no review 10 days after assignment
 * Each reviewer is reminded at most once per assignment per stage.
 */
export async function runReviewReminders(): Promise<{
  inviteReminders: number;
  reviewReminders: number;
}> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { sendTemplateEmail } = await import("./email-templates/send-email");
  const SITE_URL = "https://nyrj.org";
  const now = Date.now();
  const days = (n: number) => new Date(now - n * 24 * 60 * 60 * 1000).toISOString();
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  const { data: rows } = await supabaseAdmin
    .from("review_assignments")
    .select(
      "id, submission_id, reviewer_email, reviewer_name, status, assigned_at, due_at, invite_token, review_submitted_at, invite_reminder_sent_at, review_reminder_sent_at",
    )
    .in("status", ["invited", "accepted"])
    .limit(300);

  const list = (rows ?? []) as Array<{
    id: string;
    submission_id: string;
    reviewer_email: string;
    reviewer_name: string;
    status: string;
    assigned_at: string;
    due_at: string;
    invite_token: string;
    review_submitted_at: string | null;
    invite_reminder_sent_at: string | null;
    review_reminder_sent_at: string | null;
  }>;

  let inviteReminders = 0;
  let reviewReminders = 0;

  for (const r of list) {
    const awaitingResponse = r.status === "invited";
    const overdue = awaitingResponse
      ? !r.invite_reminder_sent_at && r.assigned_at < days(7)
      : !r.review_reminder_sent_at && !r.review_submitted_at && r.assigned_at < days(10);
    if (!overdue) continue;

    const { data: sub } = await supabaseAdmin
      .from("manuscript_submissions")
      .select("title")
      .eq("id", r.submission_id)
      .single();

    try {
      await sendTemplateEmail("reviewer-reminder", r.reviewer_email, {
        idempotencyKey: `reviewer-reminder-${r.id}-${awaitingResponse ? "invite" : "review"}`,
        replyTo: "NYRJINFO@gmail.com",
        templateData: {
          reviewerName: r.reviewer_name || "Reviewer",
          title: (sub as { title?: string } | null)?.title ?? "your assigned manuscript",
          dueDate: r.due_at ? fmt(r.due_at) : "",
          inviteUrl: `${SITE_URL}/review?token=${r.invite_token}`,
          awaitingResponse,
        },
      });
      await supabaseAdmin
        .from("review_assignments")
        .update(
          (awaitingResponse
            ? { invite_reminder_sent_at: new Date().toISOString() }
            : { review_reminder_sent_at: new Date().toISOString() }) as never,
        )
        .eq("id", r.id);
      if (awaitingResponse) inviteReminders++;
      else reviewReminders++;
      await audit(
        r.submission_id,
        "system",
        "Reminder email sent",
        `To ${r.reviewer_email} · ${awaitingResponse ? "no response yet (7 days)" : "review pending (10 days)"}`,
      );
    } catch (e) {
      console.error("[server] reviewer reminder failed:", e);
    }
  }

  return { inviteReminders, reviewReminders };
}
