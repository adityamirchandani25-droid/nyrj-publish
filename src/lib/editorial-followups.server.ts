import { MASTER_STAFF_EMAILS } from "./staff-recipients";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Run from the authenticated daily cron. Delivery markers make retries safe. */
export async function runEditorialFollowups(): Promise<{
  authorReminders: number;
  staffAlerts: number;
  initialReviewerReminders: number;
}> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { sendTemplateEmail, sendTemplateEmailToMany } =
    await import("./email-templates/send-email");
  const { audit } = await import("./peer-review.server");
  const now = Date.now();
  const tenDaysAgo = new Date(now - 10 * DAY_MS).toISOString();
  const monthAgo = new Date(now - 30 * DAY_MS).toISOString();
  const today = new Date(now).toISOString().slice(0, 10);
  let authorReminders = 0;
  let staffAlerts = 0;
  let initialReviewerReminders = 0;

  const { data: revisions, error: revisionsError } = await supabaseAdmin
    .from("manuscript_submissions")
    .select(
      "id, title, submitter_email, resubmit_token, revision_requested_at, revision_reminder_sent_at, revision_staff_alert_sent_at",
    )
    .is("deleted_at", null)
    .eq("decision", "pending")
    .eq("status", "waiting for edits")
    .not("revision_requested_at", "is", null)
    .lte("revision_requested_at", tenDaysAgo)
    .order("revision_requested_at", { ascending: true })
    .limit(1000);
  if (revisionsError) throw new Error(revisionsError.message);
  for (const row of revisions ?? []) {
    const requestedAt = row.revision_requested_at as string;
    const key = `${row.id}-${requestedAt}`;
    if (!row.revision_reminder_sent_at && row.resubmit_token) {
      try {
        await sendTemplateEmail("author-revision-reminder", row.submitter_email, {
          idempotencyKey: `author-revision-followup-${key}`,
          replyTo: "NYRJINFO@gmail.com",
          templateData: {
            title: row.title,
            resubmitUrl: `https://nyrj.org/resubmit?token=${row.resubmit_token}`,
          },
        });
        const { error } = await supabaseAdmin
          .from("manuscript_submissions")
          .update({ revision_reminder_sent_at: new Date().toISOString() } as never)
          .eq("id", row.id)
          .eq("status", "waiting for edits")
          .eq("revision_requested_at", requestedAt)
          .is("revision_reminder_sent_at", null);
        if (error) throw new Error(error.message);
        authorReminders++;
        await audit(row.id, "system", "Author revision follow-up sent", row.submitter_email);
      } catch (error) {
        console.error("[followups] author reminder failed:", row.id, error);
      }
    }
    if (requestedAt > monthAgo || row.revision_staff_alert_sent_at) continue;
    try {
      await sendTemplateEmailToMany("author-revision-overdue", MASTER_STAFF_EMAILS, (to) => ({
        idempotencyKey: `author-revision-overdue-${key}-${to}`,
        replyTo: "NYRJINFO@gmail.com",
        templateData: {
          title: row.title,
          authorEmail: row.submitter_email,
          requestedDate: new Date(requestedAt).toLocaleDateString("en-US"),
          dashboardUrl: "https://nyrj.org/admin/submissions",
        },
      }));
      const { error } = await supabaseAdmin
        .from("manuscript_submissions")
        .update({ revision_staff_alert_sent_at: new Date().toISOString() } as never)
        .eq("id", row.id)
        .eq("status", "waiting for edits")
        .eq("revision_requested_at", requestedAt)
        .is("revision_staff_alert_sent_at", null);
      if (error) throw new Error(error.message);
      staffAlerts++;
      await audit(
        row.id,
        "system",
        "Staff alerted to month-old author revision",
        row.submitter_email,
      );
    } catch (error) {
      console.error("[followups] staff revision alert failed:", row.id, error);
    }
  }

  // Count manuscripts still needing an initial recommendation. A recommendation
  // submitted for staff approval counts as the reviewer's work being done.
  const { data: reviewers, error: reviewersError } = await supabaseAdmin
    .from("initial_reviewers")
    .select("id, name, email, workload_reminder_sent_on")
    .eq("active", true)
    .limit(1000);
  if (reviewersError) throw new Error(reviewersError.message);
  const { data: papers, error: papersError } = await supabaseAdmin
    .from("manuscript_submissions")
    .select("id, title, initial_reviewer_email")
    .is("deleted_at", null)
    .eq("decision", "pending")
    .in("status", ["pending / in review", "initial review"])
    .neq("initial_reviewer_email", "")
    .limit(5000);
  if (papersError) throw new Error(papersError.message);
  const ids = (papers ?? []).map((paper) => paper.id);
  const reviewed = new Set<string>();
  for (let offset = 0; offset < ids.length; offset += 500) {
    const { data: recommendations, error } = await supabaseAdmin
      .from("editor_recommendations")
      .select("submission_id, editor_email")
      .in("submission_id", ids.slice(offset, offset + 500));
    if (error) throw new Error(error.message);
    for (const rec of recommendations ?? [])
      reviewed.add(`${rec.submission_id}:${rec.editor_email.toLowerCase()}`);
  }
  for (const reviewer of reviewers ?? []) {
    if (reviewer.workload_reminder_sent_on === today) continue;
    const email = reviewer.email.trim().toLowerCase();
    const waiting = (papers ?? []).filter(
      (paper) =>
        paper.initial_reviewer_email?.trim().toLowerCase() === email &&
        !reviewed.has(`${paper.id}:${email}`),
    );
    if (waiting.length <= 3) continue;
    try {
      await sendTemplateEmail("initial-review-workload", reviewer.email, {
        idempotencyKey: `initial-review-workload-${reviewer.id}-${today}`,
        replyTo: "NYRJINFO@gmail.com",
        templateData: {
          reviewerName: reviewer.name,
          titles: waiting.slice(0, 10).map((paper) => paper.title),
          dashboardUrl: "https://nyrj.org/initial-reviewer",
        },
      });
      const { error } = await supabaseAdmin
        .from("initial_reviewers")
        .update({ workload_reminder_sent_on: today } as never)
        .eq("id", reviewer.id);
      if (error) throw new Error(error.message);
      initialReviewerReminders++;
    } catch (error) {
      console.error("[followups] initial reviewer workload email failed:", reviewer.id, error);
    }
  }

  return { authorReminders, staffAlerts, initialReviewerReminders };
}
