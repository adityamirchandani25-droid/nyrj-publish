import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { currentRoundFeedback, wasSharedWithAuthor } from "./reviewer-monitor";

function missingOutboxSchema(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.includes("peer_notification_outbox") &&
    error.message.includes("schema cache")
  );
}

export const listReviewerMonitor = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ staffToken: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const { verifyStaffToken } = await import("./staff-auth.server");
    verifyStaffToken(data.staffToken);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { allRows } = await import("./review-workflow.server");
    const [accounts, assignments, notifications, papers, feedback, versions] = await Promise.all([
      allRows((a, b) =>
        db
          .from("peer_reviewers")
          .select("name,email,status")
          .eq("status", "approved")
          .order("email")
          .range(a, b),
      ),
      allRows((a, b) =>
        db
          .from("review_assignments")
          .select(
            "id,submission_id,reviewer_name,reviewer_email,status,assigned_at,due_at,responded_at,review_submitted_at,edits_sent_at",
          )
          .order("id")
          .range(a, b),
      ),
      allRows((a, b) =>
        db
          .from("peer_notification_outbox")
          .select(
            "id,assignment_id,recipient,status,last_error,created_at,provider_accepted_at,delivered_at",
          )
          .order("id")
          .range(a, b),
      ).catch((error: unknown) => {
        // A newly applied Supabase migration can take a moment to enter the
        // PostgREST schema cache. Reviewer statistics should still load while
        // notification history catches up.
        if (missingOutboxSchema(error)) return [];
        throw error;
      }),
      allRows((a, b) =>
        db
          .from("manuscript_submissions")
          .select("id,title,current_version,status,decision,deleted_at")
          .order("id")
          .range(a, b),
      ),
      allRows((a, b) =>
        db
          .from("review_feedback_versions")
          .select("assignment_id,submission_id,submitted_at,comments,file_path")
          .order("id")
          .range(a, b),
      ),
      allRows((a, b) =>
        db
          .from("manuscript_versions")
          .select("submission_id,version,created_at")
          .order("id")
          .range(a, b),
      ),
    ]);
    const now = Date.now();
    const yellowDays = Number(process.env.REVIEWER_ATTENTION_DAYS ?? 7);
    const redOverdue = Number(process.env.REVIEWER_RED_OVERDUE_COUNT ?? 2);
    const paperById = new Map(papers.map((p) => [p.id, p]));
    const roundStart = new Map(
      versions
        .filter((v) => paperById.get(v.submission_id)?.current_version === v.version)
        .map((v) => [v.submission_id, v.created_at]),
    );
    const feedbackByAssignment = new Map<string, typeof feedback>();
    for (const version of feedback) {
      const records = feedbackByAssignment.get(version.assignment_id) ?? [];
      records.push(version);
      feedbackByAssignment.set(version.assignment_id, records);
    }
    const returnedAt = (a: (typeof assignments)[number]) => {
      const start = roundStart.get(a.submission_id) ?? a.assigned_at;
      return currentRoundFeedback(feedbackByAssignment.get(a.id) ?? [], start);
    };
    const isOpen = (a: (typeof assignments)[number]) => {
      const paper = paperById.get(a.submission_id);
      return Boolean(
        paper && !paper.deleted_at && paper.decision !== "declined" && paper.status !== "published",
      );
    };
    const byEmail = new Map<
      string,
      { name: string; email: string; assignments: typeof assignments }
    >();
    for (const account of accounts)
      byEmail.set(account.email.toLowerCase(), {
        name: account.name,
        email: account.email,
        assignments: [],
      });
    for (const assignment of assignments) {
      const key = assignment.reviewer_email.toLowerCase();
      const entry = byEmail.get(key) ?? {
        name: assignment.reviewer_name || assignment.reviewer_email,
        email: assignment.reviewer_email,
        assignments: [],
      };
      entry.assignments.push(assignment);
      byEmail.set(key, entry);
    }
    return [...byEmail.values()]
      .map((entry) => {
        const active = entry.assignments.filter((a) => a.status !== "declined" && isOpen(a));
        const completed = active.filter((a) => Boolean(returnedAt(a)));
        const shared = completed.filter((a) => wasSharedWithAuthor(returnedAt(a), a.edits_sent_at));
        const pending = active.filter((a) => !returnedAt(a) && a.status !== "no_response");
        const overdue = pending.filter((a) => a.due_at && Date.parse(a.due_at) < now);
        const missed = active.filter(
          (a) =>
            a.status === "no_response" || (returnedAt(a) && a.due_at && returnedAt(a)! > a.due_at),
        );
        const responseTimes = completed
          .map(
            (a) =>
              (Date.parse(returnedAt(a)!) -
                Date.parse(roundStart.get(a.submission_id) ?? a.assigned_at)) /
              86400000,
          )
          .filter(Number.isFinite);
        const averageResponseDays = responseTimes.length
          ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
          : null;
        const lastResponse =
          [...active]
            .map((a) => returnedAt(a))
            .filter((x): x is string => Boolean(x))
            .sort()
            .at(-1) ?? null;
        const ids = new Set(active.map((a) => a.id));
        const lastNotification =
          notifications
            .filter((n) => ids.has(n.assignment_id ?? ""))
            .sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;
        const status =
          missed.length >= redOverdue || overdue.length >= redOverdue
            ? "Unresponsive"
            : missed.length > 0 ||
                overdue.length > 0 ||
                (averageResponseDays !== null && averageResponseDays > yellowDays)
              ? "Needs Attention"
              : completed.length === 0
                ? "Not Enough Data"
                : "Responsive";
        return {
          name: entry.name,
          email: entry.email,
          assigned: active.length,
          completed: completed.length,
          shared: shared.length,
          pending: pending.length,
          overdue: overdue.length,
          lastResponse,
          status,
          averageResponseDays,
          completionRate: active.length ? completed.length / active.length : 0,
          lastNotification: lastNotification
            ? {
                id: lastNotification.id,
                at:
                  lastNotification.delivered_at ??
                  lastNotification.provider_accepted_at ??
                  lastNotification.created_at,
                status: lastNotification.status,
                error: lastNotification.last_error,
              }
            : null,
          papers: active.map((a) => ({
            assignmentId: a.id,
            title: paperById.get(a.submission_id)?.title ?? "Manuscript",
            version: paperById.get(a.submission_id)?.current_version ?? 1,
            status: a.status,
            dueAt: a.due_at,
            returnedAt: returnedAt(a),
            sharedAt: wasSharedWithAuthor(returnedAt(a), a.edits_sent_at) ? a.edits_sent_at : null,
          })),
        };
      })
      .sort((a, b) => b.overdue - a.overdue || a.name.localeCompare(b.name));
  });

