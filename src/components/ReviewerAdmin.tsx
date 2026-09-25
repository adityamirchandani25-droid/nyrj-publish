import { useEffect, useState } from "react";
import { getSession, staffToken } from "@/lib/auth";
import {
  listAuditLog,
  listReviewers,
  setReviewerStatus,
  type AuditRow,
  type ReviewerRow,
} from "@/lib/peer-review.functions";

const heading = "text-[10px] uppercase tracking-[0.18em] text-accent";
const btn =
  "px-3 py-1.5 bg-primary text-primary-foreground text-[11px] uppercase tracking-[0.18em] hover:bg-accent disabled:opacity-50";
const btnGhost =
  "px-3 py-1.5 border border-border text-[11px] uppercase tracking-[0.18em] hover:bg-muted disabled:opacity-50";

export function ReviewerAccounts() {
  const [rows, setRows] = useState<ReviewerRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    try {
      setRows(await listReviewers({ data: { staffToken: staffToken() } }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load reviewers.");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function decide(id: string, status: "approved" | "rejected") {
    setBusy(id);
    setError(null);
    try {
      await setReviewerStatus({
        data: { staffToken: staffToken(), id, status, actor: getSession()?.username ?? "staff" },
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update the reviewer.");
    } finally {
      setBusy(null);
    }
  }

  const pending = (rows ?? []).filter((r) => r.status === "pending");
  const others = (rows ?? []).filter((r) => r.status !== "pending");

  return (
    <div className="mt-8 space-y-8">
      {error && <p className="text-sm text-destructive">{error}</p>}
      {rows === null && <p className="text-sm text-muted-foreground">Loading…</p>}

      <div>
        <p className={heading}>Awaiting approval ({pending.length})</p>
        {pending.length === 0 && (
          <p className="mt-2 text-sm text-muted-foreground italic">No pending requests.</p>
        )}
        <div className="mt-3 space-y-3">
          {pending.map((r) => (
            <div key={r.id} className="border border-border bg-card p-4">
              <p className="text-primary">
                {r.name} <span className="text-muted-foreground text-sm">({r.email})</span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Username: {r.username}
                {r.expertise ? ` · Expertise: ${r.expertise}` : ""} · Requested{" "}
                {new Date(r.created_at).toLocaleDateString()}
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  className={btn}
                  disabled={busy === r.id}
                  onClick={() => void decide(r.id, "approved")}
                >
                  Approve
                </button>
                <button
                  className={btnGhost}
                  disabled={busy === r.id}
                  onClick={() => void decide(r.id, "rejected")}
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className={heading}>All reviewer accounts</p>
        {others.length === 0 && (
          <p className="mt-2 text-sm text-muted-foreground italic">None yet.</p>
        )}
        <div className="mt-3 space-y-2">
          {others.map((r) => (
            <div
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-2 border border-border bg-card px-4 py-3"
            >
              <p className="text-sm text-primary">
                {r.name} <span className="text-muted-foreground">({r.email})</span>
              </p>
              <div className="flex items-center gap-3">
                <span className="text-[10px] uppercase tracking-[0.18em] text-accent">
                  {r.status}
                </span>
                <button
                  className={btnGhost}
                  disabled={busy === r.id}
                  onClick={() => void decide(r.id, r.status === "approved" ? "rejected" : "approved")}
                >
                  {r.status === "approved" ? "Revoke" : "Approve"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function AuditLogView() {
  const [rows, setRows] = useState<AuditRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listAuditLog({ data: { staffToken: staffToken() } })
      .then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load the log."));
  }, []);

  return (
    <div className="mt-8">
      <p className="text-sm text-muted-foreground">
        A plain record of what happened and when — invitations, responses, reviews, and every email
        sent.
      </p>
      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
      {rows === null && !error && <p className="mt-4 text-sm text-muted-foreground">Loading…</p>}
      {rows?.length === 0 && (
        <p className="mt-4 text-sm text-muted-foreground italic">Nothing recorded yet.</p>
      )}
      <div className="mt-6 divide-y divide-border border border-border bg-card">
        {(rows ?? []).map((l) => (
          <div key={l.id} className="px-4 py-3">
            <p className="text-sm text-primary">
              {l.action}
              {l.detail ? <span className="text-muted-foreground"> — {l.detail}</span> : null}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {l.actor || "system"} · {new Date(l.created_at).toLocaleString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
