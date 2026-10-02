import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const SITE_URL = "https://nyrj.org";

/** Editors who are notified about reviewer activity. */
export const EDITOR_RECIPIENTS = ["keyaanmerchant24@gmail.com", "Madhavarora529@gmail.com"];

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
  edits_sent_at: string | null;
  edits_sent_body: string;
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
  "id, submission_id, reviewer_email, reviewer_name, status, assigned_by, assigned_at, due_at, responded_at, review_comments, review_submitted_at, edits_sent_at, edits_sent_body, invite_token";

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
      .select("id, title, keywords, research_domain")
      .eq("id", data.submissionId)
      .single();
    if (subErr || !sub) throw new Error("Submission not found.");

    // Bound outbound invitations so a staff session cannot be used to blast
    // unsolicited mail: no duplicates, and at most 6 reviewers per manuscript.
    const reviewerEmail = data.reviewerEmail.trim().toLowerCase();
    const { data: existingInvites } = await supabaseAdmin
      .from("review_assignments")
      .select("reviewer_email")
      .eq("submission_id", data.submissionId);
    const invites = (existingInvites ?? []) as Array<{ reviewer_email: string }>;
    if (invites.some((r) => (r.reviewer_email ?? "").toLowerCase() === reviewerEmail)) {
      throw new Error("That reviewer has already been invited to this manuscript.");
    }
    if (invites.length >= 6) {
      throw new Error("This manuscript already has the maximum number of reviewer invitations.");
    }

    const token = newToken();
    const dueAt = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await supabaseAdmin.from("review_assignments").insert({
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
      .select("submission_id, reviewer_email, reviewer_name, due_at, invite_token")
      .eq("id", data.assignmentId)
      .single();
    if (!a) throw new Error("Assignment not found.");
    const r = a as {
      submission_id: string;
      reviewer_email: string;
      reviewer_name: string;
      due_at: string;
      invite_token: string;
    };
    const { data: sub } = await supabaseAdmin
      .from("manuscript_submissions")
      .select("title, keywords, research_domain")
      .eq("id", r.submission_id)
      .single();
    const s = (sub ?? {}) as { title?: string; keywords?: string; research_domain?: string };
    const { sendTemplateEmail } = await import("./email-templates/send-email");
    await sendTemplateEmail("reviewer-invitation", r.reviewer_email, {
      idempotencyKey: `reviewer-invite-resend-${data.assignmentId}-${Date.now()}`,
      replyTo: "NYRJINFO@gmail.com",
      templateData: {
        reviewerName: r.reviewer_name || "Reviewer",
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
  .inputValidator((d: unknown) => StaffSchema.parse(d))
  .handler(async ({ data }): Promise<AssignmentRow[]> => {
    const { verifyStaffToken } = await import("./staff-auth.server");
    verifyStaffToken(data.staffToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("review_assignments")
      .select(ASSIGNMENT_COLS)
      .order("assigned_at", { ascending: false })
      .limit(500);
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

export const sendEditsToAuthor = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    StaffSchema.extend({
      assignmentId: z.string().uuid(),
      body: z.string().trim().min(1, "Please write the feedback to send.").max(20000),
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
      .select("id, submission_id")
      .eq("id", data.assignmentId)
      .single();
    if (error || !a) throw new Error("Assignment not found.");
    const submissionId = (a as { submission_id: string }).submission_id;

    const { data: sub, error: submissionError } = await supabaseAdmin
      .from("manuscript_submissions")
      .select("title, submitter_email, authors, resubmit_token")
      .eq("id", submissionId)
      .single();
    if (submissionError || !sub) throw new Error("Submission not found.");
    const s = (sub ?? {}) as {
      title?: string;
      submitter_email?: string;
      authors?: Array<{ name?: string }>;
      resubmit_token?: string | null;
    };
    if (!s.submitter_email) throw new Error("No author email on this submission.");

    const resubmitToken = s.resubmit_token ?? newResubmitToken();
    if (!s.resubmit_token) {
      const { error: tokenError } = await supabaseAdmin
        .from("manuscript_submissions")
        .update({ resubmit_token: resubmitToken } as never)
        .eq("id", submissionId);
      if (tokenError) throw new Error("Could not create the author's resubmission link.");
    }
    const resubmitUrl = `${SITE_URL}/resubmit?token=${resubmitToken}`;

    const { sendTemplateEmail } = await import("./email-templates/send-email");
    await sendTemplateEmail("author-edits", s.submitter_email, {
      idempotencyKey: `author-edits-${data.assignmentId}-${Date.now()}`,
      replyTo: "NYRJINFO@gmail.com",
      templateData: {
        authorName: Array.isArray(s.authors) ? (s.authors[0]?.name ?? "there") : "there",
        title: s.title ?? "your manuscript",
        body: data.body,
        resubmitUrl,
      },
    });

    await supabaseAdmin
      .from("review_assignments")
      .update({
        status: "sent_to_author",
        edits_sent_at: new Date().toISOString(),
        edits_sent_body: data.body,
      } as never)
      .eq("id", data.assignmentId);

    await audit(
      submissionId,
      data.sentBy || "staff",
      "Edits emailed to author",
      `To ${s.submitter_email}`,
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
  assignmentId: string;
  title: string;
  abstract: string;
  keywords: string;
  researchDomain: string;
  reviewerName: string;
  status: string;
  dueAt: string;
  comments: string;
  manuscriptFilename: string;
  manuscriptUrl: string | null;
};

async function loadInviteByToken(token: string, reviewerToken: string): Promise<InviteView> {
  const reviewer = await requireApprovedReviewer(reviewerToken);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: a } = await supabaseAdmin
    .from("review_assignments")
    .select("id, submission_id, reviewer_email, reviewer_name, status, due_at, review_comments")
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
  return {
    assignmentId: row.id,
    title: s.title ?? "",
    abstract: s.abstract ?? "",
    keywords: s.keywords ?? "",
    researchDomain: s.research_domain ?? "",
    reviewerName: row.reviewer_name,
    status: row.status,
    dueAt: row.due_at,
    comments: row.review_comments,
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

export const submitReview = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    ReviewerInviteSchema.extend({
      comments: z.string().trim().min(1, "Please enter your review.").max(20000),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const reviewer = await requireApprovedReviewer(data.reviewerToken);
    const { audit } = await import("./peer-review.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: a } = await supabaseAdmin
      .from("review_assignments")
      .select("id, submission_id, reviewer_email, reviewer_name, status")
      .eq("invite_token", data.token)
      .maybeSingle();
    if (!a) throw new Error("This review link is not valid.");
    const row = a as {
      id: string;
      submission_id: string;
      reviewer_email: string;
      reviewer_name: string;
      status: string;
    };
    requireAssignmentOwner(reviewer.email, row.reviewer_email);
    if (!["accepted", "review_received"].includes(row.status)) {
      throw new Error("Accept this review invitation before submitting your review.");
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("review_assignments")
      .update({
        status: "review_received",
        review_comments: data.comments,
        review_submitted_at: new Date().toISOString(),
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
      const { sendTemplateEmailToMany } = await import("./email-templates/send-email");
      await sendTemplateEmailToMany("review-received", EDITOR_RECIPIENTS, (to) => ({
        idempotencyKey: `review-received-${row.id}-${stamp}-${to}`,
        replyTo: row.reviewer_email,
        templateData: {
          reviewerName: row.reviewer_name || row.reviewer_email,
          reviewerEmail: row.reviewer_email,
          title: (sub as { title?: string } | null)?.title ?? "",
          submissionId: row.submission_id,
          comments: data.comments,
        },
      }));
      await audit(row.submission_id, row.reviewer_email, "Review submitted", "Emailed to editors");
    } catch (e) {
      console.error("[server] review-received email failed:", e);
      await audit(row.submission_id, row.reviewer_email, "Review submitted", "Editor email failed");
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
      .select("id, submission_id, invite_token, reviewer_name, status, due_at, review_comments")
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
    return Promise.all(
      list.map(async (x) => {
        const s = byId.get(x.submission_id);
        const canReadManuscript = ["accepted", "review_received", "sent_to_author"].includes(
          x.status,
        );
        return {
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
