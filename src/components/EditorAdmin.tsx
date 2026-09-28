import { useEffect, useState } from "react";
import { getSession, staffToken } from "@/lib/auth";
import {
  listEditorAccounts,
  listRecommendations,
  resolveRecommendation,
  setEditorStatus,
  type EditorAccountRow,
  type RecommendationRow,
} from "@/lib/editors.functions";

const heading = "text-[10px] uppercase tracking-[0.18em] text-accent";
const btn =
  "px-3 py-1.5 border border-primary text-primary text-[11px] uppercase tracking-[0.18em] hover:bg-primary hover:text-primary-foreground transition disabled:opacity-50";
const btnGhost =
  "px-3 py-1.5 border border-border text-[11px] uppercase tracking-[0.18em] hover:bg-muted disabled:opacity-50";

const ACTION_LABEL: Record<string, string> = {
  accept: "Recommends accepting",
  decline: "Recommends declining",
  formatting: "Formatting changes for the author",
};

export function EditorAdmin() {
  return (
    <div className="mt-8 space-y-12">
      <EditorRecommendations />
      <EditorAccounts />
    </div>
  );
}

function EditorAccounts() {
  const [rows, setRows] = useState<EditorAccountRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      setRows(await listEditorAccounts({ data: { staffToken: staffToken() } }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load editor accounts.");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function decide(id: string, status: "approved" | "rejected") {
    setBusy(id);
    setError(null);
    try {
      await setEditorStatus({
        data: { staffToken: staffToken(), id, status, actor: getSession()?.username ?? "staff" },
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update that account.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section>
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-2xl text-primary">Editor accounts</h3>
        <button className={btnGhost} onClick={() => void load()}>
          Refresh
        </button>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Editors sign up themselves; they can only sign in after you approve them here.
      </p>
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      {!rows && !error && <p className="mt-4 text-sm text-muted-foreground">Loading…</p>}
      {rows && rows.length === 0 && (
        <p className="mt-4 text-sm text-muted-foreground">No editors have signed up yet.</p>
      )}
      <div className="mt-4 space-y-3">
        {(rows ?? []).map((r) => (
          <div
            key={r.id}
            className="border border-border bg-card p-4 flex flex-wrap items-center gap-3"
          >
            <div className="flex-1 min-w-[220px]">
              <p className="font-serif text-lg text-primary">{r.name}</p>
              <p className="text-xs text-muted-foreground">
                {r.email} · username {r.username}
              </p>
            </div>
            <span className={heading}>{r.status}</span>
            {r.status !== "approved" && (
              <button
                className={btn}
                disabled={busy === r.id}
                onClick={() => void decide(r.id, "approved")}
              >
                Approve
              </button>
            )}
            {r.status !== "rejected" && (
              <button
                className={btnGhost}
                disabled={busy === r.id}
                onClick={() => void decide(r.id, "rejected")}
              >
                {r.status === "approved" ? "Revoke" : "Decline"}
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function EditorRecommendations() {
  const [rows, setRows] = useState<RecommendationRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setError(null);
    try {
      setRows(await listRecommendations({ data: { staffToken: staffToken() } }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load recommendations.");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function openRow(r: RecommendationRow) {
    setOpenId(r.id === openId ? null : r.id);
    setDraft(r.comments ?? "");
    setNotice(null);
  }

  async function resolve(id: string, approve: boolean) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await resolveRecommendation({
        data: {
          staffToken: staffToken(),
          id,
          approve,
          message: draft,
          reviewedBy: getSession()?.username ?? "staff",
        },
      });
      setNotice(
        approve
          ? res.emailed
            ? "Approved — the author has been emailed."
            : "Approved, but the email could not be sent. Check Emails sent."
          : "Recommendation declined. Nothing was sent to the author.",
      );
      setOpenId(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save that.");
    } finally {
      setBusy(false);
    }
  }

  const pending = (rows ?? []).filter((r) => r.status === "pending");
  const handled = (rows ?? []).filter((r) => r.status !== "pending");

  return (
    <section>
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-2xl text-primary">Initial review recommendations</h3>
        <button className={btnGhost} onClick={() => void load()}>
          Refresh
        </button>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Initial reviewer decisions and comments wait here. Nothing reaches the author until you
        approve it, and you can edit the wording first.
      </p>
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      {notice && <p className="mt-3 text-sm text-primary">{notice}</p>}
      {!rows && !error && <p className="mt-4 text-sm text-muted-foreground">Loading…</p>}
      {rows && pending.length === 0 && (
        <p className="mt-4 text-sm text-muted-foreground">Nothing waiting for approval.</p>
      )}

      <div className="mt-4 space-y-3">
        {pending.map((r) => (
          <div key={r.id} className="border border-accent/50 bg-card p-4">
            <div className="flex flex-wrap items-start gap-3">
              <div className="flex-1 min-w-[220px]">
                <p className={heading}>{ACTION_LABEL[r.action] ?? r.action}</p>
                <p className="font-serif text-lg text-primary mt-1">{r.submission_title}</p>
                <p className="text-xs text-muted-foreground">
                  {r.editor_name} ({r.editor_email}) · {new Date(r.created_at).toLocaleString()}
                </p>
              </div>
              <button className={btn} onClick={() => openRow(r)}>
                {openId === r.id ? "Close" : "Review & send"}
              </button>
            </div>
            {r.comments && (
              <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">{r.comments}</p>
            )}
            {openId === r.id && (
              <div className="mt-4 border-t border-border pt-4 space-y-3">
                <p className={heading}>Message to the author</p>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={8}
                  className="w-full border border-border bg-background px-3 py-2 text-sm"
                  placeholder="Edit the wording before it goes out…"
                />
                <div className="flex flex-wrap gap-3">
                  <button className={btn} disabled={busy} onClick={() => void resolve(r.id, true)}>
                    {busy ? "Sending…" : "Approve & send to author"}
                  </button>
                  <button
                    className={btnGhost}
                    disabled={busy}
                    onClick={() => void resolve(r.id, false)}
                  >
                    Decline recommendation
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {handled.length > 0 && (
        <div className="mt-8">
          <p className={heading}>Handled</p>
          <div className="mt-3 space-y-2">
            {handled.map((r) => (
              <div key={r.id} className="border border-border bg-card px-4 py-3 text-sm">
                <span className="text-primary">{r.submission_title}</span>{" "}
                <span className="text-muted-foreground">
                  — {ACTION_LABEL[r.action] ?? r.action} · {r.status} by {r.reviewed_by || "staff"}
                  {r.reviewed_at ? ` on ${new Date(r.reviewed_at).toLocaleDateString()}` : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
