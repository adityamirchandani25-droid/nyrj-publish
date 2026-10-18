import { useState } from "react";
import { getReviewerFeedbackHistory } from "@/lib/peer-review.functions";
export function ReviewerFeedbackHistory({
  token,
  reviewerToken,
}: {
  token: string;
  reviewerToken: string;
}) {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof getReviewerFeedbackHistory>>>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  return (
    <details
      className="mt-4 border border-border p-3"
      onToggle={(e) => {
        if (!e.currentTarget.open) return;
        setLoading(true);
        getReviewerFeedbackHistory({ data: { token, reviewerToken } })
          .then((r) => {
            setRows(r);
            setError("");
          })
          .catch((e) => setError(e.message))
          .finally(() => setLoading(false));
      }}
    >
      <summary className="cursor-pointer text-sm">Your feedback history</summary>
      {loading && <p className="text-sm">Loading…</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {!loading && !rows.length && !error && (
        <p className="mt-2 text-sm">No feedback submitted yet.</p>
      )}
      {rows.map((r) => (
        <div key={r.id} className="mt-3 border-t border-border pt-2">
          <p className="text-xs">{new Date(r.submittedAt).toLocaleString()}</p>
          <p className="mt-1 whitespace-pre-wrap text-sm">
            {r.comments || "Annotated paper only."}
          </p>
          {r.fileUrl && (
            <a className="mt-1 text-sm underline" href={r.fileUrl} target="_blank" rel="noreferrer">
              {r.fileName || "Open annotated paper"}
            </a>
          )}
        </div>
      ))}
    </details>
  );
}
