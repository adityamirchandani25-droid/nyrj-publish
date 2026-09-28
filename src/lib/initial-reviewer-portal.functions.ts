import { createServerFn } from "@tanstack/react-start";
import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const STAFF_RECIPIENTS = ["keyaanmerchant24@gmail.com", "Madhavarora529@gmail.com"];

export type InitialReviewAssignment = {
  id: string;
  title: string;
  status: string;
  decision: string;
  created_at: string;
  keywords: string;
  research_domain: string;
  abstract: string | null;
  manuscript_filename: string | null;
  download_url: string | null;
  recommendation: {
    id: string;
    action: string;
    comments: string;
    status: string;
    created_at: string;
    staff_message: string;
  } | null;
};

type AuthContext = {
  userId: string;
  claims?: Record<string, unknown>;
};

function normalizedEmail(context: AuthContext): string {
  const value = context.claims?.email;
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("Your account does not have an email address.");
  }
  return value.trim().toLowerCase();
}

async function requireInitialReviewer(context: AuthContext) {
  const email = normalizedEmail(context);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("initial_reviewers")
    .select("id, name, email, active, auth_user_id")
    .ilike("email", email)
    .maybeSingle();

  if (error) throw new Error("We could not verify your reviewer access. Please try again.");
  const reviewer = data as {
    id: string;
    name: string;
    email: string;
    active: boolean;
    auth_user_id: string | null;
  } | null;
  if (!reviewer?.active) {
    throw new Error("This email is not active in the initial reviewer rotation.");
  }
  if (reviewer.auth_user_id && reviewer.auth_user_id !== context.userId) {
    throw new Error("This reviewer email is already linked to another account.");
  }

  // Bind the invited email to its Supabase Auth UUID on first authenticated use.
  if (!reviewer.auth_user_id) {
    const { error: bindError } = await supabaseAdmin
      .from("initial_reviewers")
      .update({ auth_user_id: context.userId } as never)
      .eq("id", reviewer.id)
      .is("auth_user_id", null);
    if (bindError) throw new Error("We could not link your reviewer account. Please try again.");
  }

  return { ...reviewer, email };
}

function accessCodeMatches(candidate: string): boolean {
  const expected = process.env.INITIAL_REVIEWER_ACCESS_CODE;
  if (!expected) throw new Error("Initial reviewer registration is not configured.");
  const left = createHash("sha256").update(candidate).digest();
  const right = createHash("sha256").update(expected).digest();
  return timingSafeEqual(left, right);
}

/**
 * Creates the reviewer auth account and sends its verification link through
 * the journal's managed email pipeline. generateLink deliberately does not
 * invoke Supabase's SMTP service, so setup mail gets the same retries, archive,
 * and staff retry controls as every other transactional message.
 */
