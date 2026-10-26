import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const listReviewerMonitor = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ staffToken: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const { verifyStaffToken } = await import("./staff-auth.server");
    verifyStaffToken(data.staffToken);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { allRows } = await import("./review-workflow.server");
    const [accounts, assignments, notifications, papers] = await Promise.all([
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
            "id,submission_id,reviewer_name,reviewer_email,status,assigned_at,due_at,responded_at,review_submitted_at",
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
      ),
      allRows((a, b) =>
        db
          .from("manuscript_submissions")
          .select("id,title,current_version,deleted_at")
          .order("id")
          .range(a, b),
      ),
    ]);
    const now = Date.now();
    const yellowDays = Number(process.env.REVIEWER_ATTENTION_DAYS ?? 7);
    const redOverdue = Number(process.env.REVIEWER_RED_OVERDUE_COUNT ?? 2);
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
        const active = entry.assignments.filter((a) => a.status !== "declined");
        const completed = active.filter((a) => Boolean(a.review_submitted_at));
        const pending = active.filter((a) => !a.review_submitted_at);
        const overdue = pending.filter((a) => a.due_at && Date.parse(a.due_at) < now);
        const missed = active.filter(
          (a) =>
            a.status === "no_response" ||
            (a.review_submitted_at && a.due_at && a.review_submitted_at > a.due_at),
        );
        const responseTimes = completed
          .map((a) => (Date.parse(a.review_submitted_at!) - Date.parse(a.assigned_at)) / 86400000)
          .filter(Number.isFinite);
        const averageResponseDays = responseTimes.length
          ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
          : null;
        const lastResponse =
          [...active]
            .map((a) => a.review_submitted_at ?? a.responded_at)
            .filter((x): x is string => Boolean(x))
            .sort()
            .at(-1) ?? null;
        const ids = new Set(entry.assignments.map((a) => a.id));
        const lastNotification =
          notifications
            .filter((n) => ids.has(n.assignment_id ?? ""))
            .sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;
        const status =
          active.length < 2 && overdue.length === 0
            ? "Not Enough Data"
            : overdue.length >= redOverdue || missed.length >= redOverdue
              ? "Unresponsive"
              : overdue.length > 0 ||
                  (averageResponseDays !== null && averageResponseDays > yellowDays)
                ? "Needs Attention"
                : "Responsive";
        return {
          name: entry.name,
          email: entry.email,
          assigned: active.length,
          completed: completed.length,
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
          papers: entry.assignments.map((a) => ({
            assignmentId: a.id,
            title: papers.find((p) => p.id === a.submission_id)?.title ?? "Manuscript",
            version: papers.find((p) => p.id === a.submission_id)?.current_version ?? 1,
            status: a.status,
            dueAt: a.due_at,
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
    const { data: rows, error } = await db
      .from("peer_notification_outbox")
      .select("id,event,recipient,status,attempts,last_error,created_at")
      .in("status", ["failed", "retrying", "processing"])
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