export const listPeerNotificationIssues = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ staffToken: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const { verifyStaffToken } = await import("./staff-auth.server");
    verifyStaffToken(data.staffToken);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { allRows } = await import("./review-workflow.server");
    try {
      return await allRows((from, to) =>
        db
          .from("peer_notification_outbox")
          .select("id,event,recipient,status,attempts,last_error,created_at")
          .in("status", ["pending", "failed", "retrying", "processing"])
          .order("created_at", { ascending: false })
          .order("id")
          .range(from, to),
      );
    } catch (error) {
      if (missingOutboxSchema(error)) return [];
      throw error;
    }
  });

export const retryPeerNotification = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ staffToken: z.string().min(1), id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { verifyStaffToken } = await import("./staff-auth.server");
    verifyStaffToken(data.staffToken);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await db
      .from("peer_notification_outbox")
      .update({ next_attempt_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("status", "failed")
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("This notification is no longer failed. Refresh to see its status.");
    const { processPeerNotification } = await import("./peer-notifications.server");
    return processPeerNotification(data.id);
  });

/** Reopen only messages Brevo confirms it rejected for an invalid sender. */
export const reconcileBrevoRejections = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ staffToken: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const { verifyStaffToken } = await import("./staff-auth.server");
    verifyStaffToken(data.staffToken);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { allRows } = await import("./review-workflow.server");
    const { confirmedBrevoSenderRejections } = await import("./brevo-rejections");
    const { recentBrevoDeliveryEvents } = await import("./brevo-rejections.server");
    const accepted = await allRows((from, to) =>
      db
        .from("peer_notification_outbox")
        .select("id,recipient,provider_message_id")
        .eq("status", "provider_accepted")
        .not("provider_message_id", "is", null)
        .order("id")
        .range(from, to),
    );
    const candidates = accepted.filter((row) => row.provider_message_id?.startsWith("<"));
    if (!candidates.length) return { checked: 0, reopened: 0 };
    const events = await recentBrevoDeliveryEvents();
    const rejected = confirmedBrevoSenderRejections(candidates, events);
    if (!rejected.size) return { checked: candidates.length, reopened: 0 };

    const { data: reopened, error } = await db
      .from("peer_notification_outbox")
      .update({
        status: "failed",
        next_attempt_at: new Date().toISOString(),
        last_error:
          "Brevo rejected the sender after API acceptance. Retry after sender verification.",
        updated_at: new Date().toISOString(),
      } as never)
      .eq("status", "provider_accepted")
      .in("id", [...rejected.keys()])
      .select("id");
    if (error) throw new Error(`Could not reopen Brevo rejections: ${error.message}`);
    return { checked: candidates.length, reopened: reopened?.length ?? 0 };
  });

/** Staff-triggered, small batch retry of only confirmed Brevo sender rejections. */
export const retryConfirmedBrevoRejections = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ staffToken: z.string().min(1), limit: z.number().int().min(1).max(5) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { verifyStaffToken } = await import("./staff-auth.server");
    verifyStaffToken(data.staffToken);
    if (
      process.env.EMAIL_PROVIDER?.trim().toLowerCase() !== "brevo" ||
      !process.env.BREVO_API_KEY?.trim() ||
      !process.env.BREVO_FROM_EMAIL?.trim()
    ) {
      throw new Error("Brevo sending is not configured.");
    }
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await db
      .from("peer_notification_outbox")
      .select("id")
      .eq("status", "failed")
      .like("last_error", "Brevo rejected the sender after API acceptance.%")
      .order("created_at")
      .limit(data.limit);
    if (error) throw new Error(`Could not list Brevo rejections: ${error.message}`);
    const { processPeerNotification } = await import("./peer-notifications.server");
    const results = await Promise.allSettled(
      (rows ?? []).map((row) => processPeerNotification(row.id)),
    );
    return {
      attempted: results.length,
      accepted: results.filter(
        (result) => result.status === "fulfilled" && result.value.status === "provider_accepted",
      ).length,
      cancelled: results.filter(
        (result) => result.status === "fulfilled" && result.value.status === "cancelled",
      ).length,
      failed: results.filter(
        (result) =>
          result.status === "rejected" ||
          (result.status === "fulfilled" && result.value.status === "failed"),
      ).length,
      uncertain: results.filter(
        (result) => result.status === "fulfilled" && result.value.status === "uncertain",
      ).length,
      skipped: results.filter(
        (result) => result.status === "fulfilled" && result.value.status === "already_processed",
      ).length,
    };
  });
