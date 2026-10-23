import { supabaseAdmin as db } from "@/integrations/supabase/client.server";
import { MASTER_STAFF_EMAILS } from "./staff-recipients";
import { publicSiteUrl } from "./site-url.server";
import { reviewStatus } from "./review-workflow";

// Page every query: PostgREST's default response cap must not hide old records.
export async function allRows<T>(
  fetchPage: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const result: T[] = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await fetchPage(from, from + 499);
    if (error) throw new Error(error.message);
    result.push(...(data ?? []));
    if (!data || data.length < 500) return result;
  }
}

export async function reviewOverview() {
  const [papers, legacy, assignments, library] = await Promise.all([
    allRows((a, b) =>
      db
        .from("manuscript_submissions")
        .select(
          "id,title,submitter_email,status,decision,deleted_at,updated_at,revision_requested_at,revision_reminders_paused",
        )
        .order("id")
        .range(a, b),
    ),
    allRows((a, b) =>
      db
        .from("submissions")
        .select("id,manuscript_name,student_email,status,decision,updated_at")
        .order("id")
        .range(a, b),
    ),
    allRows((a, b) =>
      db
        .from("review_assignments")
        .select(
          "id,submission_id,reviewer_name,reviewer_email,status,review_submitted_at,edits_sent_at",
        )
        .order("id")
        .range(a, b),
    ),
    allRows((a, b) =>
      db
        .from("library_entries")
        .select("id,title,author_email,added_at,slug")
        .order("id")
        .range(a, b),
    ),
  ]);
  const canonical = new Set(
    papers.map((p) => `${p.submitter_email.toLowerCase().trim()}:${p.title.toLowerCase().trim()}`),
  );
  const publishedRecord = (p: { title: string; submitter_email: string }) =>
    library.find(
      (l) =>
        l.title.toLowerCase().trim() === p.title.toLowerCase().trim() &&
        (!l.author_email ||
          l.author_email.toLowerCase().trim() === p.submitter_email.toLowerCase().trim()),
    );
  return [
    ...papers.map((p) => ({
      ...p,
      legacy: false,
      libraryOnly: false,
      published: Boolean(publishedRecord(p)),
      reviewStatus: reviewStatus(
        publishedRecord(p) ? { ...p, status: "published" } : p,
        assignments.filter((a) => a.submission_id === p.id),
      ),
      assignments: assignments.filter((a) => a.submission_id === p.id),
    })),
    ...legacy
      .filter(
        (p) =>
          !canonical.has(
            `${p.student_email.toLowerCase().trim()}:${p.manuscript_name.toLowerCase().trim()}`,
          ),
      )
      .map((p) => ({
        id: p.id,
        title: p.manuscript_name,
        submitter_email: p.student_email,
        status: p.status,
        decision: p.decision,
        updated_at: p.updated_at,
        deleted_at: null,
        revision_requested_at: null,
        revision_reminders_paused: false,
        legacy: true,
        libraryOnly: false,
        published: false,
        reviewStatus: reviewStatus(p, []),
        assignments: [] as typeof assignments,
      })),
    ...library
      .filter((l) => !papers.some((p) => publishedRecord(p)?.id === l.id))
      .map((l) => ({
        id: l.id,
        title: l.title,
        submitter_email: l.author_email || "Author email not recorded",
        status: "published",
        decision: "accepted",
        updated_at: l.added_at,
        deleted_at: null,
        revision_requested_at: null,
        revision_reminders_paused: false,
        legacy: true,
        libraryOnly: true,
        published: true,
        reviewStatus: "completed" as const,
        assignments: [] as typeof assignments,
      })),
  ];
}

