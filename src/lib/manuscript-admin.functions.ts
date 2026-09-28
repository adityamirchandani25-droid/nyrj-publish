import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const TokenSchema = z.object({ staffToken: z.string().min(1) });

const UpdateSchema = TokenSchema.extend({
  id: z.string().uuid(),
  status: z
    .enum([
      "pending / in review",
      "initial review",
      "editorial review",
      "waiting for edits",
      "secondary review",
      "publishing",
      "published",
    ])
    .optional(),
  decision: z.enum(["pending", "accepted", "declined"]).optional(),
});

const IdSchema = TokenSchema.extend({ id: z.string().uuid() });

const AddToLibrarySchema = TokenSchema.extend({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(300),
  authors: z.string().trim().min(1).max(500),
  issue: z.string().trim().max(200).optional(),
  topic: z.string().trim().max(200).optional(),
  doi: z.string().trim().max(200).optional(),
  orcids: z.string().trim().max(1000).optional(),
  awardWinner: z.boolean().optional(),
  awardLabel: z.string().trim().max(120).optional(),
  featured: z.boolean().optional(),
  abstract: z.string().trim().max(5000).optional(),
  keywords: z.string().trim().max(1000).optional(),
  publicationDate: z.string().trim().max(20).optional(),
  authorEmail: z.string().trim().max(200).optional(),
});

export type AdminManuscriptRow = {
  id: string;
  submitter_email: string;
  title: string;
  research_type: string | null;
  research_type_other: string | null;
  status: string;
  decision: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  manuscript_filename: string | null;
  manuscript_path: string | null;
  authors: unknown;
  abstract: string | null;
  comments: string | null;
  conflict_of_interest: boolean;
  conflict_explanation: string | null;
  funding: boolean;
  funding_source: string | null;
  used_gen_ai: boolean;
  gen_ai_explanation: string | null;
  is_original: boolean;
  not_under_consideration: boolean;
  has_human_or_vertebrate: boolean;
  consent_form_paths: unknown;
  data_availability: string | null;
  all_authors_consent: boolean;
  supplementary_paths: unknown;
  keywords: string;
  research_domain: string;
  initial_reviewer_name: string;
  initial_reviewer_email: string;
  initial_reviewer_assigned_at: string | null;
};

type UpdatePatch = { status?: string; decision?: string };

type Json = string | number | boolean | null | { [k: string]: Json } | Json[];

type AdminManuscriptRowSerialized = Omit<
  AdminManuscriptRow,
  "authors" | "supplementary_paths" | "consent_form_paths"
> & {
  authors: Json;
  supplementary_paths: Json;
  consent_form_paths: Json;
};

const SELECT_COLS =
  "id, submitter_email, title, research_type, research_type_other, status, decision, created_at, updated_at, deleted_at, manuscript_filename, manuscript_path, authors, abstract, comments, conflict_of_interest, conflict_explanation, funding, funding_source, used_gen_ai, gen_ai_explanation, is_original, not_under_consideration, has_human_or_vertebrate, consent_form_paths, data_availability, all_authors_consent, supplementary_paths, keywords, research_domain, initial_reviewer_name, initial_reviewer_email, initial_reviewer_assigned_at";

export const listManuscriptSubmissions = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => TokenSchema.parse(d))
  .handler(async ({ data }): Promise<AdminManuscriptRowSerialized[]> => {
    const { verifyStaffToken } = await import("./staff-auth.server");
    verifyStaffToken(data.staffToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // The initial-reviewer rotation runs on its own schedule (and on demand from
    // the staff button) — never inline on page load, so the dashboard stays fast
    // and two people opening it can't double-assign the same paper.

    const { data: rows, error } = await supabaseAdmin
      .from("manuscript_submissions")
      .select(SELECT_COLS)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return (rows ?? []) as AdminManuscriptRowSerialized[];
  });

export const listTrashedManuscriptSubmissions = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => TokenSchema.parse(d))
  .handler(async ({ data }): Promise<AdminManuscriptRowSerialized[]> => {
    const { verifyStaffToken } = await import("./staff-auth.server");
    verifyStaffToken(data.staffToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Auto-purge anything trashed more than 30 days ago.
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: expired } = await supabaseAdmin
      .from("manuscript_submissions")
      .select("id, manuscript_path, supplementary_paths")
      .not("deleted_at", "is", null)
      .lt("deleted_at", cutoff);
    if (expired && expired.length > 0) {
      const paths: string[] = [];
      for (const r of expired as Array<{
        manuscript_path: string | null;
        supplementary_paths: Json;
      }>) {
        if (r.manuscript_path) paths.push(r.manuscript_path);
        if (Array.isArray(r.supplementary_paths)) {
          for (const s of r.supplementary_paths as Array<{ path?: string }>) {
            if (s?.path) paths.push(s.path);
          }
        }
      }
      if (paths.length > 0) await supabaseAdmin.storage.from("submissions").remove(paths);
      await supabaseAdmin
        .from("manuscript_submissions")
        .delete()
        .in(
          "id",
          (expired as Array<{ id: string }>).map((r) => r.id),
        );
    }

    const { data: rows, error } = await supabaseAdmin
      .from("manuscript_submissions")
      .select(SELECT_COLS)
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return (rows ?? []) as AdminManuscriptRowSerialized[];
  });

