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
 * Gate the reviewer signup screen before it calls Supabase Auth. The code is
 * checked only on the server; actual portal access still requires both a valid
 * Supabase session and an active matching row in initial_reviewers.
 */
export const validateInitialReviewerSignup = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        email: z.string().trim().email().max(255),
        accessCode: z.string().min(4).max(128),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    if (!accessCodeMatches(data.accessCode)) {
      throw new Error("The access code or invited email is not valid.");
    }
    const email = data.email.toLowerCase();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: reviewer } = await supabaseAdmin
      .from("initial_reviewers")
      .select("name")
      .ilike("email", email)
      .eq("active", true)
      .maybeSingle();
    if (!reviewer) throw new Error("The access code or invited email is not valid.");
    return { ok: true as const, name: (reviewer as { name: string }).name };
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
      const { sendTemplateEmail } = await import("./email-templates/send-email");
      const dashboardUrl = `${process.env.PUBLIC_SITE_URL || "https://nyrj.org"}/admin/submissions`;
      for (const to of STAFF_RECIPIENTS) {
        await sendTemplateEmail("editor-recommendation", to, {
          idempotencyKey: `initial-review-${data.submissionId}-${reviewer.id}-${Date.now()}-${to}`,
          replyTo: reviewer.email,
          templateData: {
            editorName: reviewer.name,
            editorEmail: reviewer.email,
            title: row.title,
            action: data.action,
            comments: data.comments,
            dashboardUrl,
          },
        });
      }
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
