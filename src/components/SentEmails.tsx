import { useEffect, useState } from "react";
import { staffToken } from "@/lib/auth";
import {
  listSentEmails,
  retryFailedEmails,
  retrySentEmail,
  type SentEmailRow,
} from "@/lib/sent-emails.functions";

const heading = "text-[10px] uppercase tracking-[0.18em] text-accent";
const btnGhost =
  "px-3 py-1.5 border border-border text-[11px] uppercase tracking-[0.18em] hover:bg-muted disabled:opacity-50";

export function SentEmails() {
  const [rows, setRows] = useState<SentEmailRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "sent" | "failed" | "retrying">("all");
  const [hasMore, setHasMore] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [view, setView] = useState<"preview" | "text">("preview");
  const [retrying, setRetrying] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function load(term = search, offset = 0, selectedStatus = status) {
    setError(null);
    try {
      const page = await listSentEmails({
        data: {
          staffToken: staffToken(),
          search: term || undefined,
          status: selectedStatus === "all" ? undefined : selectedStatus,
          limit: 100,
          offset,
        },
      });
      setRows((current) => (offset === 0 ? page : [...(current ?? []), ...page]));
      setHasMore(page.length === 100);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load sent emails.");
    }
  }

  useEffect(() => {
    void load("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function retryOne(id: string) {
    setRetrying(id);
    setError(null);
    setNotice(null);
    try {
      const result = await retrySentEmail({ data: { staffToken: staffToken(), id } });
      setNotice(
        result.sent === 1
          ? "Email provider accepted the request; inbox delivery is unconfirmed."
          : "Nothing needed to be retried.",
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not retry the email.");
    } finally {
      setRetrying(null);
    }
  }

  async function retryAll() {
    setRetrying("all");
    setError(null);
    setNotice(null);
    try {
      const result = await retryFailedEmails({
        data: { staffToken: staffToken(), limit: 50 },
      });
      setNotice(
        result.attempted === 0
          ? "There are no failed emails to retry."
          : `Retried ${result.attempted}: ${result.sent} accepted by provider, ${result.failed} still failed. Inbox delivery is unconfirmed.`,
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not retry failed emails.");
    } finally {
      setRetrying(null);
    }
  }

  const open = (rows ?? []).find((r) => r.id === openId) ?? null;
  const hasRetryableArchiveEmail = (rows ?? []).some((row) => row.canRetry);

  return (
    <div className="mt-8 space-y-6">
      <p className="text-sm text-muted-foreground">
        “Accepted by provider” means the provider accepted the request. Inbox delivery and bounces
        cannot be confirmed from this archive until provider event access is connected.
      </p>
      <p className="text-sm text-muted-foreground">
        Reviewer notification failures are retried from Reviewer monitoring. The archive retry
        button only applies to other failed emails.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void load();
          }}
          placeholder="Search recipient, subject or type"
          className="flex-1 min-w-[220px] border border-border bg-background px-3 py-2 text-sm"
        />
        <button className={btnGhost} onClick={() => void load()}>
          Search
        </button>
        <select
          className="border border-border bg-background px-3 py-2 text-sm"
          aria-label="Filter email status"
          value={status}
          onChange={(event) => {
            const next = event.target.value as typeof status;
            setStatus(next);
            void load(search, 0, next);
          }}
        >
          <option value="all">All statuses</option>
          <option value="sent">Accepted</option>
          <option value="failed">Failed</option>
          <option value="retrying">Retrying</option>
        </select>
        <button
          className={btnGhost}
          onClick={() => {
            setSearch("");
            void load("");
          }}
        >
          Refresh
        </button>
        {hasRetryableArchiveEmail && (
          <button className={btnGhost} disabled={retrying !== null} onClick={() => void retryAll()}>
            {retrying === "all" ? "Retrying…" : "Retry archived failures"}
          </button>
        )}
        <a className={btnGhost} href="#reviewer-monitoring">
          Go to reviewer notifications ↑
        </a>
      </div>

      {hasMore && (
        <button className={btnGhost} onClick={() => void load(search, rows?.length ?? 0)}>
          Load more emails
        </button>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
      {notice && <p className="text-sm text-accent">{notice}</p>}
      {rows === null && <p className="text-sm text-muted-foreground">Loading…</p>}
      {rows !== null && rows.length === 0 && (
        <p className="text-sm text-muted-foreground italic">No emails recorded yet.</p>
      )}

      <div className="divide-y divide-border border border-border">
        {(rows ?? []).map((r) => (
          <div key={r.id}>
            <button
              className="w-full text-left px-4 py-3 hover:bg-muted"
              onClick={() => {
                setOpenId(openId === r.id ? null : r.id);
                setView("preview");
              }}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-sm font-medium">{r.subject}</span>
                <span className="text-[11px] text-muted-foreground">
                  {new Date(r.created_at).toLocaleString()}
                </span>
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                To {r.to_email} · {r.template}
                {r.status === "sent" ? (
                  <span> · Accepted by provider</span>
                ) : (
                  <span className="text-destructive"> · {r.status}</span>
                )}
              </div>
            </button>

            {openId === r.id && (
              <div className="border-t border-border bg-muted/30 px-4 py-4 space-y-3">
                {r.error && <p className="text-sm text-destructive">{r.error}</p>}
                <div className="flex gap-2">
                  <button
                    className={btnGhost}
                    onClick={() => setView("preview")}
                    disabled={view === "preview"}
                  >
                    Preview
                  </button>
                  <button
                    className={btnGhost}
                    onClick={() => setView("text")}
                    disabled={view === "text"}
                  >
                    Plain text
                  </button>
                  {r.canRetry && (
                    <button
                      className={btnGhost}
                      disabled={retrying !== null}
                      onClick={() => void retryOne(r.id)}
                    >
                      {retrying === r.id ? "Retrying…" : "Retry email"}
                    </button>
                  )}
                </div>
                {view === "preview" ? (
                  <iframe
                    title={`Email ${r.id}`}
                    srcDoc={r.html ?? "<p>No content stored.</p>"}
                    sandbox=""
                    className="w-full h-[600px] bg-background border border-border"
                  />
                ) : (
                  <pre className="whitespace-pre-wrap text-sm bg-background border border-border p-3">
                    {r.text_body ?? "No plain text stored."}
                  </pre>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {open && (
        <p className={heading}>Showing the rendered email copy and recorded provider result</p>
      )}
    </div>
  );
}