export const updateManuscriptSubmission = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => UpdateSchema.parse(d))
  .handler(async ({ data }) => {
    const { verifyStaffToken } = await import("./staff-auth.server");
    verifyStaffToken(data.staffToken);
    const patch: UpdatePatch = {};
    if (data.status) patch.status = data.status;
    if (data.decision) patch.decision = data.decision;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("manuscript_submissions")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update(patch as any)
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    // Keep the shared workbook in step with the dashboard.
    try {
      const { updateSubmissionRow } = await import("./excel-sync.server");
      await updateSubmissionRow(data.id, {
        ...(patch.status ? { status: patch.status } : {}),
        ...(patch.decision ? { decision: patch.decision } : {}),
      });
    } catch (e) {
      console.error("[server] excel status sync failed:", e);
    }

    // Notify the author of the new status. Never block the update.
    try {
      const { data: row } = await supabaseAdmin
        .from("manuscript_submissions")
        .select("submitter_email, title, status, decision")
        .eq("id", data.id)
        .single();
      const to = (row as { submitter_email?: string } | null)?.submitter_email;
      if (to) {
        const { sendTemplateEmail } = await import("./email-templates/send-email");
        await sendTemplateEmail("submission-status", to, {
          idempotencyKey: `submission-status-${data.id}-${patch.status ?? ""}-${patch.decision ?? ""}`,
          replyTo: "NYRJINFO@gmail.com",
          templateData: {
            title: (row as { title?: string }).title ?? "your manuscript",
            status: patch.status ?? (row as { status?: string }).status ?? "",
            decision: patch.decision ?? "",
          },
        });
      }
    } catch (e) {
      console.error("[server] status update email failed:", e);
    }

    return { ok: true };
  });

