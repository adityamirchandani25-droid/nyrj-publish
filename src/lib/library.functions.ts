import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { TablesUpdate } from "@/integrations/supabase/types";

const PUBLIC_LIBRARY_COLUMNS =
  "id, slug, nyrj_id, doi, featured, citation_count, title, authors, issue, topic, grade, abstract, keywords, references_text, publication_date, orcids, award_winner, award_label, file_name, mime_type, file_path, added_at";

export const libraryList = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("library_entries")
    .select(PUBLIC_LIBRARY_COLUMNS)
    .order("added_at", { ascending: false });
  if (error) {
    console.error("[server] supabase error:", error);
    throw new Error("An unexpected error occurred. Please try again.");
  }
  const rows = (data ?? []) as Array<{
    id: string;
    title: string;
    authors: string;
    issue: string | null;
    topic: string | null;
    grade: string | null;
    file_name: string;
    mime_type: string;
    file_path: string;
    added_at: string;
  }>;
  return Promise.all(
    rows.map(async (r) => {
      const { data: signed, error: signedUrlError } = await supabaseAdmin.storage
        .from("library")
        .createSignedUrl(r.file_path, 60 * 60 * 24 * 365);
      if (signedUrlError || !signed?.signedUrl) {
        console.error("[server] library signed URL error:", signedUrlError);
        throw new Error(`Published file is unavailable: ${r.file_name}`);
      }
      return { ...r, signed_url: signed.signedUrl };
    }),
  );
});

const AddSchema = z.object({
  staffToken: z.string().min(1),
  title: z.string().trim().min(1).max(300),
  authors: z.string().trim().min(1).max(500),
  issue: z.string().trim().max(200).optional(),
  topic: z.string().trim().max(200).optional(),
  authorEmail: z.string().trim().max(320).optional(),
  keywords: z.array(z.string().trim().max(80)).max(50).optional(),
  doi: z.string().trim().max(200).optional(),
  orcids: z.array(z.string().trim().max(50)).max(50).optional(),
  awardWinner: z.boolean().optional(),
  awardLabel: z.string().trim().max(120).optional(),
  featured: z.boolean().optional(),
  fileName: z.string().trim().min(1).max(300),
  mimeType: z.string().trim().min(1).max(200),
  /** Base64-encoded file contents (no data: prefix). */
  fileBase64: z.string().min(1).max(20_000_000),
});

const RemoveSchema = z.object({
  staffToken: z.string().min(1),
  id: z.string().uuid(),
});

const UpdateSchema = z.object({
  staffToken: z.string().min(1),
  id: z.string().uuid(),
  doi: z.string().trim().max(200).nullable().optional(),
  featured: z.boolean().optional(),
  awardWinner: z.boolean().optional(),
  awardLabel: z.string().trim().max(120).nullable().optional(),
  orcids: z.array(z.string().trim().max(50)).max(50).nullable().optional(),
  issue: z.string().trim().max(200).nullable().optional(),
  publicationDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
    .nullable()
    .optional(),
});

const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export const libraryAdd = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => AddSchema.parse(d))
  .handler(async ({ data }) => {
    const { verifyStaffToken } = await import("./staff-auth.server");
    verifyStaffToken(data.staffToken);
    if (!ALLOWED_MIME.has(data.mimeType)) {
      throw new Error("Unsupported file type. Please upload a PDF or Word document.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const bytes = Uint8Array.from(atob(data.fileBase64), (c) => c.charCodeAt(0));
    const safeName = data.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${crypto.randomUUID()}-${safeName}`;

    const { error: upErr } = await supabaseAdmin.storage
      .from("library")
      .upload(path, bytes, { contentType: data.mimeType, upsert: false });
    if (upErr) throw new Error(upErr.message);

    const { data: row, error } = await supabaseAdmin
      .from("library_entries")
      .insert({
        title: data.title,
        authors: data.authors,
        issue: data.issue || null,
        topic: data.topic || null,
        author_email: data.authorEmail || null,
        keywords: data.keywords && data.keywords.length ? data.keywords : null,
        doi: data.doi || null,
        orcids: data.orcids && data.orcids.length ? data.orcids : null,
        award_winner: data.awardWinner ?? false,
        award_label: data.awardLabel || null,
        featured: data.featured ?? false,
        file_name: data.fileName,
        mime_type: data.mimeType,
        file_path: path,
      })
      .select()
      .single();

    if (error) {
      console.error("[server] supabase error:", error);
      throw new Error("An unexpected error occurred. Please try again.");
    }
    return row;
  });

export const libraryRemove = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => RemoveSchema.parse(d))
  .handler(async ({ data }) => {
    const { verifyStaffToken } = await import("./staff-auth.server");
    verifyStaffToken(data.staffToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing } = await supabaseAdmin
      .from("library_entries")
      .select("file_path")
      .eq("id", data.id)
      .maybeSingle();

    if (existing?.file_path) {
      await supabaseAdmin.storage.from("library").remove([existing.file_path]);
    }

    const { error } = await supabaseAdmin.from("library_entries").delete().eq("id", data.id);
    if (error) {
      console.error("[server] supabase error:", error);
      throw new Error("An unexpected error occurred. Please try again.");
    }
    return { ok: true as const };
  });

export const libraryUpdate = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => UpdateSchema.parse(d))
  .handler(async ({ data }) => {
    const { verifyStaffToken } = await import("./staff-auth.server");
    verifyStaffToken(data.staffToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const patch: TablesUpdate<"library_entries"> = {};
    if (data.doi !== undefined) patch.doi = data.doi === "" ? null : data.doi;
    if (data.featured !== undefined) patch.featured = data.featured;
    if (data.awardWinner !== undefined) patch.award_winner = data.awardWinner;
    if (data.awardLabel !== undefined)
      patch.award_label = data.awardLabel === "" ? null : data.awardLabel;
    if (data.orcids !== undefined) patch.orcids = data.orcids;
    if (data.issue !== undefined) patch.issue = data.issue === "" ? null : data.issue;
    if (data.publicationDate !== undefined)
      patch.publication_date = data.publicationDate === "" ? null : data.publicationDate;
    if (Object.keys(patch).length === 0) return { ok: true as const };

    const { error } = await supabaseAdmin.from("library_entries").update(patch).eq("id", data.id);
    if (error) {
      console.error("[server] supabase error:", error);
      throw new Error("An unexpected error occurred. Please try again.");
    }
    return { ok: true as const };
  });
