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
          .select("assignment_id,recipient,status,created_at,provider_accepted_at,delivered_at")
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
                at:
                  lastNotification.delivered_at ??
                  lastNotification.provider_accepted_at ??
                  lastNotification.created_at,
                status: lastNotification.status,
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
