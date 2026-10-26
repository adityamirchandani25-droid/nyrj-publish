import { supabaseAdmin as db } from "@/integrations/supabase/client.server";
import { DeliveryUncertainError, sendTemplateEmail } from "./email-templates/send-email";
import { MASTER_STAFF_EMAILS } from "./staff-recipients";

export type PeerNotification = {
  id: string;
  idempotency_key: string;
  submission_id: string | null;
  assignment_id: string | null;
  manuscript_version: number | null;
  event: string;
  template: string;
  recipient: string;
  template_data: Record<string, unknown>;
  reply_to: string | null;
  status: string;
  attempts: number;
};

export async function queuePeerNotification(input: {
  key: string;
  submissionId: string;
  assignmentId?: string;
  version?: number;
  event: string;
  template: string;
  recipient: string;
  data: Record<string, unknown>;
  replyTo?: string;
}) {
  const { error } = await db.from("peer_notification_outbox").upsert(
    {
      idempotency_key: input.key,
      submission_id: input.submissionId,
      assignment_id: input.assignmentId ?? null,
      manuscript_version: input.version ?? null,
      event: input.event,
      template: input.template,
      recipient: input.recipient.trim().toLowerCase(),
      template_data: input.data,
      reply_to: input.replyTo ?? null,
    } as never,
    { onConflict: "idempotency_key", ignoreDuplicates: true },
  );
  if (error) throw new Error(`Could not queue notification: ${error.message}`);
  const { data, error: readError } = await db
    .from("peer_notification_outbox")
    .select("*")
    .eq("idempotency_key", input.key)
    .single();
  if (readError || !data) throw new Error("Could not read queued notification.");
  return data as PeerNotification;
}

