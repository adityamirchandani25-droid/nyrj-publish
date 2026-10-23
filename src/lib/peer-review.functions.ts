import type { ReviewerSubmission } from "./reviewer-submission";
import { reviewFeedbackSchema } from "./review-feedback";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { MASTER_STAFF_EMAILS } from "./staff-recipients";

const SITE_URL = "https://nyrj.org";

/** Editors who are notified about reviewer activity. */
export const EDITOR_RECIPIENTS = MASTER_STAFF_EMAILS;

const StaffSchema = z.object({ staffToken: z.string().min(1) });
const ReviewerSchema = z.object({ reviewerToken: z.string().min(1) });
const ReviewerInviteSchema = ReviewerSchema.extend({ token: z.string().min(10).max(200) });

export type AssignmentRow = {
  id: string;
  submission_id: string;
  reviewer_email: string;
  reviewer_name: string;
  status: string;
  assigned_by: string;
  assigned_at: string;
  due_at: string;
  responded_at: string | null;
  review_comments: string;
  review_submitted_at: string | null;
  review_file_path: string | null;
  review_file_name: string | null;
  edits_sent_at: string | null;
  edits_sent_body: string;
  edits_sent_file_path: string | null;
  edits_sent_file_name: string | null;
  invite_token: string;
};

export type AuditRow = {
  id: string;
  submission_id: string | null;
  actor: string;
  action: string;
  detail: string;
  created_at: string;
};

export type ReviewEmailReply = {
  id: string;
  assignment_id: string;
  from_email: string;
  subject: string;
  body_text: string;
  received_at: string;
  attachments: Array<{ name: string; path: string }>;
};

export type ReviewerRow = {
  id: string;
  name: string;
  email: string;
  username: string;
  expertise: string;
  status: string;
  created_at: string;
};

const ASSIGNMENT_COLS =
  "id, submission_id, reviewer_email, reviewer_name, status, assigned_by, assigned_at, due_at, responded_at, review_comments, review_submitted_at, review_file_path, review_file_name, edits_sent_at, edits_sent_body, edits_sent_file_path, edits_sent_file_name, invite_token";

const REVIEW_FILE_MIMES: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};
const MAX_REVIEW_FILE_BYTES = 8 * 1024 * 1024;

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

async function requireApprovedReviewer(reviewerToken: string) {
  const { verifyReviewerToken } = await import("./peer-review.server");
  const reviewerId = verifyReviewerToken(reviewerToken);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: reviewer, error } = await supabaseAdmin
    .from("peer_reviewers")
    .select("id, name, email, status")
    .eq("id", reviewerId)
    .maybeSingle();
  if (error) throw new Error("Could not verify your reviewer account. Please sign in again.");
  if (!reviewer || reviewer.status !== "approved") {
    throw new Error("This reviewer account is not active.");
  }
  return { ...reviewer, email: reviewer.email.trim().toLowerCase() };
}

function requireAssignmentOwner(accountEmail: string, assignmentEmail: string) {
  if (accountEmail !== assignmentEmail.trim().toLowerCase()) {
    throw new Error(
      "This invitation belongs to a different reviewer account. Sign in with the email address that received the invitation.",
    );
  }
}

/* ---------------------------------- staff --------------------------------- */