export const createInitialReviewerAccount = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => {
    const parsed = z
      .object({
        email: z.string().trim().email("Enter a valid reviewer email.").max(255),
        password: z.string().min(8, "Use at least 8 characters.").max(200),
        accessCode: z.string().min(4, "Enter the 4-character access code.").max(128),
      })
      .safeParse(d);
    if (!parsed.success) {
      throw new Error(
        parsed.error.issues[0]?.message || "Check the account details and try again.",
      );
    }
    return parsed.data;
  })
  .handler(async ({ data }) => {
    if (!accessCodeMatches(data.accessCode)) {
      throw new Error("The access code or invited email is not valid.");
    }
    const email = data.email.toLowerCase();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: reviewerData, error: reviewerError } = await supabaseAdmin
      .from("initial_reviewers")
      .select("id, name, email, auth_user_id")
      .ilike("email", email)
      .eq("active", true)
      .maybeSingle();
    if (reviewerError) {
      console.error("[initial-reviewer] account lookup failed:", reviewerError);
      throw new Error("We could not start account setup. Please try again.");
    }
    const reviewer = reviewerData as {
      id: string;
      name: string;
      email: string;
      auth_user_id: string | null;
    } | null;
    if (!reviewer) throw new Error("The access code or invited email is not valid.");

    const siteUrl = (process.env.PUBLIC_SITE_URL || "https://nyrj.org").replace(/\/+$/, "");
    const redirectTo = `${siteUrl}/initial-reviewer`;
    const setupFailed = "We could not start account setup. Please try again or contact NYRJ staff.";
    const { admin } = supabaseAdmin.auth;

    // New reviewers get a signup link. Linked reviewers, and reviewers left
    // over from the old client-side signup (in Auth but never linked to their
    // rotation row), get a magic link instead of being stranded.
    let passwordSet = false;
    let link = reviewer.auth_user_id
      ? null
      : await admin.generateLink({
          type: "signup",
          email,
          password: data.password,
          options: {
            redirectTo,
            data: { full_name: reviewer.name, requested_role: "initial_reviewer" },
          },
        });
    if (link?.data.user && link.data.properties?.action_link) {
      passwordSet = true;
    } else {
      link = await admin.generateLink({ type: "magiclink", email, options: { redirectTo } });
    }

    const user = link.data.user;
    let actionLink = link.data.properties?.action_link;
    if (link.error || !user || !actionLink) {
      console.error("[initial-reviewer] account link generation failed:", link.error);
      throw new Error(setupFailed);
    }
    if (reviewer.auth_user_id && reviewer.auth_user_id !== user.id) {
      throw new Error("This reviewer email is already linked to another account.");
    }

    const existingAccount = Boolean(user.email_confirmed_at);
    // Replacing the password before ownership is confirmed is safe: the
    // account cannot sign in until the emailed link is opened.
    if (!existingAccount && !passwordSet) {
      const { error: passwordError } = await admin.updateUserById(user.id, {
        password: data.password,
      });
      if (passwordError) {
        console.error("[initial-reviewer] password update failed:", passwordError);
        throw new Error(setupFailed);
      }
    }

    // A confirmed account may already be used elsewhere on NYRJ. Never replace
    // its password based only on the shared reviewer code. Email a recovery
    // link so ownership is proven before the reviewer chooses a new password.
    if (existingAccount) {
      const recovery = await admin.generateLink({
        type: "recovery",
        email,
        options: { redirectTo: `${siteUrl}/reset-password?next=initial-reviewer` },
      });
      const recoveryUser = recovery.data.user;
      const recoveryLink = recovery.data.properties?.action_link;
      if (recovery.error || !recoveryUser || !recoveryLink || recoveryUser.id !== user.id) {
        console.error("[initial-reviewer] password setup link failed:", recovery.error);
        throw new Error(setupFailed);
      }
      actionLink = recoveryLink;
    }

    if (!reviewer.auth_user_id) {
      const { data: bound, error: bindError } = await supabaseAdmin
        .from("initial_reviewers")
        .update({ auth_user_id: user.id } as never)
        .eq("id", reviewer.id)
        .is("auth_user_id", null)
        .select("auth_user_id")
        .maybeSingle();
      if (bindError) {
        console.error("[initial-reviewer] account link failed:", bindError);
        throw new Error(setupFailed);
      }
      // Lost a race with a concurrent setup: accept only if it bound this user.
      if (!bound) {
        const { data: current } = await supabaseAdmin
          .from("initial_reviewers")
          .select("auth_user_id")
          .eq("id", reviewer.id)
          .maybeSingle();
        if ((current as { auth_user_id?: string } | null)?.auth_user_id !== user.id) {
          throw new Error("This reviewer email is already linked to another account.");
        }
      }
    }

    try {
      const { sendTemplateEmail } = await import("./email-templates/send-email");
      await sendTemplateEmail("initial-reviewer-account", email, {
        idempotencyKey: `initial-reviewer-account-${reviewer.id}-${Date.now()}`,
        replyTo: "NYRJINFO@gmail.com",
        templateData: {
          reviewerName: reviewer.name,
          actionUrl: actionLink,
          existingAccount,
        },
      });
    } catch (emailError) {
      console.error("[initial-reviewer] account email failed:", emailError);
      throw new Error(
        "Your account was prepared, but we could not send the setup email. Please try again; staff can also retry it from the email archive.",
      );
    }

    return {
      ok: true as const,
      delivery: existingAccount ? ("password_setup" as const) : ("confirmation" as const),
    };
  });

