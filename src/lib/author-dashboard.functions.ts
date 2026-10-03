import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AuthorFeedback = {
  id: string;
  body: string;
  sentAt: string;
  source: "Peer review" | "Editorial review";
};

export type AuthorManuscript = {
  id: string;
  title: string;
  status: string;
  decision: string;
  createdAt: string;
  updatedAt: string;
  currentVersion: number;
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
        "id, title, status, decision, created_at, updated_at, current_version, resubmit_token",
      )
      .eq("submitter_email", email)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false });
    if (error) throw new Error("Your submissions could not be loaded. Please try again.");
    if (!papers?.length) return [];

    const ids = papers.map((paper) => paper.id);
    const [reviews, recommendations, versions] = await Promise.all([
      supabaseAdmin
        .from("review_assignments")
        .select("id, submission_id, edits_sent_at, edits_sent_body")
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

    return papers.map((paper) => {
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
          })),
        ...(recommendations.data ?? [])
          .filter((row) => row.submission_id === paper.id && row.reviewed_at)
          .map((row) => ({
            id: row.id,
            body: row.staff_message?.trim() || row.comments,
            sentAt: row.reviewed_at!,
            source: "Editorial review" as const,
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