export const assignReviewer = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    StaffSchema.extend({
      submissionId: z.string().uuid(),
      reviewerEmail: z.string().trim().email().max(255),
      reviewerName: z.string().trim().max(200).optional().default(""),
      assignedBy: z.string().trim().max(120).optional().default(""),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { verifyStaffToken } = await import("./staff-auth.server");
    verifyStaffToken(data.staffToken);
    const { newToken, audit } = await import("./peer-review.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: sub, error: subErr } = await supabaseAdmin
      .from("manuscript_submissions")
      .select("id, title, keywords, research_domain, status, decision, deleted_at")
      .eq("id", data.submissionId)
      .single();
    if (subErr || !sub) throw new Error("Submission not found.");
    if (
      sub.deleted_at ||
      sub.decision === "declined" ||
      ["waiting for edits", "published"].includes(sub.status)
    ) {
      throw new Error("This manuscript is closed and cannot receive new reviewer invitations.");
    }

    // Bound outbound invitations so a staff session cannot be used to blast
    // unsolicited mail. Failed/declined invitations do not consume the cap so
    // staff can still appoint replacements after several non-responses.
    const reviewerEmail = data.reviewerEmail.trim().toLowerCase();
    const { data: existingInvites } = await supabaseAdmin
      .from("review_assignments")
      .select("reviewer_email, status")
      .eq("submission_id", data.submissionId);
    const invites = (existingInvites ?? []) as Array<{ reviewer_email: string; status: string }>;
    if (invites.some((r) => (r.reviewer_email ?? "").toLowerCase() === reviewerEmail)) {
      throw new Error("That reviewer has already been invited to this manuscript.");
    }
    const countedInvites = invites.filter(
      (invite) => !["declined", "no_response"].includes(invite.status),
    );
    if (countedInvites.length >= 6) {
      throw new Error("This manuscript already has the maximum number of reviewer invitations.");
    }

    const token = newToken();
    const assignmentId = crypto.randomUUID();
    const dueAt = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await supabaseAdmin.from("review_assignments").insert({
      id: assignmentId,
      submission_id: data.submissionId,
      reviewer_email: reviewerEmail,
      reviewer_name: data.reviewerName,
      invite_token: token,
      assigned_by: data.assignedBy,
      due_at: dueAt,
    } as never);
    if (error) throw new Error(error.message);

    const s = sub as { title: string; keywords: string; research_domain: string };
    const inviteUrl = `${SITE_URL}/review?token=${token}`;
    let emailSent = false;
    try {
      const { sendTemplateEmail } = await import("./email-templates/send-email");
      await sendTemplateEmail("reviewer-invitation", reviewerEmail, {
        idempotencyKey: `reviewer-invite-${token}`,
        replyTo: "NYRJINFO@gmail.com",
        templateData: {
          reviewerName: data.reviewerName || "Reviewer",
          assignmentId,
          title: s.title,
          researchDomain: s.research_domain,
          keywords: s.keywords,
          dueDate: fmtDate(dueAt),
          inviteUrl,
        },
      });
      await audit(
        data.submissionId,
        data.assignedBy || "staff",
        "Invitation email sent",
        `To ${data.reviewerEmail} · due ${fmtDate(dueAt)} · secure portal access required`,
      );
      emailSent = true;
    } catch (e) {
      console.error("[server] reviewer invite email failed:", e);
      await audit(
        data.submissionId,
        data.assignedBy || "staff",
        "Invitation email failed",
        `To ${data.reviewerEmail}`,
      );
    }
    return { ok: true, inviteUrl, emailSent };
  });

/** Re-sends the secure invitation link. Manuscript files remain behind reviewer login. */
export const resendReviewerInvitation = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => StaffSchema.extend({ assignmentId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { verifyStaffToken } = await import("./staff-auth.server");
    verifyStaffToken(data.staffToken);
    const { audit } = await import("./peer-review.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: a } = await supabaseAdmin
      .from("review_assignments")
      .select("submission_id, reviewer_email, reviewer_name, due_at, invite_token, status")
      .eq("id", data.assignmentId)
      .single();
    if (!a) throw new Error("Assignment not found.");
    const r = a as {
      submission_id: string;
      reviewer_email: string;
      reviewer_name: string;
      due_at: string;
      invite_token: string;
      status: string;
    };
    if (!["invited", "accepted"].includes(r.status)) {
      throw new Error("This reviewer invitation is no longer active.");
    }
    const { data: sub } = await supabaseAdmin
      .from("manuscript_submissions")
      .select("title, keywords, research_domain, status, decision, deleted_at")
      .eq("id", r.submission_id)
      .single();
    const s = (sub ?? {}) as {
      title?: string;
      keywords?: string;
      research_domain?: string;
      status?: string;
      decision?: string;
      deleted_at?: string | null;
    };
    if (
      !sub ||
      s.deleted_at ||
      s.decision === "declined" ||
      ["waiting for edits", "published"].includes(s.status ?? "")
    ) {
      throw new Error("This manuscript is closed and the invitation cannot be resent.");
    }
    const { sendTemplateEmail } = await import("./email-templates/send-email");
    await sendTemplateEmail("reviewer-invitation", r.reviewer_email, {
      idempotencyKey: `reviewer-invite-resend-${data.assignmentId}-${Date.now()}`,
      replyTo: "NYRJINFO@gmail.com",
      templateData: {
        reviewerName: r.reviewer_name || "Reviewer",
        assignmentId: data.assignmentId,
        title: s.title ?? "",
        researchDomain: s.research_domain ?? "",
        keywords: s.keywords ?? "",
        dueDate: fmtDate(r.due_at),
        inviteUrl: `${SITE_URL}/review?token=${r.invite_token}`,
      },
    });
    await audit(
      r.submission_id,
      "staff",
      "Secure reviewer invitation resent",
      `To ${r.reviewer_email}`,
    );
    return { ok: true };
  });

export const listAssignments = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => StaffSchema.extend({ submissionId: z.string().uuid() }).parse(d))
  .handler(async ({ data }): Promise<AssignmentRow[]> => {
    const { verifyStaffToken } = await import("./staff-auth.server");
    verifyStaffToken(data.staffToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("review_assignments")
      .select(ASSIGNMENT_COLS)
      .eq("submission_id", data.submissionId)
      .order("assigned_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []) as AssignmentRow[];
  });

export const listAuditLog = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    StaffSchema.extend({ submissionId: z.string().uuid().optional() }).parse(d),
  )
  .handler(async ({ data }): Promise<AuditRow[]> => {
    const { verifyStaffToken } = await import("./staff-auth.server");
    verifyStaffToken(data.staffToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("review_audit_log")
      .select("id, submission_id, actor, action, detail, created_at")
      .order("created_at", { ascending: false })
      .limit(300);
    if (data.submissionId) q = q.eq("submission_id", data.submissionId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as AuditRow[];
  });

export const listReviewEmailReplies = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => StaffSchema.extend({ submissionId: z.string().uuid() }).parse(d))
  .handler(async ({ data }): Promise<ReviewEmailReply[]> => {
    const { verifyStaffToken } = await import("./staff-auth.server");
    verifyStaffToken(data.staffToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: assignments, error: assignmentError } = await supabaseAdmin
      .from("review_assignments")
      .select("id")
      .eq("submission_id", data.submissionId);
    if (assignmentError) throw new Error(assignmentError.message);
    const ids = (assignments ?? []).map((row) => row.id);
    if (!ids.length) return [];
    const { data: rows, error } = await supabaseAdmin
      .from("peer_review_email_replies")
      .select("id, assignment_id, from_email, subject, body_text, received_at, attachments")
      .in("assignment_id", ids)
      .order("received_at", { ascending: false })
      .limit(300);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((row) => ({
      ...row,
      attachments: Array.isArray(row.attachments)
        ? (row.attachments as ReviewEmailReply["attachments"])
        : [],
    }));
  });

export const openReviewEmailAttachment = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    StaffSchema.extend({ replyId: z.string().uuid(), path: z.string().min(1).max(500) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { verifyStaffToken } = await import("./staff-auth.server");
    verifyStaffToken(data.staffToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: reply } = await supabaseAdmin
      .from("peer_review_email_replies")
      .select("attachments")
      .eq("id", data.replyId)
      .maybeSingle();
    const attachment = Array.isArray(reply?.attachments)
      ? (reply.attachments as ReviewEmailReply["attachments"]).find(
          (file) => file.path === data.path,
        )
      : null;
    if (!attachment) throw new Error("This attachment is not part of that email reply.");
    const { data: signed, error } = await supabaseAdmin.storage
      .from("submissions")
      .createSignedUrl(attachment.path, 60 * 10, { download: attachment.name });
    if (error || !signed) throw new Error("Could not open the email attachment.");
    return { url: signed.signedUrl };
  });

export const markEmailReplyAsReview = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    StaffSchema.extend({
      replyId: z.string().uuid(),
      attachmentPath: z.string().max(500).optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { verifyStaffToken } = await import("./staff-auth.server");
    verifyStaffToken(data.staffToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { audit } = await import("./peer-review.server");
    const { data: reply, error: replyError } = await supabaseAdmin
      .from("peer_review_email_replies")
      .select("assignment_id, body_text, received_at, attachments")
      .eq("id", data.replyId)
      .maybeSingle();
    if (replyError || !reply) throw new Error("Email reply not found.");
    const attachments = Array.isArray(reply.attachments)
      ? (reply.attachments as ReviewEmailReply["attachments"])
      : [];
    const selected = data.attachmentPath
      ? attachments.find((attachment) => attachment.path === data.attachmentPath)
      : undefined;
    if (data.attachmentPath && !selected)
      throw new Error("That attachment is not part of this reply.");
    if (!reply.body_text.trim() && !selected)
      throw new Error("Select an attached review or use an email with feedback text.");
    const { data: assignment } = await supabaseAdmin
      .from("review_assignments")
      .select("submission_id")
      .eq("id", reply.assignment_id)
      .maybeSingle();
    if (!assignment) throw new Error("The reviewer assignment no longer exists.");
    const { data: updated, error } = await supabaseAdmin
      .from("review_assignments")
      .update({
        status: "review_received",
        review_comments: reply.body_text.trim(),
        review_submitted_at: reply.received_at,
        review_file_path: selected?.path ?? null,
        review_file_name: selected?.name ?? null,
      } as never)
      .eq("id", reply.assignment_id)
      .in("status", ["invited", "accepted", "no_response", "review_received"])
      .select("id")
      .maybeSingle();
    if (error || !updated)
      throw new Error("This assignment can no longer receive reviewer feedback.");
    const { dispatchReviewNotifications } = await import("./review-workflow.server");
    await dispatchReviewNotifications(assignment.submission_id).catch(console.error);
    await audit(
      assignment.submission_id,
      "staff",
      "Email reply marked as reviewer feedback",
      data.replyId,
    );
    return { ok: true };
  });

export const recordReviewerEmailDecision = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    StaffSchema.extend({
      replyId: z.string().uuid(),
      decision: z.enum(["accepted", "declined"]),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { verifyStaffToken } = await import("./staff-auth.server");
    verifyStaffToken(data.staffToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { audit } = await import("./peer-review.server");
    const { data: reply } = await supabaseAdmin
      .from("peer_review_email_replies")
      .select("assignment_id, from_email, received_at")
      .eq("id", data.replyId)
      .maybeSingle();
    if (!reply) throw new Error("Email reply not found.");
    const { data: updated, error } = await supabaseAdmin
      .from("review_assignments")
      .update({ status: data.decision, responded_at: reply.received_at } as never)
      .eq("id", reply.assignment_id)
      .eq("status", "invited")
      .select("submission_id")
      .maybeSingle();
    if (error || !updated) throw new Error("This invitation is no longer awaiting a response.");
    await audit(
      updated.submission_id,
      "staff",
      `Reviewer ${data.decision} by email`,
      reply.from_email,
    );
    return { ok: true };
  });

export const openReviewFileForStaff = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => StaffSchema.extend({ assignmentId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { verifyStaffToken } = await import("./staff-auth.server");
    verifyStaffToken(data.staffToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("review_assignments")
      .select("review_file_path, review_file_name")
      .eq("id", data.assignmentId)
      .maybeSingle();
    if (!row?.review_file_path) throw new Error("No reviewer file is attached.");
    const { data: signed, error } = await supabaseAdmin.storage
      .from("submissions")
      .createSignedUrl(row.review_file_path, 60 * 10, {
        download: row.review_file_name || "review-feedback",
      });
    if (error || !signed) throw new Error("Could not open the reviewer file.");
    return { url: signed.signedUrl };
  });

export const sendEditsToAuthor = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    StaffSchema.extend({
      assignmentId: z.string().uuid(),
      body: z.string().trim().min(1, "Please write the feedback to send.").max(20000),
      includeFile: z.boolean().optional().default(false),
      sentBy: z.string().trim().max(120).optional().default(""),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { verifyStaffToken } = await import("./staff-auth.server");
    verifyStaffToken(data.staffToken);
    const { audit } = await import("./peer-review.server");
    const { newResubmitToken } = await import("./editor-auth.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: a, error } = await supabaseAdmin
      .from("review_assignments")
      .select("id, submission_id, status, review_file_path, review_file_name")
      .eq("id", data.assignmentId)
      .single();
    if (error || !a) throw new Error("Assignment not found.");
    if (!["review_received", "sent_to_author"].includes(a.status)) {
      throw new Error("No completed review is ready for staff approval.");
    }
    if (data.includeFile && (!a.review_file_path || !a.review_file_name)) {
      throw new Error("This review has no file to share.");
    }
    const submissionId = (a as { submission_id: string }).submission_id;

    const { data: sub, error: submissionError } = await supabaseAdmin
      .from("manuscript_submissions")
      .select("title, submitter_email, authors, resubmit_token, decision, deleted_at")
      .eq("id", submissionId)
      .single();
    if (submissionError || !sub) throw new Error("Submission not found.");
    const s = (sub ?? {}) as {
      title?: string;
      submitter_email?: string;
      authors?: Array<{ name?: string }>;
      resubmit_token?: string | null;
      decision?: string;
      deleted_at?: string | null;
    };
    if (!s.submitter_email) throw new Error("No author email on this submission.");
    if (s.deleted_at || s.decision === "declined") {
      throw new Error("This submission already has a final decision and cannot request edits.");
    }

    const resubmitToken = s.resubmit_token ?? newResubmitToken();
    // Activate the revision window before sending the email so the link works
    // the instant it arrives. Re-sending feedback safely reuses the same token.
    const { data: revisionState, error: tokenError } = await supabaseAdmin
      .from("manuscript_submissions")
      .update({ resubmit_token: resubmitToken, status: "waiting for edits" } as never)
      .eq("id", submissionId)
      .neq("decision", "declined")
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (tokenError || !revisionState) {
      throw new Error("This paper is no longer open for revisions.");
    }
    const resubmitUrl = `${SITE_URL}/resubmit?token=${resubmitToken}`;

    // Save the exact feedback first so the student account can show it even
    // if email delivery is delayed or fails.
    const { error: saveEditsError } = await supabaseAdmin
      .from("review_assignments")
      .update({
        status: "sent_to_author",
        edits_sent_at: new Date().toISOString(),
        edits_sent_body: data.body,
        edits_sent_file_path: data.includeFile ? a.review_file_path : null,
        edits_sent_file_name: data.includeFile ? a.review_file_name : null,
      } as never)
      .eq("id", data.assignmentId);
    if (saveEditsError) throw new Error("Could not save the requested edits.");

    const { sendTemplateEmail } = await import("./email-templates/send-email");
    await sendTemplateEmail("author-edits", s.submitter_email, {
      idempotencyKey: `author-edits-${data.assignmentId}-${Date.now()}`,
      replyTo: "NYRJINFO@gmail.com",
      templateData: {
        authorName: Array.isArray(s.authors) ? (s.authors[0]?.name ?? "there") : "there",
        title: s.title ?? "your manuscript",
        body: data.body,
        resubmitUrl,
        hasReviewFile: data.includeFile,
      },
    });
    const { error: followupError } = await supabaseAdmin
      .from("manuscript_submissions")
      .update({
        revision_requested_at: new Date().toISOString(),
        revision_reminder_sent_at: null,
        revision_staff_alert_sent_at: null,
      } as never)
      .eq("id", submissionId)
      .eq("status", "waiting for edits");
    if (followupError) console.error("[server] revision follow-up state failed:", followupError);

    try {
      const { updateSubmissionRow } = await import("./excel-sync.server");
      await updateSubmissionRow(submissionId, { status: "waiting for edits" });
    } catch (syncError) {
      console.error("[server] revision-request workbook sync failed:", syncError);
    }

    await audit(
      submissionId,
      data.sentBy || "staff",
      "Edits emailed to author",
      `To ${s.submitter_email}${data.includeFile ? " · reviewer file approved" : " · comments only"}`,
    );
    return { ok: true };
  });

/* --------------------------- reviewer accounts ---------------------------- */

export const registerReviewer = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        name: z.string().trim().min(1).max(200),
        email: z.string().trim().email().max(255),
        username: z.string().trim().min(3).max(60),
        password: z.string().min(8, "Use at least 8 characters.").max(200),
        expertise: z.string().trim().max(500).optional().default(""),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { enforceRateLimit } = await import("./rate-limit.server");
    await enforceRateLimit({ scope: "reviewer-register", limit: 3, windowSeconds: 60 * 60 });
    const { hashPassword, newSalt, audit } = await import("./peer-review.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const salt = newSalt();
    const hash = await hashPassword(data.password, salt);
    const { error } = await supabaseAdmin.from("peer_reviewers").insert({
      name: data.name,
      email: data.email.toLowerCase(),
      username: data.username.toLowerCase(),
      password_hash: hash,
      password_salt: salt,
      expertise: data.expertise,
      status: "pending",
    } as never);
    if (error) {
      if (error.code === "23505") throw new Error("That email or username is already registered.");
      console.error("[server] registerReviewer error:", error);
      throw new Error("Could not create the account. Please try again.");
    }
    await audit(null, data.email.toLowerCase(), "Reviewer account requested", data.name);
    try {
      const { sendTemplateEmailToMany } = await import("./email-templates/send-email");
      await sendTemplateEmailToMany("reviewer-account-request", EDITOR_RECIPIENTS, (to) => ({
        idempotencyKey: `reviewer-account-request-${data.email.toLowerCase()}-${to}`,
        replyTo: data.email.toLowerCase(),
        templateData: {
          reviewerName: data.name,
          reviewerEmail: data.email.toLowerCase(),
          username: data.username.toLowerCase(),
          expertise: data.expertise,
          adminUrl: `${SITE_URL}/admin/submissions`,
        },
      }));
      await audit(null, "system", "Staff notified of reviewer request", data.email.toLowerCase());
    } catch (emailError) {
      console.error("[server] reviewer account request email failed:", emailError);
      await audit(null, "system", "Reviewer request notification failed", data.email.toLowerCase());
    }
    return { ok: true };
  });

export const reviewerLogin = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({ username: z.string().trim().min(1).max(60), password: z.string().min(1).max(200) })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { enforceRateLimit } = await import("./rate-limit.server");
    await enforceRateLimit({ scope: "reviewer-login", limit: 8, windowSeconds: 10 * 60 });
    const { verifyPassword, issueReviewerToken } = await import("./peer-review.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("peer_reviewers")
      .select("id, name, email, password_hash, password_salt, status")
      .eq("username", data.username.trim().toLowerCase())
      .maybeSingle();
    const r = row as {
      id: string;
      name: string;
      email: string;
      password_hash: string;
      password_salt: string;
      status: string;
    } | null;
    if (!r) throw new Error("Incorrect username or password.");
    const ok = await verifyPassword(data.password, r.password_salt, r.password_hash);
    if (!ok) throw new Error("Incorrect username or password.");
    if (r.status === "pending")
      throw new Error("Your reviewer account is awaiting approval by our editorial staff.");
    if (r.status !== "approved") throw new Error("This reviewer account is not active.");
    const { token, expiresAt } = issueReviewerToken(r.id);
    return { token, expiresAt, name: r.name, email: r.email };
  });

export const listReviewers = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => StaffSchema.parse(d))
  .handler(async ({ data }): Promise<ReviewerRow[]> => {
    const { verifyStaffToken } = await import("./staff-auth.server");
    verifyStaffToken(data.staffToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("peer_reviewers")
      .select("id, name, email, username, expertise, status, created_at")
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) throw new Error(error.message);
    return (rows ?? []) as ReviewerRow[];
  });

export const setReviewerStatus = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    StaffSchema.extend({
      id: z.string().uuid(),
      status: z.enum(["approved", "rejected", "pending"]),
      actor: z.string().trim().max(120).optional().default(""),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { verifyStaffToken } = await import("./staff-auth.server");
    verifyStaffToken(data.staffToken);
    const { audit } = await import("./peer-review.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("peer_reviewers")
      .update({
        status: data.status,
        approved_at: data.status === "approved" ? new Date().toISOString() : null,
      } as never)
      .eq("id", data.id)
      .select("name, email")
      .single();
    if (error) throw new Error(error.message);
    const r = row as { name: string; email: string };
    let emailSent = data.status === "pending";
    if (data.status !== "pending") {
      try {
        const { sendTemplateEmail } = await import("./email-templates/send-email");
        await sendTemplateEmail("reviewer-account-approved", r.email, {
          idempotencyKey: `reviewer-decision-${data.id}-${data.status}`,
          replyTo: "NYRJINFO@gmail.com",
          templateData: { reviewerName: r.name, approved: data.status === "approved" },
        });
        emailSent = true;
      } catch (e) {
        console.error("[server] reviewer decision email failed:", e);
      }
    }
    await audit(
      null,
      data.actor || "staff",
      `Reviewer account ${data.status}`,
      `${r.name} (${r.email})`,
    );
    return { ok: true, emailSent };
  });

/* ----------------------- reviewer-facing operations ----------------------- */

export type InviteView = {
  submission: ReviewerSubmission | null;
  assignmentId: string;
  title: string;
  abstract: string;
  keywords: string;
  researchDomain: string;
  reviewerName: string;
  status: string;
  dueAt: string;
  comments: string;
  reviewFileName: string | null;
  manuscriptFilename: string;
  manuscriptUrl: string | null;
};

async function loadInviteByToken(token: string, reviewerToken: string): Promise<InviteView> {
  const reviewer = await requireApprovedReviewer(reviewerToken);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: a } = await supabaseAdmin
    .from("review_assignments")
    .select(
      "id, submission_id, reviewer_email, reviewer_name, status, due_at, review_comments, review_file_name",
    )
    .eq("invite_token", token)
    .maybeSingle();
  if (!a) throw new Error("This review link is not valid.");
  const row = a as {
    id: string;
    submission_id: string;
    reviewer_email: string;
    reviewer_name: string;
    status: string;
    due_at: string;
    review_comments: string;
    review_file_name: string | null;
  };
  requireAssignmentOwner(reviewer.email, row.reviewer_email);
  const { data: sub } = await supabaseAdmin
    .from("manuscript_submissions")
    .select("title, abstract, keywords, research_domain, manuscript_path, manuscript_filename")
    .eq("id", row.submission_id)
    .single();
  const s = (sub ?? {}) as {
    title?: string;
    abstract?: string;
    keywords?: string;
    research_domain?: string;
    manuscript_path?: string;
    manuscript_filename?: string;
  };
  const canReadManuscript = ["accepted", "review_received", "sent_to_author"].includes(row.status);
  const { signedReviewerManuscript } = await import("./reviewer-resources.server");
  const { reviewerSubmission } = await import("./reviewer-submission.server");
  return {
    submission: canReadManuscript ? await reviewerSubmission(row.submission_id) : null,
    assignmentId: row.id,
    title: s.title ?? "",
    abstract: s.abstract ?? "",
    keywords: s.keywords ?? "",
    researchDomain: s.research_domain ?? "",
    reviewerName: row.reviewer_name,
    status: row.status,
    dueAt: row.due_at,
    comments: row.review_comments,
    reviewFileName: row.review_file_name,
    manuscriptFilename: s.manuscript_filename ?? "manuscript.pdf",
    manuscriptUrl: canReadManuscript
      ? await signedReviewerManuscript(s.manuscript_path, s.manuscript_filename)
      : null,
  };
}

export const getReviewerWorkflow = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => ReviewerSchema.parse(d))
  .handler(async ({ data }) => {
    await requireApprovedReviewer(data.reviewerToken);
    const { signedEditorialWorkflowUrl } = await import("./reviewer-resources.server");
    return { url: await signedEditorialWorkflowUrl() };
  });

export const getInvite = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => ReviewerInviteSchema.parse(d))
  .handler(async ({ data }) => loadInviteByToken(data.token, data.reviewerToken));

export const respondToInvite = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => ReviewerInviteSchema.extend({ accept: z.boolean() }).parse(d))
  .handler(async ({ data }) => {
    const reviewer = await requireApprovedReviewer(data.reviewerToken);
    const { audit } = await import("./peer-review.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: a } = await supabaseAdmin
      .from("review_assignments")
      .select("id, submission_id, reviewer_email, reviewer_name, status, due_at")
      .eq("invite_token", data.token)
      .maybeSingle();
    if (!a) throw new Error("This review link is not valid.");
    const row = a as {
      id: string;
      submission_id: string;
      reviewer_email: string;
      reviewer_name: string;
      status: string;
      due_at: string;
    };
    requireAssignmentOwner(reviewer.email, row.reviewer_email);
    if (row.status !== "invited") throw new Error("You have already responded to this invitation.");
    const { data: updated, error: updateError } = await supabaseAdmin
      .from("review_assignments")
      .update({
        status: data.accept ? "accepted" : "declined",
        responded_at: new Date().toISOString(),
      } as never)
      .eq("id", row.id)
      .eq("status", "invited")
      .select("id")
      .maybeSingle();
    if (updateError) throw new Error("Could not save your response. Please try again.");
    if (!updated) throw new Error("You have already responded to this invitation.");
    await audit(
      row.submission_id,
      row.reviewer_email,
      data.accept ? "Invitation accepted" : "Invitation declined",
    );

    const { data: sub } = await supabaseAdmin
      .from("manuscript_submissions")
      .select("title")
      .eq("id", row.submission_id)
      .single();
    try {
      const { sendTemplateEmailToMany } = await import("./email-templates/send-email");
      await sendTemplateEmailToMany("reviewer-response", EDITOR_RECIPIENTS, (to) => ({
        idempotencyKey: `reviewer-response-${row.id}-${data.accept ? "a" : "d"}-${to}`,
        replyTo: row.reviewer_email,
        templateData: {
          reviewerName: row.reviewer_name || row.reviewer_email,
          reviewerEmail: row.reviewer_email,
          title: (sub as { title?: string } | null)?.title ?? "",
          accepted: data.accept,
          dueDate: row.due_at ? fmtDate(row.due_at) : "",
        },
      }));
      await audit(
        row.submission_id,
        "system",
        "Editors notified",
        data.accept ? "Reviewer accepted" : "Reviewer declined",
      );
    } catch (e) {
      console.error("[server] reviewer response email failed:", e);
    }
    return { ok: true };
  });

export const createReviewUpload = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    ReviewerInviteSchema.extend({ filename: z.string().trim().min(1).max(255) }).parse(d),
  )
  .handler(async ({ data }) => {
    const reviewer = await requireApprovedReviewer(data.reviewerToken);
    const extension = data.filename.split(".").pop()?.toLowerCase() ?? "";
    if (!REVIEW_FILE_MIMES[extension]) {
      throw new Error("Please choose a PDF or Word document (.pdf, .doc, .docx).");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: assignment } = await supabaseAdmin
      .from("review_assignments")
      .select("id, reviewer_email, status")
      .eq("invite_token", data.token)
      .maybeSingle();
    if (!assignment) throw new Error("This review link is not valid.");
    requireAssignmentOwner(reviewer.email, assignment.reviewer_email);
    if (!["accepted", "review_received"].includes(assignment.status)) {
      throw new Error("This review is no longer open for uploads.");
    }
    const path = `review-feedback/${assignment.id}/${crypto.randomUUID()}.${extension}`;
    const { data: signed, error } = await supabaseAdmin.storage
      .from("submissions")
      .createSignedUploadUrl(path);
    if (error || !signed) throw new Error("Could not prepare the file upload.");
    return { path, token: signed.token };
  });

export const submitReview = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => ReviewerInviteSchema.and(reviewFeedbackSchema).parse(d))
  .handler(async ({ data }) => {
    const reviewer = await requireApprovedReviewer(data.reviewerToken);
    const { audit } = await import("./peer-review.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: a } = await supabaseAdmin
      .from("review_assignments")
      .select("id, submission_id, reviewer_email, reviewer_name, status, review_file_name")
      .eq("invite_token", data.token)
      .maybeSingle();
    if (!a) throw new Error("This review link is not valid.");
    const row = a as {
      id: string;
      submission_id: string;
      reviewer_email: string;
      reviewer_name: string;
      status: string;
      review_file_name: string | null;
    };
    requireAssignmentOwner(reviewer.email, row.reviewer_email);
    if (!["accepted", "review_received"].includes(row.status)) {
      throw new Error("Accept this review invitation before submitting your review.");
    }

    const { data: paperState, error: paperStateError } = await supabaseAdmin
      .from("manuscript_submissions")
      .select("status,decision,deleted_at")
      .eq("id", row.submission_id)
      .single();
    if (
      paperStateError ||
      !paperState ||
      paperState.deleted_at ||
      paperState.decision === "declined" ||
      ["published", "waiting for edits"].includes(paperState.status)
    ) {
      throw new Error("This paper is not currently open for reviewer feedback.");
    }
    let reviewFile: { review_file_path: string; review_file_name: string } | null = null;
    if (data.filePath || data.fileName) {
      const extension = data.fileName?.split(".").pop()?.toLowerCase() ?? "";
      if (
        !data.filePath ||
        !data.fileName ||
        !REVIEW_FILE_MIMES[extension] ||
        !new RegExp(`^review-feedback/${row.id}/[0-9a-f-]+\\.${extension}$`).test(data.filePath)
      ) {
        throw new Error("The review attachment is not valid.");
      }
      const { data: blob, error: downloadError } = await supabaseAdmin.storage
        .from("submissions")
        .download(data.filePath);
      if (downloadError || !blob)
        throw new Error("The review attachment did not upload. Please try again.");
      if (blob.size > MAX_REVIEW_FILE_BYTES) {
        await supabaseAdmin.storage.from("submissions").remove([data.filePath]);
        throw new Error("The review attachment must be 8 MB or smaller.");
      }
      reviewFile = { review_file_path: data.filePath, review_file_name: data.fileName };
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("review_assignments")
      .update({
        status: "review_received",
        review_comments: data.comments,
        review_submitted_at: new Date().toISOString(),
        review_file_path: reviewFile?.review_file_path ?? null,
        review_file_name: reviewFile?.review_file_name ?? null,
      } as never)
      .eq("id", row.id)
      .in("status", ["accepted", "review_received"])
      .select("id")
      .maybeSingle();
    if (updateError || !updated) throw new Error("Could not save your review. Please try again.");

    const { data: sub } = await supabaseAdmin
      .from("manuscript_submissions")
      .select("title")
      .eq("id", row.submission_id)
      .single();

    const stamp = Date.now();
    try {
      const { dispatchReviewNotifications } = await import("./review-workflow.server");
      await dispatchReviewNotifications(row.submission_id);
      await audit(
        row.submission_id,
        row.reviewer_email,
        "Review submitted",
        "Staff notifications queued",
      );
    } catch (e) {
      console.error("[server] review notification failed:", e);
      await audit(
        row.submission_id,
        row.reviewer_email,
        "Review submitted",
        "Staff notification pending retry",
      );
    }

    try {
      const { sendTemplateEmail } = await import("./email-templates/send-email");
      await sendTemplateEmail("review-thank-you", row.reviewer_email, {
        idempotencyKey: `review-thanks-${row.id}-${stamp}`,
        replyTo: "NYRJINFO@gmail.com",
        templateData: {
          reviewerName: row.reviewer_name || "Reviewer",
          title: (sub as { title?: string } | null)?.title ?? "the manuscript",
        },
      });
      await audit(row.submission_id, "system", "Thank-you email sent", `To ${row.reviewer_email}`);
    } catch (e) {
      console.error("[server] review thank-you email failed:", e);
    }

    return { ok: true };
  });

export type ReviewerAssignmentView = InviteView & { token: string; submissionId: string };

export const listMyAssignments = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => ReviewerSchema.parse(d))
  .handler(async ({ data }): Promise<ReviewerAssignmentView[]> => {
    const reviewer = await requireApprovedReviewer(data.reviewerToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("review_assignments")
      .select(
        "id, submission_id, invite_token, reviewer_name, status, due_at, review_comments, review_file_name",
      )
      .eq("reviewer_email", reviewer.email)
      .order("assigned_at", { ascending: false })
      .limit(200);

    const list = (rows ?? []) as Array<{
      id: string;
      submission_id: string;
      invite_token: string;
      reviewer_name: string;
      status: string;
      due_at: string;
      review_comments: string;
      review_file_name: string | null;
    }>;
    if (list.length === 0) return [];

    const { data: subs } = await supabaseAdmin
      .from("manuscript_submissions")
      .select(
        "id, title, abstract, keywords, research_domain, manuscript_path, manuscript_filename",
      )
      .in(
        "id",
        list.map((x) => x.submission_id),
      );
    const byId = new Map(
      (
        (subs ?? []) as Array<{
          id: string;
          title: string;
          abstract: string | null;
          keywords: string;
          research_domain: string;
          manuscript_path: string | null;
          manuscript_filename: string | null;
        }>
      ).map((s) => [s.id, s]),
    );

    const { signedReviewerManuscript } = await import("./reviewer-resources.server");
    const { reviewerSubmission } = await import("./reviewer-submission.server");
    return Promise.all(
      list.map(async (x) => {
        const s = byId.get(x.submission_id);
        const canReadManuscript = ["accepted", "review_received", "sent_to_author"].includes(
          x.status,
        );
        return {
          submission: canReadManuscript ? await reviewerSubmission(x.submission_id) : null,
          assignmentId: x.id,
          submissionId: x.submission_id,
          token: x.invite_token,
          title: s?.title ?? "",
          abstract: s?.abstract ?? "",
          keywords: s?.keywords ?? "",
          researchDomain: s?.research_domain ?? "",
          reviewerName: x.reviewer_name,
          status: x.status,
          dueAt: x.due_at,
          comments: x.review_comments,
          reviewFileName: x.review_file_name,
          manuscriptFilename: s?.manuscript_filename ?? "manuscript.pdf",
          manuscriptUrl: canReadManuscript
            ? await signedReviewerManuscript(s?.manuscript_path, s?.manuscript_filename)
            : null,
        };
      }),
    );
  });

/* ------------------------ reviewer password reset ------------------------- */

export const requestReviewerPasswordReset = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ email: z.string().trim().email().max(255) }).parse(d))
  .handler(async ({ data }) => {
    const { enforceRateLimit } = await import("./rate-limit.server");
    await enforceRateLimit({ scope: "reviewer-reset-ip", limit: 5, windowSeconds: 60 * 60 });
    await enforceRateLimit({
      scope: "reviewer-reset-email",
      limit: 3,
      windowSeconds: 60 * 60,
      identity: data.email.toLowerCase(),
    });
    const { issueResetToken, audit } = await import("./peer-review.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("peer_reviewers")
      .select("id, name, email, password_hash, status")
      .eq("email", data.email.toLowerCase())
      .maybeSingle();
    const r = row as {
      id: string;
      name: string;
      email: string;
      password_hash: string;
      status: string;
    } | null;
    // Always report success so the form cannot be used to discover accounts.
    if (r && r.status !== "rejected") {
      const token = issueResetToken(r.id, r.password_hash);
      try {
        const { sendTemplateEmail } = await import("./email-templates/send-email");
        await sendTemplateEmail("reviewer-password-reset", r.email, {
          idempotencyKey: `reviewer-reset-${token.slice(-24)}`,
          replyTo: "NYRJINFO@gmail.com",
          templateData: {
            reviewerName: r.name || "Reviewer",
            resetUrl: `https://nyrj.org/review?reset=${encodeURIComponent(token)}`,
          },
        });
        await audit(null, r.email, "Password reset link sent", "");
      } catch (e) {
        console.error("[server] reviewer reset email failed:", e);
      }
    }
    return { ok: true };
  });

export const resetReviewerPassword = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: z.string().min(1),
        password: z.string().min(8, "Use at least 8 characters.").max(200),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { enforceRateLimit } = await import("./rate-limit.server");
    await enforceRateLimit({ scope: "reviewer-reset-use", limit: 10, windowSeconds: 60 * 60 });
    const { verifyResetToken, resetTokenMatches, hashPassword, newSalt, audit } =
      await import("./peer-review.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { reviewerId, expiresAt, signature } = verifyResetToken(data.token);
    const { data: row } = await supabaseAdmin
      .from("peer_reviewers")
      .select("id, name, email, password_hash")
      .eq("id", reviewerId)
      .maybeSingle();
    const r = row as { id: string; name: string; email: string; password_hash: string } | null;
    if (!r) throw new Error("This reset link is not valid.");
    if (!resetTokenMatches(r.id, expiresAt, signature, r.password_hash))
      throw new Error("This reset link has already been used. Please request a new one.");
    const salt = newSalt();
    const hash = await hashPassword(data.password, salt);
    const { error } = await supabaseAdmin
      .from("peer_reviewers")
      .update({ password_hash: hash, password_salt: salt } as never)
      .eq("id", r.id);
    if (error) {
      console.error("[server] resetReviewerPassword error:", error);
      throw new Error("Could not save the new password. Please try again.");
    }
    await audit(null, r.email, "Password reset completed", "");
    return { ok: true };
  });

