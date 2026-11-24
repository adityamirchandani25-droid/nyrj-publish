import { useEffect, useState } from "react";
import { staffToken } from "@/lib/auth";
import {
  listReviewerMonitor,
  listPeerNotificationIssues,
  retryPeerNotification,
} from "@/lib/reviewer-monitor.functions";
import { resendReviewerInvitation } from "@/lib/peer-review.functions";

type Rows = Awaited<ReturnType<typeof listReviewerMonitor>>;
type Issues = Awaited<ReturnType<typeof listPeerNotificationIssues>>;

const notificationStatus: Record<string, { label: string; className: string }> = {
  delivered: { label: "Delivered", className: "text-green-700" },
  provider_accepted: { label: "Accepted by provider", className: "text-amber-700" },
  pending: { label: "Queued", className: "text-amber-700" },
  processing: { label: "Sending", className: "text-amber-700" },
  retrying: { label: "Retrying", className: "text-amber-700" },
  failed: { label: "Failed", className: "text-red-700" },
  cancelled: { label: "Cancelled", className: "text-muted-foreground" },
};

export function ReviewerMonitor({ refreshKey }: { refreshKey: number }) {
  const [rows, setRows] = useState<Rows>([]);
  const [issues, setIssues] = useState<Issues>([]);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("overdue");
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [retryFeedback, setRetryFeedback] = useState<{ id: string; text: string } | null>(null);
  useEffect(() => {
    let active = true;
    const refresh = () => {
      listReviewerMonitor({ data: { staffToken: staffToken() } })
        .then((data) => {
          if (active) setRows(data);
        })
        .catch((error: unknown) => {
          if (active)
            setMessage(
              error instanceof Error ? error.message : "Could not load reviewer monitoring.",
            );
        });
      listPeerNotificationIssues({ data: { staffToken: staffToken() } })
        .then((data) => {
          if (active) setIssues(data);
        })
        .catch((error: unknown) => {
          if (active)
            setMessage(
              error instanceof Error ? error.message : "Could not load notification failures.",
            );
        });
    };
    refresh();
    const whenVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", whenVisible);
    document.addEventListener("visibilitychange", whenVisible);
    const timer = window.setInterval(whenVisible, 30_000);
    return () => {
      active = false;
      window.removeEventListener("focus", whenVisible);
      document.removeEventListener("visibilitychange", whenVisible);
      window.clearInterval(timer);
    };
  }, [refreshKey]);
  const visible = rows
    .filter((r) => `${r.name} ${r.email}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) =>
      sort === "response"
        ? (b.averageResponseDays ?? -1) - (a.averageResponseDays ?? -1)
        : sort === "completion"
          ? a.completionRate - b.completionRate
          : b.overdue - a.overdue || a.name.localeCompare(b.name),
    );
  async function resend(assignmentId: string) {
    setBusy(assignmentId);
    setMessage("");
    try {
      const result = await resendReviewerInvitation({
        data: { staffToken: staffToken(), assignmentId },
      });
      setMessage(
        result.status === "provider_accepted"
          ? "The email provider accepted the reminder. Inbox delivery is not yet confirmed."
          : result.status === "uncertain"
            ? "Provider response is unknown. Reconcile this notification with the email provider before retrying."
            : "Reminder queued for processing.",
      );
      setRows(await listReviewerMonitor({ data: { staffToken: staffToken() } }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Reminder failed.");
    } finally {
      setBusy(null);
    }
  }
  async function retryNotification(id: string) {
    setBusy(id);
    setMessage("");
    setRetryFeedback(null);
    try {
      const result = await retryPeerNotification({ data: { staffToken: staffToken(), id } });
      const feedback =
        result.status === "provider_accepted"
          ? "The email provider accepted the retry. Inbox delivery is not yet confirmed."
          : result.status === "cancelled"
            ? "The notification is no longer needed and was cancelled."
            : result.status === "uncertain"
              ? "Provider response is unknown. Check provider activity before another attempt."
              : result.status === "failed"
                ? `Retry failed: ${result.error}`
                : "The notification was already processed. Its status has been refreshed.";
      setMessage(feedback);
      setRetryFeedback({ id, text: feedback });
    } catch (error) {
      const feedback = error instanceof Error ? error.message : "Could not retry notification.";
      setMessage(feedback);
      setRetryFeedback({ id, text: feedback });
    } finally {
      const token = staffToken();
      const [nextRows, nextIssues] = await Promise.allSettled([
        listReviewerMonitor({ data: { staffToken: token } }),
        listPeerNotificationIssues({ data: { staffToken: token } }),
      ]);
      if (nextRows.status === "fulfilled") setRows(nextRows.value);
      if (nextIssues.status === "fulfilled") setIssues(nextIssues.value);
      setBusy(null);
    }
  }
  return (
    <section
      id="reviewer-monitoring"
      className="mt-8 border border-border bg-card p-5"
      aria-label="Reviewer monitoring"
    >
      <h2 className="font-serif text-2xl text-primary">Reviewer monitoring</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Current manuscript rounds · returned feedback and author notifications are tracked
        separately. Provider acceptance does not confirm inbox delivery; bounce data is unavailable
        until provider events are connected.
      </p>
      <div className="my-4 flex gap-3">
        <input
          className="border border-border bg-background p-2 text-sm"
          aria-label="Search reviewers"
          placeholder="Search name or email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="border border-border bg-background p-2 text-sm"
          aria-label="Sort reviewers"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="overdue">Most overdue</option>
          <option value="response">Slowest response</option>
          <option value="completion">Lowest completion rate</option>
        </select>
      </div>
      {message && (
        <p role="status" className="mb-3 text-sm text-primary">
          {message}
        </p>
      )}
      {issues.length > 0 && (
        <details className="mb-4 border border-amber-300 bg-amber-50 p-3 text-sm">
          <summary className="cursor-pointer font-medium">
            Notifications needing attention ({issues.length})
          </summary>
          <ul className="mt-2 space-y-1">
            {issues.map((issue) => (
              <li key={issue.id} className="flex flex-wrap items-baseline gap-x-2">
                <span>
                  {issue.event} → {issue.recipient}: {issue.status} · {issue.attempts} attempts
                  {issue.last_error ? ` · ${issue.last_error}` : ""}
                </span>
                {issue.status === "failed" && (
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void retryNotification(issue.id)}
                    className="text-primary underline underline-offset-2 disabled:opacity-50"
                  >
                    {busy === issue.id ? "Retrying…" : "Retry notification"}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border">
              {[
                "Reviewer",
                "Open assignments",
                "Feedback returned",
                "Sent to author",
                "Pending",
                "Overdue",
                "Last feedback",
                "Status",
                "Last notification",
              ].map((x) => (
                <th key={x} className="p-2">
                  {x}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.email} className="border-b border-border align-top">
                <td className="p-2">
                  <button
                    className="text-primary underline"
                    onClick={() => setOpen(open === r.email ? null : r.email)}
                  >
                    {r.name}
                  </button>
                  <div className="text-xs text-muted-foreground">{r.email}</div>
                  {open === r.email && (
                    <div className="mt-2 min-w-64 space-y-2">
                      {r.papers.map((p) => (
                        <div key={p.assignmentId} className="border-l-2 border-accent pl-2 text-xs">
                          {p.title} · v{p.version} · {p.status}
                          <br />
                          {p.returnedAt
                            ? `Feedback returned ${new Date(p.returnedAt).toLocaleDateString()}`
                            : "No feedback returned"}
                          {p.sharedAt
                            ? ` · Author notified ${new Date(p.sharedAt).toLocaleDateString()}`
                            : ""}
                          <br />
                          Due {p.dueAt ? new Date(p.dueAt).toLocaleDateString() : "—"}{" "}
                          {["invited", "accepted"].includes(p.status) && !p.returnedAt && (
                            <button
                              disabled={busy === p.assignmentId}
                              className="ml-2 text-primary underline disabled:opacity-50"
                              onClick={() => void resend(p.assignmentId)}
                            >
                              Resend reminder
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </td>
                <td className="p-2">{r.assigned}</td>
                <td className="p-2">{r.completed}</td>
                <td className="p-2">{r.shared}</td>
                <td className="p-2">{r.pending}</td>
                <td className="p-2">{r.overdue}</td>
                <td className="p-2">
                  {r.lastResponse ? new Date(r.lastResponse).toLocaleDateString() : "—"}
                </td>
                <td className="p-2">
                  <span
                    className={
                      r.status === "Unresponsive"
                        ? "text-red-700"
                        : r.status === "Needs Attention"
                          ? "text-amber-700"
                          : r.status === "Responsive"
                            ? "text-green-700"
                            : "text-muted-foreground"
                    }
                  >
                    ● {r.status}
                  </span>
                </td>
                <td className="p-2 text-xs">
                  {r.lastNotification ? (
                    <div>
                      <div className="flex flex-wrap items-center gap-x-2">
                        <span
                          className={
                            notificationStatus[r.lastNotification.status]?.className ??
                            "text-muted-foreground"
                          }
                        >
                          {notificationStatus[r.lastNotification.status]?.label ??
                            r.lastNotification.status}
                        </span>
                        {r.lastNotification.status === "failed" && (
                          <button
                            type="button"
                            disabled={busy !== null}
                            onClick={() => void retryNotification(r.lastNotification!.id)}
                            className="text-primary underline underline-offset-2 disabled:opacity-50"
                          >
                            {busy === r.lastNotification.id ? "Retrying…" : "Retry"}
                          </button>
                        )}
                      </div>
                      <div>{new Date(r.lastNotification.at).toLocaleDateString()}</div>
                      {r.lastNotification.status === "failed" && r.lastNotification.error && (
                        <p className="mt-1 max-w-56 break-words text-destructive">
                          {r.lastNotification.error}
                        </p>
                      )}
                      {retryFeedback?.id === r.lastNotification.id && (
                        <p role="status" className="mt-1 max-w-56 break-words text-foreground">
                          {retryFeedback.text}
                        </p>
                      )}
                    </div>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
