import { useEffect, useState } from "react";
import { staffToken } from "@/lib/auth";
import { listReviewerMonitor, listPeerNotificationIssues } from "@/lib/reviewer-monitor.functions";
import { resendReviewerInvitation } from "@/lib/peer-review.functions";

type Rows = Awaited<ReturnType<typeof listReviewerMonitor>>;
type Issues = Awaited<ReturnType<typeof listPeerNotificationIssues>>;

export function ReviewerMonitor({ refreshKey }: { refreshKey: number }) {
  const [rows, setRows] = useState<Rows>([]);
  const [issues, setIssues] = useState<Issues>([]);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("overdue");
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
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
    return () => {
      active = false;
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
          ? "SendGrid accepted the reminder. Inbox delivery is not yet confirmed."
          : result.status === "uncertain"
            ? "Provider response is unknown. Reconcile this notification with SendGrid before retrying."
            : "Reminder queued for processing.",
      );
      setRows(await listReviewerMonitor({ data: { staffToken: staffToken() } }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Reminder failed.");
    } finally {
      setBusy(null);
    }
  }
  return (
    <section className="mt-8 border border-border bg-card p-5" aria-label="Reviewer monitoring">
      <h2 className="font-serif text-2xl text-primary">Reviewer monitoring</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Live assignments · status reflects overdue work, missed deadlines, and response time
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
              <li key={issue.id}>
                {issue.event} → {issue.recipient}: {issue.status} · {issue.attempts} attempts
                {issue.last_error ? ` · ${issue.last_error}` : ""}
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
                "Assigned",
                "Completed",
                "Pending",
                "Overdue",
                "Last response",
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
                          Due {p.dueAt ? new Date(p.dueAt).toLocaleDateString() : "—"}{" "}
                          {["invited", "accepted", "review_received", "sent_to_author"].includes(
                            p.status,
                          ) && (
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
                  {r.lastNotification
                    ? `${r.lastNotification.status} · ${new Date(r.lastNotification.at).toLocaleDateString()}`
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