export const getReviewerFeedbackHistory = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => ReviewerInviteSchema.parse(d))
  .handler(async ({ data }) => {
    const reviewer = await requireApprovedReviewer(data.reviewerToken);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { data: assignment, error } = await db
      .from("review_assignments")
      .select("id,reviewer_email")
      .eq("invite_token", data.token)
      .single();
    if (error || !assignment) throw new Error("Review assignment not found.");
    requireAssignmentOwner(reviewer.email, assignment.reviewer_email);
    const { allRows } = await import("./review-workflow.server");
    const versions = await allRows((a, b) =>
      db
        .from("review_feedback_versions")
        .select("id,comments,file_name,file_path,submitted_at")
        .eq("assignment_id", assignment.id)
        .order("recorded_at", { ascending: false })
        .order("id")
        .range(a, b),
    );
    return Promise.all(
      versions.map(async (v) => {
        let fileUrl: string | null = null;
        if (v.file_path) {
          const { data: signed, error: signError } = await db.storage
            .from("submissions")
            .createSignedUrl(v.file_path, 600, { download: v.file_name || "annotated-paper" });
          if (signError) throw new Error("Could not open feedback history attachment.");
          fileUrl = signed?.signedUrl ?? null;
        }
        return {
          id: v.id,
          comments: v.comments,
          fileName: v.file_name,
          submittedAt: v.submitted_at,
          fileUrl,
        };
      }),
    );
  });
