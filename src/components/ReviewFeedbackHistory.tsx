import { useCallback, useEffect, useState } from "react";
import { staffToken } from "@/lib/auth";
import {
  reviewPaperHistory,
  pauseRevisionReminders,
  openFeedbackVersion,
  retryReviewNotifications,
} from "@/lib/review-workflow.functions";
type History = Awaited<ReturnType<typeof reviewPaperHistory>>;
export function ReviewFeedbackHistory({
  submissionId,
  refreshKey,
}: {
  submissionId: string;
  refreshKey: number;
}) {
  const [history, setHistory] = useState<History | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const load = useCallback(async () => {
    try {
      setHistory(await reviewPaperHistory({ data: { staffToken: staffToken(), submissionId } }));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load review history.");
    }
  }, [submissionId]);
  useEffect(() => {
    void load();
  }, [load, refreshKey]);
  async function act(action: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await action();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="mt-5 space-y-4 border-t border-border pt-4">
      <h3 className="font-serif text-xl">Feedback version history</h3>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {history?.versions.map((v) => (
        <details key={v.id} className="border border-border p-3">
          <summary className="cursor-pointer text-sm">
            {new Date(v.submitted_at).toLocaleString()} · Assignment {v.assignment_id.slice(0, 8)}
            {v.file_name ? ` · ${v.file_name}` : ""}
          </summary>
          <p className="mt-2 whitespace-pre-wrap text-sm">
            {v.comments || "Annotated paper only."}
          </p>
          {v.file_path && (
            <button
              className="mt-2 text-sm underline"
              onClick={() =>
                void act(async () => {
                  const { url } = await openFeedbackVersion({
                    data: { staffToken: staffToken(), versionId: v.id },
                  });
                  window.open(url, "_blank", "noopener,noreferrer");
                })
              }
            >
              Open this round’s annotated paper
            </button>
          )}
        </details>
      ))}
      {history && !history.versions.length && (
        <p className="text-sm text-muted-foreground">No feedback recorded yet.</p>
      )}
      <h3 className="font-serif text-xl">Resubmission reminders</h3>
      <p className="text-sm">
        Every 3 days, up to 5 per revision round. Reminders stop when the paper leaves “waiting for
        edits”.
      </p>
      {history && (
        <button
          className="border border-border px-3 py-2 text-sm"
          disabled={busy}
          onClick={() =>
            void act(() =>
              pauseRevisionReminders({
                data: {
                  staffToken: staffToken(),
                  submissionId,
                  paused: !history.paper.revision_reminders_paused,
                },
              }),
            )
          }
        >
          {history.paper.revision_reminders_paused ? "Resume reminders" : "Pause reminders"}
        </button>
      )}
      {history?.reminders.map((r) => (
        <p key={r.id} className="text-xs">
          #{r.reminder_number} · {new Date(r.sent_at || r.attempted_at).toLocaleString()} ·{" "}
          {r.recipient} · {r.status}
          {r.error ? ` — ${r.error}` : ""}
        </p>
      ))}
      {history && !history.reminders.length && (
        <p className="text-sm text-muted-foreground">No reminder attempts yet.</p>
      )}
      <h3 className="font-serif text-xl">Admin feedback notifications</h3>
      {history?.notifications.map((n) => (
        <p key={n.id} className="text-xs">
          {n.recipient} · {n.status}
          {n.sent_at ? ` · ${new Date(n.sent_at).toLocaleString()}` : ""}
          {n.error ? ` — ${n.error}` : ""}
        </p>
      ))}
      <button
        className="border border-border px-3 py-2 text-sm"
        disabled={busy}
        onClick={() =>
          void act(async () => {
            const r = await retryReviewNotifications({
              data: { staffToken: staffToken(), submissionId },
            });
            setNote(`${r.sent} notification(s) sent.`);
          })
        }
      >
        Retry pending / failed notifications
      </button>
      {note && <p className="text-sm">{note}</p>}
    </section>
  );
}
