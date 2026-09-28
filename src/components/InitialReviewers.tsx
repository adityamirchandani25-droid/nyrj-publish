import { useEffect, useState, type FormEvent } from "react";
import { staffToken } from "@/lib/auth";
import {
  addInitialReviewer,
  assignPendingSubmissions,
  listInitialReviewers,
  removeInitialReviewer,
  setInitialReviewerActive,
  type InitialReviewerRow,
} from "@/lib/initial-reviewers.functions";

const heading = "text-[10px] uppercase tracking-[0.18em] text-accent";
const btn =
  "px-3 py-1.5 bg-primary text-primary-foreground text-[11px] uppercase tracking-[0.18em] hover:bg-accent disabled:opacity-50";
const btnGhost =
  "px-3 py-1.5 border border-border text-[11px] uppercase tracking-[0.18em] hover:bg-muted disabled:opacity-50";
const field = "mt-1 w-full border border-border bg-background px-3 py-2 text-sm";

export function InitialReviewers() {
  const [rows, setRows] = useState<InitialReviewerRow[] | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setRows(await listInitialReviewers({ data: { staffToken: staffToken() } }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load reviewers.");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function add(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      await addInitialReviewer({
        data: { staffToken: staffToken(), name: name.trim(), email: email.trim() },
      });
      setName("");
      setEmail("");
      setNote("Reviewer added to the rotation.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add that reviewer.");
    } finally {
      setBusy(false);
    }
  }

  async function assignAll() {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const r = await assignPendingSubmissions({ data: { staffToken: staffToken() } });
      setNote(
        r.assigned === 0
          ? "Every open paper already has a reviewer."
          : `Assigned ${r.assigned} paper${r.assigned === 1 ? "" : "s"} and emailed the reviewers.`,
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not assign the pending papers.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-12 border border-border p-5">
      <p className="font-serif text-2xl text-primary">Initial reviewers</p>
      <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
        New papers are handed out evenly to the people below, who are emailed straight away. They
        log in as usual and update the status — the shared spreadsheet follows automatically.
      </p>

      <form onSubmit={add} className="mt-5 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div>
          <p className={heading}>Name</p>
          <input
            className={field}
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jay"
          />
        </div>
        <div>
          <p className={heading}>Email</p>
          <input
            className={field}
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@gmail.com"
          />
        </div>
        <button className={`${btn} h-9`} disabled={busy}>
          Add reviewer
        </button>
      </form>

      {note && <p className="mt-3 text-xs text-accent">{note}</p>}
      {error && <p className="mt-3 text-xs text-destructive">{error}</p>}

      <div className="mt-5 space-y-2">
        {rows === null && <p className="text-xs text-muted-foreground">Loading…</p>}
        {rows?.length === 0 && (
          <p className="text-xs text-muted-foreground italic">No reviewers in the rotation yet.</p>
        )}
        {(rows ?? []).map((r) => (
          <div
            key={r.id}
            className="flex flex-wrap items-center justify-between gap-2 border border-border px-3 py-2"
          >
            <div>
              <p className="text-sm text-primary">
                {r.name} <span className="text-muted-foreground">({r.email})</span>
              </p>
              <p className="text-[11px] text-muted-foreground">
                {r.assigned_count} paper{r.assigned_count === 1 ? "" : "s"} ·{" "}
                {r.active ? "Receiving papers" : "Paused"} ·{" "}
                {r.portal_enabled ? "Portal account ready" : "Account not created"}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                className={btnGhost}
                disabled={busy}
                onClick={async () => {
                  await setInitialReviewerActive({
                    data: { staffToken: staffToken(), id: r.id, active: !r.active },
                  });
                  await load();
                }}
              >
                {r.active ? "Pause" : "Resume"}
              </button>
              <button
                className={btnGhost}
                disabled={busy}
                onClick={async () => {
                  await removeInitialReviewer({ data: { staffToken: staffToken(), id: r.id } });
                  await load();
                }}
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      <button className={`${btn} mt-5`} disabled={busy} onClick={() => void assignAll()}>
        Assign all unassigned papers now
      </button>
    </div>
  );
}
