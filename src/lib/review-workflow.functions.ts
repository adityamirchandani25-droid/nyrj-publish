import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
const Staff = z.object({ staffToken: z.string().min(1) });
const Paper = Staff.extend({ submissionId: z.string().uuid() });
export const listPeerReviewOverview = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Staff.parse(d))
  .handler(async ({ data }) => {
    const { verifyStaffToken } = await import("./staff-auth.server");
    verifyStaffToken(data.staffToken);
    const { reviewOverview } = await import("./review-workflow.server");
    return reviewOverview();
  });
export const reviewPaperHistory = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Paper.parse(d))
  .handler(async ({ data }) => {
    const { verifyStaffToken } = await import("./staff-auth.server");
    verifyStaffToken(data.staffToken);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { allRows } = await import("./review-workflow.server");
    const [versions, reminders, notifications, paper] = await Promise.all([
      allRows((a, b) =>
        db
          .from("review_feedback_versions")
          .select("*")
          .eq("submission_id", data.submissionId)
          .order("recorded_at", { ascending: false })
          .order("id")
          .range(a, b),
      ),
      allRows((a, b) =>
        db
          .from("revision_reminder_log")
          .select("*")
          .eq("submission_id", data.submissionId)
          .order("attempted_at", { ascending: false })
          .order("id")
          .range(a, b),
      ),
      allRows((a, b) => db.from("review_staff_notifications").select("*").order("id").range(a, b)),
      db
        .from("manuscript_submissions")
        .select("status,revision_reminders_paused,revision_requested_at")
        .eq("id", data.submissionId)
        .single(),
    ]);
    if (paper.error) throw new Error(paper.error.message);
    const ids = new Set(versions.map((v) => v.id));
    return {
      versions,
      reminders,
      notifications: notifications.filter((n) => ids.has(n.version_id)),
      paper: paper.data,
    };
  });
export const pauseRevisionReminders = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Paper.extend({ paused: z.boolean() }).parse(d))
  .handler(async ({ data }) => {
    const { verifyStaffToken } = await import("./staff-auth.server");
    verifyStaffToken(data.staffToken);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { data: paper, error } = await db
      .from("manuscript_submissions")
      .update({ revision_reminders_paused: data.paused })
      .eq("id", data.submissionId)
      .select("id")
      .maybeSingle();
    if (error || !paper) throw new Error("Could not change reminders for this paper.");
    const { audit } = await import("./peer-review.server");
    await audit(
      data.submissionId,
      "staff",
      data.paused ? "Resubmission reminders paused" : "Resubmission reminders resumed",
      "",
    );
    return { ok: true };
  });
export const openFeedbackVersion = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Staff.extend({ versionId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { verifyStaffToken } = await import("./staff-auth.server");
    verifyStaffToken(data.staffToken);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { data: v, error } = await db
      .from("review_feedback_versions")
      .select("file_path,file_name")
      .eq("id", data.versionId)
      .single();
    if (error || !v?.file_path) throw new Error("Feedback attachment not found.");
    const { data: signed, error: signError } = await db.storage
      .from("submissions")
      .createSignedUrl(v.file_path, 600, { download: v.file_name || "annotated-paper" });
    if (signError || !signed) throw new Error("Could not open feedback attachment.");
    return { url: signed.signedUrl };
  });
export const retryReviewNotifications = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Paper.parse(d))
  .handler(async ({ data }) => {
    const { verifyStaffToken } = await import("./staff-auth.server");
    verifyStaffToken(data.staffToken);
    const { dispatchReviewNotifications } = await import("./review-workflow.server");
    return { sent: await dispatchReviewNotifications(data.submissionId) };
  });