export const trashManuscriptSubmission = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => IdSchema.parse(d))
  .handler(async ({ data }) => {
    const { verifyStaffToken } = await import("./staff-auth.server");
    verifyStaffToken(data.staffToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("manuscript_submissions")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ deleted_at: new Date().toISOString() } as any)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const restoreManuscriptSubmission = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => IdSchema.parse(d))
  .handler(async ({ data }) => {
    const { verifyStaffToken } = await import("./staff-auth.server");
    verifyStaffToken(data.staffToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("manuscript_submissions")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ deleted_at: null } as any)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const purgeManuscriptSubmission = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => IdSchema.parse(d))
  .handler(async ({ data }) => {
    const { verifyStaffToken } = await import("./staff-auth.server");
    verifyStaffToken(data.staffToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("manuscript_submissions")
      .select("manuscript_path, supplementary_paths")
      .eq("id", data.id)
      .maybeSingle();
    const paths: string[] = [];
    if (row) {
      const r = row as { manuscript_path: string | null; supplementary_paths: Json };
      if (r.manuscript_path) paths.push(r.manuscript_path);
      if (Array.isArray(r.supplementary_paths)) {
        for (const s of r.supplementary_paths as Array<{ path?: string }>) {
          if (s?.path) paths.push(s.path);
        }
      }
    }
    if (paths.length > 0) await supabaseAdmin.storage.from("submissions").remove(paths);
    const { error } = await supabaseAdmin.from("manuscript_submissions").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const addManuscriptToLibrary = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => AddToLibrarySchema.parse(d))
  .handler(async ({ data }) => {
    const { verifyStaffToken } = await import("./staff-auth.server");
    verifyStaffToken(data.staffToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row, error: rowErr } = await supabaseAdmin
      .from("manuscript_submissions")
      .select("manuscript_path, manuscript_filename")
      .eq("id", data.id)
      .maybeSingle();
    if (rowErr) throw new Error(rowErr.message);
    if (!row || !(row as { manuscript_path: string | null }).manuscript_path) {
      throw new Error("No manuscript file attached to this submission.");
    }
    const src = row as { manuscript_path: string; manuscript_filename: string | null };

    // Download from submissions bucket, upload to library bucket.
    const { data: fileBlob, error: dlErr } = await supabaseAdmin.storage
      .from("submissions")
      .download(src.manuscript_path);
    if (dlErr || !fileBlob) throw new Error(dlErr?.message ?? "Failed to read manuscript file.");

    const bytes = new Uint8Array(await fileBlob.arrayBuffer());
    const fileName = src.manuscript_filename ?? "manuscript.pdf";
    const mimeType = fileBlob.type || "application/pdf";
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${crypto.randomUUID()}-${safeName}`;

    const { error: upErr } = await supabaseAdmin.storage
      .from("library")
      .upload(path, bytes, { contentType: mimeType, upsert: false });
    if (upErr) throw new Error(upErr.message);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: entry, error: insErr } = await (supabaseAdmin as any)
      .from("library_entries")
      .insert({
        title: data.title,
        authors: data.authors,
        issue: data.issue || null,
        topic: data.topic || null,
        doi: data.doi || null,
        orcids: data.orcids
          ? data.orcids
              .split(/[,\s]+/)
              .map((s) => s.trim())
              .filter(Boolean)
          : null,
        award_winner: data.awardWinner ?? false,
        award_label: data.awardLabel || null,
        abstract: data.abstract || null,
        keywords: data.keywords
          ? data.keywords
              .split(",")
              .map((s2) => s2.trim())
              .filter(Boolean)
          : null,
        publication_date: data.publicationDate || null,
        author_email: data.authorEmail || null,
        featured: data.featured ?? false,
        file_name: fileName,
        mime_type: mimeType,
        file_path: path,
      })
      .select("id, slug, nyrj_id, title")
      .single();
    if (insErr) throw new Error(insErr.message);
    return entry as { id: string; slug: string | null; nyrj_id: string | null; title: string };
  });

/** True only when the path is one this journal actually stored for a submission. */
async function isKnownSubmissionPath(path: string): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: direct } = await supabaseAdmin
    .from("manuscript_submissions")
    .select("id")
    .eq("manuscript_path", path)
    .limit(1);
  if (direct && direct.length > 0) return true;

  const { data: version } = await supabaseAdmin
    .from("manuscript_versions")
    .select("id")
    .eq("manuscript_path", path)
    .limit(1);
  if (version && version.length > 0) return true;

  // Supplementary files and consent forms are stored as JSON arrays of refs.
  const { data: rows } = await supabaseAdmin
    .from("manuscript_submissions")
    .select("supplementary_paths, consent_form_paths");
  for (const r of rows ?? []) {
    const refs = [r.supplementary_paths, r.consent_form_paths].flatMap((v) =>
      Array.isArray(v) ? v : [],
    );
    if (refs.some((f) => typeof f === "object" && f !== null && "path" in f && f.path === path)) {
      return true;
    }
  }
  return false;
}

export const signManuscriptDownload = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => TokenSchema.extend({ path: z.string().min(1).max(500) }).parse(d))
  .handler(async ({ data }) => {
    const { verifyStaffToken } = await import("./staff-auth.server");
    verifyStaffToken(data.staffToken);

    // Never sign an arbitrary caller-supplied path: only files this journal
    // recorded against a submission can be downloaded.
    if (data.path.includes("..") || !(await isKnownSubmissionPath(data.path))) {
      throw new Error("That file is not available.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage
      .from("submissions")
      .createSignedUrl(data.path, 60 * 10);
    if (error || !signed) {
      console.error("[server] signManuscriptDownload error:", error);
      throw new Error("Could not open that file. Please try again.");
    }
    return { url: signed.signedUrl };
  });
