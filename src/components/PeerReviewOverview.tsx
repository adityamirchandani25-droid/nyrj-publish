import { useEffect, useState } from "react";
import { staffToken } from "@/lib/auth";
import { listPeerReviewOverview } from "@/lib/review-workflow.functions";
import { PeerReviewPanel } from "./PeerReviewPanel";
type Rows = Awaited<ReturnType<typeof listPeerReviewOverview>>;
export function PeerReviewOverview({ refreshKey }: { refreshKey: number }) {
  const [rows, setRows] = useState<Rows>([]);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("updated");
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    listPeerReviewOverview({ data: { staffToken: staffToken() } })
      .then((r) => {
        if (active) {
          setRows(r);
          setError("");
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [refreshKey]);
  const visible = rows
    .filter(
      (p) =>
        (filter === "all" ||
          (filter === "comments sent"
            ? p.assignments.some((a) => Boolean(a.edits_sent_at))
            : p.reviewStatus === filter)) &&
        `${p.title} ${p.submitter_email}`.toLowerCase().includes(search.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "title"
        ? a.title.localeCompare(b.title)
        : sort === "status"
          ? a.reviewStatus.localeCompare(b.reviewStatus)
          : b.updated_at.localeCompare(a.updated_at),
    );
  return (
    <section className="mt-8 border border-border bg-card p-5" aria-label="Peer Reviewers">
      <h2 className="font-serif text-2xl text-primary">Peer Reviewers</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        All {rows.length} papers, including historical, completed and trashed records. Pending
        feedback needs staff approval before it is sent to authors.
      </p>
      <div className="my-4 flex flex-wrap gap-3">
        <input
          className="border border-border bg-background p-2 text-sm"
          aria-label="Search peer review papers"
          placeholder="Search title or author email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="border border-border bg-background p-2 text-sm"
          aria-label="Filter peer review status"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          {["all", "pending", "comments sent", "awaiting resubmission", "completed"].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          className="border border-border bg-background p-2 text-sm"
          aria-label="Sort peer review papers"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="updated">Recently updated</option>
          <option value="title">Paper title</option>
          <option value="status">Review status</option>
        </select>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <p className="text-xs text-muted-foreground">Showing {visible.length} papers</p>
      <div className="mt-3 max-h-[650px] overflow-auto space-y-3">
        {visible.map((p) => (
          <article key={`${p.legacy ? "legacy:" : ""}${p.id}`} className="border border-border p-3">
            <div className="flex flex-wrap justify-between gap-2">
              <div>
                <h3 className="font-medium">{p.title}</h3>
                <p className="text-xs text-muted-foreground">
                  {p.submitter_email} · {p.status} · {p.decision}
                  {p.libraryOnly
                    ? " · Published library record"
                    : p.legacy
                      ? " · Legacy tracking record"
                      : ""}
                  {p.published && !p.libraryOnly ? " · Published in library" : ""}
                  {p.deleted_at ? " · In trash" : ""}
                  {p.current_version > 1 ? ` · New Revision v${p.current_version}` : ""}
                </p>
              </div>
              <span className="text-sm text-accent">{p.reviewStatus}</span>
            </div>
            {p.assignments.map((a) => (
              <p key={a.id} className="mt-1 text-xs">
                {a.reviewer_name || a.reviewer_email}:{" "}
                {a.status === "review_received" ? "Feedback submitted — ready to send" : a.status}
              </p>
            ))}
            {!p.assignments.length && (
              <p className="mt-1 text-xs text-muted-foreground">
                No peer reviewer assignments recorded.
              </p>
            )}
            {!p.legacy && (
              <button
                className="mt-2 text-sm underline"
                onClick={() => setOpen(open === p.id ? null : p.id)}
              >
                {open === p.id ? "Close" : "Review feedback, history and reminders"}
              </button>
            )}
            {open === p.id && !p.legacy && <PeerReviewPanel submissionId={p.id} />}
          </article>
        ))}
      </div>
    </section>
  );
}
