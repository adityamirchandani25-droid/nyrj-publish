import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { SiteLayout } from "@/components/SiteLayout";
import {
  editorDesk,
  editorLogin,
  registerEditor,
  submitRecommendation,
  type EditorDeskRow,
} from "@/lib/editors.functions";

export const Route = createFileRoute("/editor")({
  head: () => ({
    meta: [
      { title: "Editor Desk — NYRJ" },
      {
        name: "description",
        content: "Sign in to the National Youth Research Journal editor desk.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: EditorPage,
});

const STORE_KEY = "nyrj_editor_session";
const input = "w-full border border-border bg-background px-3 py-2 text-sm";
const label = "text-[10px] uppercase tracking-[0.25em] text-accent";
const btn =
  "px-5 py-2.5 bg-primary text-primary-foreground text-xs uppercase tracking-[0.2em] hover:bg-accent transition disabled:opacity-50";
const btnGhost =
  "px-4 py-2 border border-border text-[11px] uppercase tracking-[0.2em] hover:bg-muted disabled:opacity-50";

type Stored = { token: string; expiresAt: number; name: string; email: string };

function readStored(): Stored | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Stored;
    if (!s?.token || Date.now() > s.expiresAt) {
      window.localStorage.removeItem(STORE_KEY);
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

function EditorPage() {
  const [session, setSession] = useState<Stored | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setSession(readStored());
    setReady(true);
  }, []);

  function signIn(s: Stored) {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(s));
    setSession(s);
  }

  function signOut() {
    window.localStorage.removeItem(STORE_KEY);
    setSession(null);
  }

  return (
    <SiteLayout>
      <section className="mx-auto max-w-5xl px-6 py-16">
        <p className={label}>Editorial Stage</p>
        <h1 className="font-serif text-4xl text-primary mt-3">Editor Desk</h1>
        {!ready ? (
          <p className="mt-6 text-sm text-muted-foreground">Loading…</p>
        ) : session ? (
          <Desk session={session} onSignOut={signOut} />
        ) : (
          <AuthPanel onSignedIn={signIn} />
        )}
      </section>
    </SiteLayout>
  );
}

function AuthPanel({ onSignedIn }: { onSignedIn: (s: Stored) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === "login") {
        const r = await editorLogin({ data: { username, password } });
        onSignedIn(r);
      } else {
        await registerEditor({ data: { name, email, username, password } });
        setNotice(
          "Thank you — your request is with our editorial staff. You'll get an email the moment it's approved.",
        );
        setMode("login");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-8 max-w-md border border-border bg-card p-6 space-y-4">
      <p className={label}>{mode === "login" ? "Editor Login" : "Request an editor account"}</p>
      <form onSubmit={submit} className="space-y-4">
        {mode === "register" && (
          <>
            <Field label="Full name" value={name} onChange={setName} />
            <Field label="Email" type="email" value={email} onChange={setEmail} />
          </>
        )}
        <Field label="Username" value={username} onChange={setUsername} />
        <Field label="Password" type="password" value={password} onChange={setPassword} />
        {error && <p className="text-xs text-destructive">{error}</p>}
        {notice && <p className="text-xs text-primary">{notice}</p>}
        <div className="flex flex-wrap items-center gap-4">
          <button className={btn} disabled={busy}>
            {busy ? "Please wait…" : mode === "login" ? "Log In" : "Request Account"}
          </button>
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-accent underline underline-offset-4"
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError(null);
              setNotice(null);
            }}
          >
            {mode === "login" ? "Need an account?" : "← Back to login"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label: text,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <p className={label}>{text}</p>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${input} mt-1`}
      />
    </div>
  );
}

function Desk({ session, onSignOut }: { session: Stored; onSignOut: () => void }) {
  const [tab, setTab] = useState<"mine" | "all">("mine");
  const [data, setData] = useState<Awaited<ReturnType<typeof editorDesk>> | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      setData(await editorDesk({ data: { editorToken: session.token } }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your desk.");
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.token]);

  const rows: EditorDeskRow[] = data ? (tab === "mine" ? data.assigned : data.all) : [];

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-muted-foreground">
          Signed in as <span className="text-primary">{session.name}</span>
        </p>
        <button className={btnGhost} onClick={() => void load()}>
          Refresh
        </button>
        <button className={btnGhost} onClick={onSignOut}>
          Log out
        </button>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          onClick={() => setTab("mine")}
          className={`px-4 py-2 text-[11px] uppercase tracking-[0.2em] border ${tab === "mine" ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
        >
          Papers assigned to me {data ? `(${data.assigned.length})` : ""}
        </button>
        <button
          onClick={() => setTab("all")}
          className={`px-4 py-2 text-[11px] uppercase tracking-[0.2em] border ${tab === "all" ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
        >
          Overall papers {data ? `(${data.all.length})` : ""}
        </button>
      </div>

      {tab === "all" && (
        <p className="mt-4 border-l-4 border-destructive bg-destructive/10 px-4 py-3 text-sm text-destructive font-semibold">
          Please be careful — this view shows every manuscript in the journal, including papers
          assigned to other editors. Only act on a paper here if you are certain it is yours to
          handle.
        </p>
      )}

      {error && <p className="mt-6 text-sm text-destructive">{error}</p>}
      {!data && !error && <p className="mt-6 text-sm text-muted-foreground">Loading…</p>}
      {data && rows.length === 0 && (
        <p className="mt-6 text-sm text-muted-foreground">
          {tab === "mine" ? "No papers are assigned to you right now." : "No papers yet."}
        </p>
      )}

      <div className="mt-6 space-y-4">
        {rows.map((r) => (
          <PaperCard
            key={r.id}
            row={r}
            token={session.token}
            mine={(data?.myRecommendations ?? []).filter((m) => m.submission_id === r.id)}
            onDone={() => void load()}
          />
        ))}
      </div>
    </div>
  );
}

function PaperCard({
  row,
  token,
  mine,
  onDone,
}: {
  row: EditorDeskRow;
  token: string;
  mine: Array<{ id: string; action: string; status: string; created_at: string }>;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState<"accept" | "decline" | "formatting">("formatting");
  const [comments, setComments] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function send() {
    setBusy(true);
    setError(null);
    try {
      await submitRecommendation({
        data: { editorToken: token, submissionId: row.id, action, comments },
      });
      setSent(true);
      setOpen(false);
      setComments("");
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send that.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border border-border bg-card p-5">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1 min-w-[240px]">
          <h3 className="font-serif text-xl text-primary leading-snug">{row.title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {row.status} · {row.decision} · v{row.current_version} ·{" "}
            {new Date(row.created_at).toLocaleDateString()}
          </p>
          {row.research_domain && (
            <p className="mt-1 text-xs text-muted-foreground">Domain: {row.research_domain}</p>
          )}
          {row.keywords && (
            <p className="text-xs text-muted-foreground">Keywords: {row.keywords}</p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            Initial reviewer: {row.initial_reviewer_name || "unassigned"}
          </p>
        </div>
        <button className={btnGhost} onClick={() => setOpen((v) => !v)}>
          {open ? "Close" : "Send recommendation"}
        </button>
      </div>

      {row.abstract && (
        <p className="mt-3 text-sm text-muted-foreground whitespace-pre-wrap">{row.abstract}</p>
      )}

      {mine.length > 0 && (
        <p className="mt-3 text-xs text-accent">
          Your last recommendation: {mine[0]?.action} — {mine[0]?.status}
        </p>
      )}
      {sent && (
        <p className="mt-3 text-xs text-primary">
          Sent to staff for approval. Nothing goes to the author until they approve it.
        </p>
      )}

      {open && (
        <div className="mt-4 border-t border-border pt-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {(["accept", "decline", "formatting"] as const).map((a) => (
              <button
                key={a}
                onClick={() => setAction(a)}
                className={`px-3 py-1.5 text-[11px] uppercase tracking-[0.2em] border ${action === a ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
              >
                {a === "formatting" ? "Formatting changes" : a}
              </button>
            ))}
          </div>
          <textarea
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            rows={7}
            placeholder={
              action === "formatting"
                ? "Write the changes you'd like the author to make…"
                : "Any notes for our staff (optional)…"
            }
            className={input}
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <button className={btn} disabled={busy} onClick={() => void send()}>
            {busy ? "Sending…" : "Send to staff"}
          </button>
        </div>
      )}
    </div>
  );
}
