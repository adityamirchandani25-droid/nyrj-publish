import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const ListSchema = z.object({
  staffToken: z.string().min(1),
  search: z.string().trim().max(200).optional(),
  limit: z.number().int().min(1).max(200).optional(),
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