export const getInitialReviewerDesk = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(
    async ({
      context,
    }): Promise<{
      reviewer: { name: string; email: string };
      workflowUrl: string;
      assignments: InitialReviewAssignment[];
    }> => {
      const reviewer = await requireInitialReviewer(context as AuthContext);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: rows, error } = await supabaseAdmin
        .from("manuscript_submissions")
        .select(
          "id, title, status, decision, created_at, keywords, research_domain, abstract, manuscript_path, manuscript_filename",
        )
        .ilike("initial_reviewer_email", reviewer.email)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw new Error("Could not load your assigned manuscripts.");

      const submissions = (rows ?? []) as Array<{
        id: string;
        title: string;
        status: string;
        decision: string;
        created_at: string;
        keywords: string;
        research_domain: string;
        abstract: string | null;
        manuscript_path: string | null;
        manuscript_filename: string | null;
      }>;
      const ids = submissions.map((row) => row.id);
      const latest = new Map<string, InitialReviewAssignment["recommendation"]>();
      if (ids.length) {
        const { data: recommendations } = await supabaseAdmin
          .from("editor_recommendations")
          .select("id, submission_id, action, comments, status, created_at, staff_message")
          .in("submission_id", ids)
          .ilike("editor_email", reviewer.email)
          .order("created_at", { ascending: false });
        for (const item of (recommendations ?? []) as Array<{
          id: string;
          submission_id: string;
          action: string;
          comments: string;
          status: string;
          created_at: string;
          staff_message: string;
        }>) {
          if (!latest.has(item.submission_id)) {
            latest.set(item.submission_id, {
              id: item.id,
              action: item.action,
              comments: item.comments,
              status: item.status,
              created_at: item.created_at,
              staff_message: item.staff_message,
            });
          }
        }
      }

      const assignments: InitialReviewAssignment[] = [];
      for (const row of submissions) {
        let downloadUrl: string | null = null;
        if (row.manuscript_path) {
          const { data: signed } = await supabaseAdmin.storage
            .from("submissions")
            .createSignedUrl(row.manuscript_path, 60 * 15, {
              download: row.manuscript_filename ?? "manuscript",
            });
          downloadUrl = signed?.signedUrl ?? null;
        }
        assignments.push({
          ...row,
          download_url: downloadUrl,
          recommendation: latest.get(row.id) ?? null,
        });
      }

      const { signedEditorialWorkflowUrl } = await import("./reviewer-resources.server");
      return {
        reviewer: { name: reviewer.name, email: reviewer.email },
        workflowUrl: await signedEditorialWorkflowUrl(),
        assignments,
      };
    },
  );

export const submitInitialReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        submissionId: z.string().uuid(),
        action: z.enum(["accept", "decline"]),
        comments: z.string().trim().min(1, "Please add comments for the author.").max(20000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const reviewer = await requireInitialReviewer(context as AuthContext);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: submission } = await supabaseAdmin
      .from("manuscript_submissions")
      .select("id, title, decision, initial_reviewer_email")
      .eq("id", data.submissionId)
      .is("deleted_at", null)
      .maybeSingle();
    const row = submission as {
      id: string;
      title: string;
      decision: string;
      initial_reviewer_email: string;
    } | null;
    if (!row) throw new Error("That manuscript is no longer available.");
    if ((row.initial_reviewer_email ?? "").trim().toLowerCase() !== reviewer.email) {
      throw new Error("This manuscript is not assigned to your account.");
    }
    if (row.decision !== "pending")
      throw new Error("This manuscript already has a final decision.");

    const { data: pending } = await supabaseAdmin
      .from("editor_recommendations")
      .select("id")
      .eq("submission_id", data.submissionId)
      .ilike("editor_email", reviewer.email)
      .eq("status", "pending")
      .maybeSingle();
    if (pending) throw new Error("Your latest review is already waiting for staff approval.");

    const { error } = await supabaseAdmin.from("editor_recommendations").insert({
      submission_id: data.submissionId,
      editor_name: reviewer.name,
      editor_email: reviewer.email,
      action: data.action,
      comments: data.comments,
      status: "pending",
    } as never);
    if (error) throw new Error("Could not submit your review. Please try again.");

    try {
      const { sendTemplateEmailToMany } = await import("./email-templates/send-email");
      const dashboardUrl = `${process.env.PUBLIC_SITE_URL || "https://nyrj.org"}/admin/submissions`;
      const stamp = Date.now();
      await sendTemplateEmailToMany("editor-recommendation", STAFF_RECIPIENTS, (to) => ({
        idempotencyKey: `initial-review-${data.submissionId}-${reviewer.id}-${stamp}-${to}`,
        replyTo: reviewer.email,
        templateData: {
          editorName: reviewer.name,
          editorEmail: reviewer.email,
          title: row.title,
          action: data.action,
          comments: data.comments,
          dashboardUrl,
        },
      }));
    } catch (emailError) {
      console.error("[initial-reviewer] staff notification failed:", emailError);
    }

    try {
      const { audit } = await import("./peer-review.server");
      await audit(
        data.submissionId,
        reviewer.email,
        "Initial review submitted",
        `${data.action} — awaiting staff approval`,
      );
    } catch (auditError) {
      console.error("[initial-reviewer] audit failed:", auditError);
    }
    return { ok: true as const };
  });
