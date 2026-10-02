// Server-only helpers for the peer review system.
// - Reviewer passwords are hashed with PBKDF2-SHA256 (WebCrypto, worker-safe).
// - Reviewer sessions use a short-lived HMAC token, same shape as staff tokens.
import { createHmac, timingSafeEqual } from "crypto";
import { MASTER_STAFF_EMAILS } from "./staff-recipients";

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

export function verifyResetToken(token: string | undefined | null): {
  reviewerId: string;
  expiresAt: number;
  signature: string;
} {
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
 *  - after the 15-day deadline, close the assignment as no-response, record
 *    it in paper history, and alert staff to assign somebody else
 * Each reviewer is reminded at most once per assignment per stage.
 */
export async function runReviewReminders(): Promise<{
  inviteReminders: number;
  reviewReminders: number;
  noResponses: number;
  staffDeadlineAlerts: number;
}> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { sendTemplateEmail, sendTemplateEmailToMany } =
    await import("./email-templates/send-email");
  const SITE_URL = "https://nyrj.org";
  const now = Date.now();
  const days = (n: number) => new Date(now - n * 24 * 60 * 60 * 1000).toISOString();
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  const reminderColumns =
    "id, submission_id, reviewer_email, reviewer_name, status, assigned_at, due_at, responded_at, invite_token, review_submitted_at, invite_reminder_sent_at, review_reminder_sent_at, no_response_notified_at";
  const [activeResult, retryResult] = await Promise.all([
    supabaseAdmin
      .from("review_assignments")
      .select(reminderColumns)
      .in("status", ["invited", "accepted"])
      .order("due_at", { ascending: true })
      .limit(300),
    supabaseAdmin
      .from("review_assignments")
      .select(reminderColumns)
      .eq("status", "no_response")
      .is("no_response_notified_at", null)
      .order("due_at", { ascending: true })
      .limit(300),
  ]);
  if (activeResult.error) throw new Error(activeResult.error.message);
  if (retryResult.error) throw new Error(retryResult.error.message);
  const rows = [...(activeResult.data ?? []), ...(retryResult.data ?? [])];

  const list = (rows ?? []) as Array<{
    id: string;
    submission_id: string;
    reviewer_email: string;
    reviewer_name: string;
    status: string;
    assigned_at: string;
    due_at: string;
    responded_at: string | null;
    invite_token: string;
    review_submitted_at: string | null;
    invite_reminder_sent_at: string | null;
    review_reminder_sent_at: string | null;
    no_response_notified_at: string | null;
  }>;

  let inviteReminders = 0;
  let reviewReminders = 0;
  let noResponses = 0;
  let staffDeadlineAlerts = 0;

  for (const r of list) {
    let status = r.status;
    const acceptedInvitation = Boolean(r.responded_at);
    const deadlinePassed =
      status !== "no_response" && Boolean(r.due_at) && Date.parse(r.due_at) <= now;

    const { data: sub } = await supabaseAdmin
      .from("manuscript_submissions")
      .select("title")
      .eq("id", r.submission_id)
      .single();
    const title = (sub as { title?: string } | null)?.title ?? "the assigned manuscript";

    if (deadlinePassed) {
      const { data: expired, error: expireError } = await supabaseAdmin
        .from("review_assignments")
        .update({ status: "no_response" } as never)
        .eq("id", r.id)
        .in("status", ["invited", "accepted"])
        .select("id")
        .maybeSingle();
      if (expireError) {
        console.error("[server] reviewer deadline update failed:", expireError);
        continue;
      }
      if (expired) {
        status = "no_response";
        noResponses++;
        await audit(
          r.submission_id,
          "system",
          "No response after 15 days",
          acceptedInvitation
            ? `${r.reviewer_email} accepted but did not submit a review by ${fmt(r.due_at)}`
            : `${r.reviewer_email} did not respond by ${fmt(r.due_at)}`,
        );
      } else {
        // Another invocation already handled this row. Do not send a late
        // reminder from stale data.
        continue;
      }
    }

    if (status === "no_response") {
      if (r.no_response_notified_at) continue;
      try {
        await sendTemplateEmailToMany("reviewer-no-response", MASTER_STAFF_EMAILS, (to) => ({
          idempotencyKey: `reviewer-no-response-${r.id}-${to}`,
          replyTo: "NYRJINFO@gmail.com",
          templateData: {
            reviewerName: r.reviewer_name || "Reviewer",
            reviewerEmail: r.reviewer_email,
            title,
            submissionId: r.submission_id,
            dueDate: r.due_at ? fmt(r.due_at) : "",
            acceptedInvitation,
            dashboardUrl: `${SITE_URL}/admin/submissions`,
          },
        }));
        const notifiedAt = new Date().toISOString();
        const { error: notifiedError } = await supabaseAdmin
          .from("review_assignments")
          .update({ no_response_notified_at: notifiedAt } as never)
          .eq("id", r.id)
          .is("no_response_notified_at", null);
        if (notifiedError) throw new Error(notifiedError.message);
        staffDeadlineAlerts++;
        await audit(
          r.submission_id,
          "system",
          "Staff notified of reviewer no response",
          `Deadline alert sent to ${MASTER_STAFF_EMAILS.length} staff recipients`,
        );
      } catch (error) {
        console.error("[server] reviewer deadline staff alert failed:", error);
        await audit(
          r.submission_id,
          "system",
          "Reviewer no-response alert failed",
          "The daily job will retry the staff email.",
        );
      }
      continue;
    }

    const awaitingResponse = status === "invited";
    const overdue = awaitingResponse
      ? !r.invite_reminder_sent_at && r.assigned_at < days(7)
      : !r.review_reminder_sent_at && !r.review_submitted_at && r.assigned_at < days(10);
    if (!overdue) continue;

    try {
      await sendTemplateEmail("reviewer-reminder", r.reviewer_email, {
        idempotencyKey: `reviewer-reminder-${r.id}-${awaitingResponse ? "invite" : "review"}`,
        replyTo: "NYRJINFO@gmail.com",
        templateData: {
          reviewerName: r.reviewer_name || "Reviewer",
          title,
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

  return { inviteReminders, reviewReminders, noResponses, staffDeadlineAlerts };
}
