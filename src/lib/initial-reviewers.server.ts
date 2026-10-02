// Server-only: the internal "initial reviewer" rotation (Jay, Prahul, Nolen …).
// One editor is assigned to each new submission, the spreadsheet is kept in
// step, and the assignee is emailed so they know to pick the paper up.

export type InitialReviewer = { id: string; name: string; email: string };

/** Picks the active reviewer with the fewest open assignments and books them in. */
export async function assignInitialReviewer(
  submissionId: string,
  title: string,
): Promise<InitialReviewer | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Only papers still awaiting a decision get an initial reviewer, and never
  // one that already has somebody on it.
  const { data: sub } = await supabaseAdmin
    .from("manuscript_submissions")
    .select("decision, initial_reviewer_email, deleted_at")
    .eq("id", submissionId)
    .maybeSingle();
  const s = sub as {
    decision?: string;
    initial_reviewer_email?: string;
    deleted_at?: string | null;
  } | null;
  if (!s) return null;
  if (s.deleted_at) return null;
  if ((s.decision ?? "pending") !== "pending") return null;
  if ((s.initial_reviewer_email ?? "").trim()) return null;

  const { data: pool } = await supabaseAdmin
    .from("initial_reviewers")
    .select("id, name, email, assigned_count")
    .eq("active", true)
    .order("created_at", { ascending: true })
    .limit(100);

  const candidates = (pool ?? []) as Array<{
    id: string;
    name: string;
    email: string;
    assigned_count: number;
  }>;
  if (!candidates.length) return null;

  const { data: openPapers, error: openError } = await supabaseAdmin
    .from("manuscript_submissions")
    .select("initial_reviewer_email")
    .is("deleted_at", null)
    .eq("decision", "pending")
    .neq("status", "published")
    .neq("initial_reviewer_email", "")
    .limit(1000);
  if (openError) throw new Error(openError.message);
  const openCounts = new Map<string, number>();
  for (const paper of (openPapers ?? []) as Array<{ initial_reviewer_email: string }>) {
    const key = paper.initial_reviewer_email.trim().toLowerCase();
    openCounts.set(key, (openCounts.get(key) ?? 0) + 1);
  }
  const pick = candidates.reduce((best, candidate) => {
    const candidateCount = openCounts.get(candidate.email.trim().toLowerCase()) ?? 0;
    const bestCount = openCounts.get(best.email.trim().toLowerCase()) ?? 0;
    return candidateCount < bestCount ? candidate : best;
  });
  if (!pick) return null;

  // The condition makes repeated/concurrent sweeps idempotent for this paper:
  // only the first caller can fill an empty assignment.
  const { data: assigned, error: assignmentError } = await supabaseAdmin
    .from("manuscript_submissions")
    .update({
      initial_reviewer_name: pick.name,
      initial_reviewer_email: pick.email,
      initial_reviewer_assigned_at: new Date().toISOString(),
    } as never)
    .eq("id", submissionId)
    .eq("decision", "pending")
    .eq("initial_reviewer_email", "")
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();
  if (assignmentError) throw new Error(assignmentError.message);
  if (!assigned) return null;

  await supabaseAdmin
    .from("initial_reviewers")
    .update({ assigned_count: pick.assigned_count + 1 } as never)
    .eq("id", pick.id);

  // Mirror the assignment into the workbook.
  try {
    const { updateSubmissionRow } = await import("./excel-sync.server");
    await updateSubmissionRow(submissionId, { reviewer: pick.name });
  } catch (e) {
    console.error("[initial-reviewers] excel update failed:", e);
  }

  // Let them know.
  try {
    const { sendTemplateEmail } = await import("./email-templates/send-email");
    const { publicSiteUrl } = await import("./site-url.server");
    const siteUrl = publicSiteUrl();
    await sendTemplateEmail("initial-review-assignment", pick.email, {
      idempotencyKey: `initial-review-${submissionId}-${pick.email}`,
      replyTo: "NYRJINFO@gmail.com",
      templateData: {
        reviewerName: pick.name,
        title,
        submissionId,
        dashboardUrl: `${siteUrl}/initial-reviewer`,
      },
    });
  } catch (e) {
    console.error("[initial-reviewers] assignment email failed:", e);
  }

  try {
    const { audit } = await import("./peer-review.server");
    await audit(
      submissionId,
      "system",
      "Initial reviewer assigned",
      `${pick.name} (${pick.email})`,
    );
  } catch (e) {
    console.error("[initial-reviewers] audit failed:", e);
  }

  return { id: pick.id, name: pick.name, email: pick.email };
}

/**
 * Sweeps every live, still-pending paper that has nobody on it and books in an
 * initial reviewer (emailing them and updating the workbook). Safe to run often
 * — papers that already have someone, or that have been decided, are skipped.
 */
export async function sweepInitialAssignments(): Promise<{
  assigned: number;
  pending: number;
}> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: rows, error } = await supabaseAdmin
    .from("manuscript_submissions")
    .select("id, title, initial_reviewer_email, decision, status")
    .is("deleted_at", null)
    .eq("decision", "pending")
    .neq("status", "published")
    .order("created_at", { ascending: true })
    .limit(300);
  if (error) throw new Error(error.message);

  const pending = (rows ?? []).filter(
    (r) => !((r as { initial_reviewer_email?: string }).initial_reviewer_email ?? "").trim(),
  ) as Array<{ id: string; title: string }>;

  let assigned = 0;
  for (const r of pending) {
    try {
      const who = await assignInitialReviewer(r.id, r.title);
      if (who) assigned++;
    } catch (e) {
      console.error("[initial-reviewers] sweep failed for", r.id, e);
    }
  }
  return { assigned, pending: pending.length };
}
