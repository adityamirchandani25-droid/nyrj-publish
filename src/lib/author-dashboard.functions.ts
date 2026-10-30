import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { escapeLikePattern, sameEmail } from "./like-pattern";

export type AuthorFeedback = {
  id: string;
  body: string;
  sentAt: string;
  source: "Peer review" | "Editorial review";
  fileName: string | null;
  fileUrl: string | null;
};

export type AuthorManuscript = {
  id: string;
  title: string;
  status: string;
  decision: string;
  createdAt: string;
  updatedAt: string;
  currentVersion: number;
  manuscriptUrl: string | null;
  manuscriptFilename: string | null;
  submittedAt: string;
  resubmitToken: string | null;
  feedback: AuthorFeedback[];
  versions: Array<{
    id: string;
    version: number;
    filename: string;
    note: string;
    createdAt: string;
  }>;
};

/** Returns only submissions owned by the authenticated student. */
export const getAuthorDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AuthorManuscript[]> => {
    const email = String(context.claims.email ?? "")
      .trim()
      .toLowerCase();
    if (!email) throw new Error("Your account has no email address.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: papers, error } = await supabaseAdmin
      .from("manuscript_submissions")
      .select(
        "id, title, submitter_email, status, decision, created_at, updated_at, current_version, resubmit_token, manuscript_path, manuscript_filename",
      )
      .ilike("submitter_email", escapeLikePattern(email))
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(200);
    if (error) throw new Error("Your submissions could not be loaded. Please try again.");
    const ownedPapers = (papers ?? []).filter((paper) => sameEmail(paper.submitter_email, email));
    if (!ownedPapers.length) return [];

    const ids = ownedPapers.map((paper) => paper.id);
    const [reviews, recommendations, versions] = await Promise.all([
      supabaseAdmin
        .from("review_assignments")
        .select(
          "id, submission_id, edits_sent_at, edits_sent_body, edits_sent_file_path, edits_sent_file_name",
        )
        .in("submission_id", ids)
        .not("edits_sent_at", "is", null),
      supabaseAdmin
        .from("editor_recommendations")
        .select("id, submission_id, comments, staff_message, reviewed_at")
        .in("submission_id", ids)
        .eq("action", "formatting")
        .eq("status", "approved"),
      supabaseAdmin
        .from("manuscript_versions")
        .select("id, submission_id, version, manuscript_filename, note, created_at")
        .in("submission_id", ids),
    ]);
    if (reviews.error || recommendations.error || versions.error) {
      throw new Error("Your edit history could not be loaded. Please try again.");
    }

    const signedFiles = new Map<string, string>();
    await Promise.all(
      (reviews.data ?? [])
        .filter((r) => r.edits_sent_file_path)
        .map(async (r) => {
          const { data: signed } = await supabaseAdmin.storage
            .from("submissions")
            .createSignedUrl(r.edits_sent_file_path!, 60 * 10, {
              download: r.edits_sent_file_name || "review-feedback",
            });
          if (signed?.signedUrl) signedFiles.set(r.id, signed.signedUrl);
        }),
    );

    const currentFiles = new Map<string, string>();
    await Promise.all(
      ownedPapers
        .filter((paper) => paper.manuscript_path)
        .map(async (paper) => {
          const { data: signed, error: signError } = await supabaseAdmin.storage
            .from("submissions")
            .createSignedUrl(paper.manuscript_path!, 60 * 10, {
              download: paper.manuscript_filename || "manuscript",
            });
          if (signError) throw new Error("Your manuscript could not be opened. Please try again.");
          if (signed?.signedUrl) currentFiles.set(paper.id, signed.signedUrl);
        }),
    );

    return ownedPapers.map((paper) => {
      const feedback: AuthorFeedback[] = [
        ...(reviews.data ?? [])
          .filter(
            (row) => row.submission_id === paper.id && row.edits_sent_at && row.edits_sent_body,
          )
          .map((row) => ({
            id: row.id,
            body: row.edits_sent_body,
            sentAt: row.edits_sent_at!,
            source: "Peer review" as const,
            fileName: row.edits_sent_file_name,
            fileUrl: signedFiles.get(row.id) ?? null,
          })),
        ...(recommendations.data ?? [])
          .filter((row) => row.submission_id === paper.id && row.reviewed_at)
          .map((row) => ({
            id: row.id,
            body: row.staff_message?.trim() || row.comments,
            sentAt: row.reviewed_at!,
            source: "Editorial review" as const,
            fileName: null,
            fileUrl: null,
          })),
      ]
        .filter((item) => item.body.trim())
        .sort((a, b) => b.sentAt.localeCompare(a.sentAt));

      return {
        id: paper.id,
        title: paper.title,
        status: paper.status,
        decision: paper.decision,
        createdAt: paper.created_at,
        updatedAt: paper.updated_at,
        currentVersion: paper.current_version,
        manuscriptUrl: currentFiles.get(paper.id) ?? null,
        manuscriptFilename: paper.manuscript_filename,
        submittedAt:
          (versions.data ?? []).find(
            (row) => row.submission_id === paper.id && row.version === paper.current_version,
          )?.created_at ?? paper.created_at,
        resubmitToken: paper.status === "waiting for edits" ? paper.resubmit_token : null,
        feedback,
        versions: (versions.data ?? [])
          .filter((row) => row.submission_id === paper.id)
          .map((row) => ({
            id: row.id,
            version: row.version,
            filename: row.manuscript_filename,
            note: row.note,
            createdAt: row.created_at,
          }))
          .sort((a, b) => b.version - a.version),
      };
    });
  });
