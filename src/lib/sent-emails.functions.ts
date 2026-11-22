import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const ListSchema = z.object({
  staffToken: z.string().min(1),
  search: z.string().trim().max(200).optional(),
  limit: z.number().int().min(1).max(200).optional(),
  offset: z.number().int().min(0).max(100000).optional(),
  status: z.enum(["sent", "failed", "retrying"]).optional(),
});

const RetryOneSchema = z.object({
  staffToken: z.string().min(1),
  id: z.string().uuid(),
});

const RetryFailedSchema = z.object({
  staffToken: z.string().min(1),
  limit: z.number().int().min(1).max(50).optional(),
});

export type SentEmailRow = {
  id: string;
  created_at: string;
  template: string;
  to_email: string;
  subject: string;
  html: string | null;
  text_body: string | null;
  reply_to: string | null;
  status: string;
  error: string | null;
  canRetry?: boolean;
};

export type RetryEmailsResult = {
  attempted: number;
  sent: number;
  failed: number;
};

// These messages update manuscript, assignment, or reminder state when the
// original workflow sends them. Replaying the archive would bypass that state.
const WORKFLOW_EMAILS = new Set([
  "manuscript-submission",
  "submission-confirmation",
  "initial-review-assignment",
  "initial-reviewer-account",
  "reviewer-account-request",
  "reviewer-account-approved",
  "reviewer-response",
  "review-thank-you",
  "reviewer-password-reset",
  "editor-account-approved",
  "author-edits",
  "author-revision-request",
  "author-revision-reminder",
  "author-revision-overdue",
  "editor-recommendation",
  "initial-review-workload",
  "review-received",
  "reviewer-invitation",
  "reviewer-revision",
  "reviewer-reminder",
  "reviewer-no-response",
  "reviewer-followup-staff",
  "revision-received",
  "submission-status",
]);

/** Full archive of every email the site has sent, readable only by signed-in staff. */
export const listSentEmails = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => ListSchema.parse(d))
  .handler(async ({ data }): Promise<SentEmailRow[]> => {
    const { verifyStaffToken } = await import("./staff-auth.server");
    verifyStaffToken(data.staffToken);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("sent_emails")
      .select(
        "id, created_at, template, to_email, subject, html, text_body, reply_to, status, error",
      )
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(data.offset ?? 0, (data.offset ?? 0) + (data.limit ?? 100) - 1);

    if (data.status) q = q.eq("status", data.status);

    const search = data.search?.trim();
    if (search) {
      // Keep punctuation searchable but inert: neutralise LIKE wildcards and
      // quote the value so it can never alter the query structure.
      const cleaned = search.replace(/\s+/g, " ").trim();
      if (cleaned) {
        const escaped = cleaned
          .replace(/\\/g, "\\\\")
          .replace(/[%_]/g, (m) => `\\${m}`)
          .replace(/"/g, '\\"');
        const like = `"%${escaped}%"`;
        q = q.or(`to_email.ilike.${like},subject.ilike.${like},template.ilike.${like}`);
      }
    }

    const { data: rows, error } = await q;
    if (error) {
      console.error("[server] listSentEmails error:", error);
      throw new Error("Could not load the email archive. Please try again.");
    }
    return ((rows ?? []) as SentEmailRow[]).map((row) => ({
      ...row,
      canRetry: row.status === "failed" && !WORKFLOW_EMAILS.has(row.template),
    }));
  });

/** Retries one archived failure using its stored, already-rendered content. */
export const retrySentEmail = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => RetryOneSchema.parse(d))
  .handler(async ({ data }): Promise<RetryEmailsResult> => {
    const { verifyStaffToken } = await import("./staff-auth.server");
    verifyStaffToken(data.staffToken);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("sent_emails")
      .select(
        "id, created_at, template, to_email, subject, html, text_body, reply_to, status, error",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error("Could not load the failed email. Please try again.");
    if (!row) throw new Error("That email record no longer exists.");
    if (row.status !== "failed") return { attempted: 0, sent: 0, failed: 0 };
    if (WORKFLOW_EMAILS.has(row.template)) {
      throw new Error(
        "This message is managed by its manuscript or reviewer workflow. Retry from the paper or let its scheduled job run so delivery status stays accurate.",
      );
    }

    const sent = await retryRow(row as SentEmailRow);
    return { attempted: 1, sent: sent ? 1 : 0, failed: sent ? 0 : 1 };
  });

/** Retries the newest archived failures after a provider credential has been repaired. */
export const retryFailedEmails = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => RetryFailedSchema.parse(d))
  .handler(async ({ data }): Promise<RetryEmailsResult> => {
    const { verifyStaffToken } = await import("./staff-auth.server");
    verifyStaffToken(data.staffToken);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { allRows } = await import("./review-workflow.server");
    const rows = await allRows((from, to) =>
      supabaseAdmin
        .from("sent_emails")
        .select(
          "id, created_at, template, to_email, subject, html, text_body, reply_to, status, error",
        )
        .eq("status", "failed")
        .order("created_at", { ascending: true })
        .range(from, to),
    );
    const list = (rows as SentEmailRow[])
      .filter((row) => !WORKFLOW_EMAILS.has(row.template))
      .slice(0, data.limit ?? 20);
    let sent = 0;
    for (const row of list) {
      if (await retryRow(row)) sent += 1;
    }
    return { attempted: list.length, sent, failed: list.length - sent };
  });

async function retryRow(row: SentEmailRow): Promise<boolean> {
  // These events have their own idempotent outbox. Retrying an archived copy
  // bypasses assignment/version checks and can duplicate a queued delivery.
  if (WORKFLOW_EMAILS.has(row.template)) {
    return false;
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { DeliveryUncertainError, resendRenderedEmail } =
    await import("./email-templates/send-email");

  // Mark the row before sending. If delivery succeeds but the final archive
  // update fails, it remains non-retryable instead of risking a duplicate.
  const { data: claimed, error: claimError } = await supabaseAdmin
    .from("sent_emails")
    .update({ status: "retrying", error: null } as never)
    .eq("id", row.id)
    .eq("status", "failed")
    .select("id")
    .maybeSingle();
  if (claimError) {
    console.error(`[server] could not claim email ${row.id} for retry:`, claimError);
    return false;
  }
  if (!claimed) return false;

  try {
    await resendRenderedEmail({
      template: row.template,
      to: row.to_email,
      subject: row.subject,
      html: row.html ?? "",
      text: row.text_body ?? "",
      replyTo: row.reply_to,
    });
    const { error } = await supabaseAdmin
      .from("sent_emails")
      .update({ status: "sent", error: null } as never)
      .eq("id", row.id);
    if (error) {
      // The provider accepted the email. Do not mark it failed, because doing
      // so would invite a duplicate send on the next batch retry.
      console.error(`[server] email ${row.id} sent but archive update failed:`, error);
    }
    return true;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const { error: updateError } = await supabaseAdmin
      .from("sent_emails")
      .update({
        status: error instanceof DeliveryUncertainError ? "retrying" : "failed",
        error: detail.slice(0, 500),
      } as never)
      .eq("id", row.id);
    if (updateError) console.error("[server] failed to update email retry status:", updateError);
    console.error(`[server] retry for email ${row.id} failed:`, error);
    return false;
  }
}
