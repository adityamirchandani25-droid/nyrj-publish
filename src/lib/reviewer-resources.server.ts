const WORKFLOW_PATH = "reviewer-resources/nyrj-editorial-workflow.pdf";

export async function signedEditorialWorkflowUrl(): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.storage
    .from("submissions")
    .createSignedUrl(WORKFLOW_PATH, 60 * 30, { download: "NYRJ Editorial Workflow.pdf" });
  if (error || !data?.signedUrl) throw new Error("Could not open the editorial workflow.");
  return data.signedUrl;
}

export async function signedReviewerManuscript(
  path: string | null | undefined,
  filename: string | null | undefined,
): Promise<string | null> {
  if (!path) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.storage
    .from("submissions")
    .createSignedUrl(path, 60 * 30, { download: filename || "manuscript.pdf" });
  return data?.signedUrl ?? null;
}
