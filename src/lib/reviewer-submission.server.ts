import {
  REVIEWER_DETAIL_FIELDS,
  reviewerDetails,
  type ReviewerSubmission,
} from "./reviewer-submission";
import { signedReviewerManuscript } from "./reviewer-resources.server";

/** Caller must verify the reviewer owns an active assignment before invoking. */
export async function reviewerSubmission(id: string): Promise<ReviewerSubmission> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("manuscript_submissions")
    .select([...Object.keys(REVIEWER_DETAIL_FIELDS), "supplementary_paths"].join(","))
    .eq("id", id)
    .is("deleted_at", null)
    .single();
  if (error || !data) throw new Error("Could not load submission details.");
  const row = data as unknown as Record<string, unknown>;
  const files: ReviewerSubmission["files"] = [];
  for (const file of Array.isArray(row.supplementary_paths) ? row.supplementary_paths : []) {
    if (typeof file.path !== "string") continue;
    const url = await signedReviewerManuscript(file.path, "submission-file");
    if (url) files.push({ label: file.description || "Supplementary file", url });
  }
  return { details: reviewerDetails(row), files };
}