/** Durable notification outbox: retry each recipient independently. */
export async function dispatchReviewNotifications(submissionId?: string) {
  const versions = await allRows((a, b) => {
    let q = db
      .from("review_feedback_versions")
      .select("*")
      .eq("notification_required", true)
      .order("id")
      .range(a, b);
    if (submissionId) q = q.eq("submission_id", submissionId);
    return q;
  });
  const { sendTemplateEmail } = await import("./email-templates/send-email");
  let sent = 0;
  for (const v of versions) {
    const { error: seedError } = await db.from("review_staff_notifications").upsert(
      MASTER_STAFF_EMAILS.map((recipient) => ({ version_id: v.id, recipient })),
      { onConflict: "version_id,recipient", ignoreDuplicates: true },
    );
    if (seedError) throw new Error(seedError.message);
    const { data: recipients, error } = await db
      .from("review_staff_notifications")
      .select("*")
      .eq("version_id", v.id)
      .in("status", ["pending", "failed"]);
    if (error) throw new Error(error.message);
    if (!recipients?.length) continue;
    const [assignment, paper] = await Promise.all([
      db
        .from("review_assignments")
        .select("reviewer_name,reviewer_email")
        .eq("id", v.assignment_id)
        .single(),
      db.from("manuscript_submissions").select("title").eq("id", v.submission_id).single(),
    ]);
    if (assignment.error || paper.error)
      throw new Error("Could not load review notification context.");
    for (const recipient of recipients) {
      const { data: claimed, error: claimError } = await db
        .from("review_staff_notifications")
        .update({ status: "sending", claimed_at: new Date().toISOString(), error: null })
        .eq("id", recipient.id)
        .eq("status", recipient.status)
        .select("id")
        .maybeSingle();
      if (claimError) throw new Error(claimError.message);
      if (!claimed) continue;
      try {
        const delivered = await sendTemplateEmail("review-received", recipient.recipient, {
          idempotencyKey: `review-version-${v.id}-${recipient.recipient}`,
          replyTo: assignment.data!.reviewer_email,
          templateData: {
            reviewerName: assignment.data!.reviewer_name || assignment.data!.reviewer_email,
            reviewerEmail: assignment.data!.reviewer_email,
            title: paper.data!.title,
            submissionId: v.submission_id,
            comments: v.comments || "Annotated paper attached; no direct comments.",
            attachmentName: v.file_name || "",
          },
        });
        if (!delivered.sent) throw new Error("Recipient suppressed by email service.");
      } catch (error) {
        const { error: saveError } = await db
          .from("review_staff_notifications")
          .update({
            status: "failed",
            error: error instanceof Error ? error.message : "Delivery failed",
          })
          .eq("id", recipient.id);
        if (saveError) throw new Error(saveError.message);
        continue;
      }
      // If persistence fails after SendGrid accepted the message, keep 'sending'
      // for staff inspection rather than automatically duplicating delivery.
      const { error: saveError } = await db
        .from("review_staff_notifications")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", recipient.id);
      if (saveError) throw new Error(saveError.message);
      sent++;
    }
    const { count, error: countError } = await db
      .from("review_staff_notifications")
      .select("id", { count: "exact", head: true })
      .eq("version_id", v.id)
      .neq("status", "sent");
    if (countError) throw new Error(countError.message);
    if (count === 0) {
      const { error } = await db
        .from("review_feedback_versions")
        .update({ notification_required: false })
        .eq("id", v.id);
      if (error) throw new Error(error.message);
    }
  }
  return sent;
}

export async function sendRevisionReminders() {
  const candidates = await allRows((a, b) =>
    db
      .from("manuscript_submissions")
      .select("id")
      .eq("status", "waiting for edits")
      .neq("decision", "declined")
      .is("deleted_at", null)
      .eq("revision_reminders_paused", false)
      .order("id")
      .range(a, b),
  );
  const { sendTemplateEmail } = await import("./email-templates/send-email");
  const { audit } = await import("./peer-review.server");
  let sent = 0;
  for (const paper of candidates) {
    const { data, error } = await db.rpc("claim_revision_reminder", { p_submission_id: paper.id });
    if (error) throw new Error(error.message);
    if (!data) continue;
    const claim = data as {
      id: string;
      number: number;
      title: string;
      email: string;
      token: string;
      requestedAt: string;
    };
    // Recheck after claiming, immediately before delivery, to honour resubmissions
    // and pauses that happened while another job was working.
    const { data: active, error: activeError } = await db
      .from("manuscript_submissions")
      .select("id")
      .eq("id", paper.id)
      .eq("status", "waiting for edits")
      .eq("revision_requested_at", claim.requestedAt)
      .eq("revision_reminders_paused", false)
      .is("deleted_at", null)
      .neq("decision", "declined")
      .maybeSingle();
    if (activeError) throw new Error(activeError.message);
    if (!active) {
      const { error: cancelError } = await db
        .from("revision_reminder_log")
        .update({ status: "cancelled" })
        .eq("id", claim.id);
      if (cancelError) throw new Error(cancelError.message);
      continue;
    }
    try {
      const delivered = await sendTemplateEmail("author-revision-reminder", claim.email, {
        idempotencyKey: `revision-reminder-${claim.id}`,
        replyTo: "NYRJINFO@gmail.com",
        templateData: {
          title: claim.title,
          resubmitUrl: `${publicSiteUrl()}/resubmit?token=${claim.token}`,
        },
      });
      if (!delivered.sent) throw new Error("Recipient suppressed by email service.");
    } catch (error) {
      const { error: saveError } = await db
        .from("revision_reminder_log")
        .update({
          status: "failed",
          error: error instanceof Error ? error.message : "Delivery failed",
        })
        .eq("id", claim.id);
      if (saveError) throw new Error(saveError.message);
      continue;
    }
    const { error: saveError } = await db
      .from("revision_reminder_log")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", claim.id);
    if (saveError) throw new Error(saveError.message);
    await audit(paper.id, "system", `Resubmission reminder ${claim.number} sent`, claim.email);
    sent++;
  }
  return sent;
}