export async function processPeerNotification(id: string) {
  const { data, error } = await db.rpc("claim_peer_notification", { p_id: id });
  if (error) throw new Error(`Could not claim notification: ${error.message}`);
  const row = (data as PeerNotification[] | null)?.[0];
  if (!row) return { status: "already_processed" as const };

  // A completed or closed review must never receive an old invitation.
  if (
    row.assignment_id &&
    ["reviewer_invitation", "reviewer_revision", "reviewer_reminder"].includes(row.event)
  ) {
    const { data: assignment, error: lookupError } = await db
      .from("review_assignments")
      .select("status,responded_at,review_submitted_at")
      .eq("id", row.assignment_id)
      .maybeSingle();
    if (lookupError) throw new Error(lookupError.message);
    const obsoleteInvitation =
      row.event === "reviewer_invitation" &&
      (!assignment ||
        assignment.status !== "invited" ||
        assignment.responded_at ||
        assignment.review_submitted_at);
    const inactiveRevision =
      row.event === "reviewer_revision" &&
      (!assignment ||
        !["invited", "accepted", "review_received", "sent_to_author"].includes(assignment.status));
    const obsoleteReminder =
      row.event === "reviewer_reminder" &&
      (!assignment ||
        !["invited", "accepted"].includes(assignment.status) ||
        assignment.review_submitted_at);
    if (obsoleteInvitation || inactiveRevision || obsoleteReminder) {
      await db
        .from("peer_notification_outbox")
        .update({ status: "cancelled", updated_at: new Date().toISOString() } as never)
        .eq("id", id);
      return { status: "cancelled" as const };
    }
  }
  if (row.event === "reviewer_revision" && row.submission_id) {
    const { data: paper, error: paperError } = await db
      .from("manuscript_submissions")
      .select("current_version,deleted_at")
      .eq("id", row.submission_id)
      .maybeSingle();
    if (paperError) throw new Error(paperError.message);
    if (!paper || paper.deleted_at || paper.current_version !== row.manuscript_version) {
      await db
        .from("peer_notification_outbox")
        .update({ status: "cancelled", updated_at: new Date().toISOString() } as never)
        .eq("id", id);
      return { status: "cancelled" as const };
    }
  }

  try {
    const result = await sendTemplateEmail(row.template, row.recipient, {
      idempotencyKey: row.idempotency_key,
      templateData: row.template_data,
      replyTo: row.reply_to ?? undefined,
    });
    if (!result.sent) throw new Error("Recipient suppressed by email service.");
    const { error: saveError } = await db
      .from("peer_notification_outbox")
      .update({
        status: "provider_accepted",
        provider_accepted_at: new Date().toISOString(),
        provider_message_id: result.providerMessageId,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", id)
      .eq("status", "processing");
    // If the provider accepted but saving failed, retain processing. It needs
    // reconciliation against provider events before another attempt.
    if (saveError)
      throw new Error(`Provider accepted; could not save status: ${saveError.message}`);
    return { status: "provider_accepted" as const };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    if (message.startsWith("Provider accepted;")) throw cause;
    if (cause instanceof DeliveryUncertainError) {
      await db
        .from("peer_notification_outbox")
        .update({
          last_error: `${message} — reconcile with SendGrid before retrying`,
          updated_at: new Date().toISOString(),
        } as never)
        .eq("id", id)
        .eq("status", "processing");
      return { status: "uncertain" as const, error: message };
    }
    const retryable = !/^SendGrid 4\d\d:/.test(message) || /^SendGrid (408|429):/.test(message);
    const next = new Date(
      Date.now() + Math.min(24 * 60, 2 ** Math.min(row.attempts, 10)) * 60_000,
    ).toISOString();
    const { error: saveError } = await db
      .from("peer_notification_outbox")
      .update({
        status: retryable && row.attempts < 8 ? "retrying" : "failed",
        next_attempt_at: next,
        last_error: message.slice(0, 1000),
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", id)
      .eq("status", "processing");
    if (saveError)
      throw new Error(`Email failed and status could not be saved: ${saveError.message}`);
    return { status: "failed" as const, error: message };
  }
}

export async function processDuePeerNotifications(limit = 100) {
  const { data, error } = await db
    .from("peer_notification_outbox")
    .select("id")
    .in("status", ["pending", "retrying"])
    .lte("next_attempt_at", new Date().toISOString())
    .order("created_at")
    .limit(limit);
  if (error) throw new Error(error.message);
  const results = [];
  for (const row of data ?? []) results.push(await processPeerNotification(row.id));
  return results;
}

export async function notificationRolloutAt() {
  const { data, error } = await db
    .from("peer_notification_rollout")
    .select("installed_at")
    .eq("id", true)
    .single();
  if (error || !data) throw new Error("Notification rollout marker is missing.");
  return data.installed_at;
}

/** Reconstructs missing revision jobs from committed manuscript versions. */
export async function queueRevisionNotifications(submissionId: string, version: number) {
  const [paperResult, versionResult, assignmentsResult] = await Promise.all([
    db
      .from("manuscript_submissions")
      .select("id,title,submitter_email,authors,current_version,deleted_at")
      .eq("id", submissionId)
      .single(),
    db
      .from("manuscript_versions")
      .select("created_at")
      .eq("submission_id", submissionId)
      .eq("version", version)
      .single(),
    db
      .from("review_assignments")
      .select("id,reviewer_email,reviewer_name,invite_token,status")
      .eq("submission_id", submissionId),
  ]);
  if (
    paperResult.error ||
    versionResult.error ||
    assignmentsResult.error ||
    !paperResult.data ||
    !versionResult.data
  )
    throw new Error("Could not load revision notification context.");
  const paper = paperResult.data;
  if (paper.deleted_at || paper.current_version < version) return [];
  const submittedAt = new Date(versionResult.data.created_at).toLocaleString("en-US", {
    timeZone: "America/New_York",
  });
  const jobs = [];
  for (const recipient of MASTER_STAFF_EMAILS)
    jobs.push(
      await queuePeerNotification({
        key: `revision-staff-${submissionId}-v${version}-${recipient.toLowerCase()}`,
        submissionId,
        version,
        event: "admin_revision",
        template: "revision-received",
        recipient,
        replyTo: paper.submitter_email,
        data: {
          title: paper.title,
          version,
          previousVersion: version - 1,
          submittedAt,
          submissionId,
          submitterEmail: paper.submitter_email,
          toAuthor: false,
        },
      }),
    );
  jobs.push(
    await queuePeerNotification({
      key: `revision-author-${submissionId}-v${version}`,
      submissionId,
      version,
      event: "author_revision_confirmation",
      template: "revision-received",
      recipient: paper.submitter_email,
      replyTo: "NYRJINFO@gmail.com",
      data: { title: paper.title, version, submittedAt, toAuthor: true },
    }),
  );
  for (const assignment of assignmentsResult.data ?? []) {
    if (!["invited", "accepted", "review_received", "sent_to_author"].includes(assignment.status))
      continue;
    jobs.push(
      await queuePeerNotification({
        key: `revision-reviewer-${assignment.id}-v${version}`,
        submissionId,
        assignmentId: assignment.id,
        version,
        event: "reviewer_revision",
        template: "reviewer-revision",
        recipient: assignment.reviewer_email,
        replyTo: "NYRJINFO@gmail.com",
        data: {
          reviewerName: assignment.reviewer_name || "Reviewer",
          title: paper.title,
          version,
          submittedAt,
          reviewUrl: `https://nyrj.org/review?token=${assignment.invite_token}`,
        },
      }),
    );
  }
  return jobs;
}

/** Repair assignments created after outbox rollout if enqueue was interrupted. */
export async function recoverRecentInvitations() {
  const rolloutAt = await notificationRolloutAt();
  const { data: assignments, error } = await db
    .from("review_assignments")
    .select("id,submission_id,reviewer_email,reviewer_name,invite_token,due_at,status,assigned_at")
    .gte("assigned_at", rolloutAt)
    .eq("status", "invited")
    .order("assigned_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  let recovered = 0;
  for (const a of assignments ?? []) {
    const { data: existing, error: lookupError } = await db
      .from("peer_notification_outbox")
      .select("id")
      .eq("idempotency_key", `reviewer-invite-${a.id}`)
      .maybeSingle();
    if (lookupError) throw new Error(lookupError.message);
    if (existing) continue;
    const { data: paper, error: paperError } = await db
      .from("manuscript_submissions")
      .select("title,keywords,research_domain,status,decision,deleted_at")
      .eq("id", a.submission_id)
      .maybeSingle();
    if (paperError) throw new Error(paperError.message);
    if (
      !paper ||
      paper.deleted_at ||
      paper.decision === "declined" ||
      ["published", "waiting for edits"].includes(paper.status)
    )
      continue;
    await queuePeerNotification({
      key: `reviewer-invite-${a.id}`,
      submissionId: a.submission_id,
      assignmentId: a.id,
      event: "reviewer_invitation",
      template: "reviewer-invitation",
      recipient: a.reviewer_email,
      replyTo: "NYRJINFO@gmail.com",
      data: {
        reviewerName: a.reviewer_name || "Reviewer",
        assignmentId: a.id,
        title: paper.title,
        researchDomain: paper.research_domain,
        keywords: paper.keywords,
        dueDate: new Date(a.due_at).toLocaleDateString("en-US"),
        inviteUrl: `https://nyrj.org/review?token=${a.invite_token}`,
      },
    });
    recovered++;
  }
  return recovered;
}
