import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const ListSchema = z.object({
  staffToken: z.string().min(1),
  search: z.string().trim().max(200).optional(),
  limit: z.number().int().min(1).max(200).optional(),
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
};

export type RetryEmailsResult = {
  attempted: number;
  sent: number;
  failed: number;
};

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
      .limit(data.limit ?? 100);

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
    return (rows ?? []) as SentEmailRow[];
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
    const { data: rows, error } = await supabaseAdmin
      .from("sent_emails")
      .select(
        "id, created_at, template, to_email, subject, html, text_body, reply_to, status, error",
      )
      .eq("status", "failed")
      .order("created_at", { ascending: true })
      .limit(data.limit ?? 20);
    if (error) throw new Error("Could not load failed emails. Please try again.");

    const list = (rows ?? []) as SentEmailRow[];
    let sent = 0;
    for (const row of list) {
      if (await retryRow(row)) sent += 1;
    }
    return { attempted: list.length, sent, failed: list.length - sent };
  });

async function retryRow(row: SentEmailRow): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { resendRenderedEmail } = await import("./email-templates/send-email");

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
      .update({ status: "failed", error: detail.slice(0, 500) } as never)
      .eq("id", row.id);
    if (updateError) console.error("[server] failed to update email retry status:", updateError);
    console.error(`[server] retry for email ${row.id} failed:`, error);
    return false;
  }
}
