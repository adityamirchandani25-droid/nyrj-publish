import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { SiteLayout } from "@/components/SiteLayout";
import { ChapterEditor } from "@/components/ChapterEditor";
import {
  ambassadorPassword,
  getSession,
  isAmbassador,
  logout,
  onAuthChange,
  type Session,
} from "@/lib/auth";
import { getEventAttendance, setEventAttendance } from "@/lib/ambassadors.functions";
import { getJournalStats } from "@/lib/metrics.functions";

export const Route = createFileRoute("/ambassador")({
  head: () => ({
    meta: [
      { title: "Ambassador Dashboard — NYRJ" },
      { name: "description", content: "NYRJ ambassador dashboard for chapter leads." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AmbassadorPage,
});

function AmbassadorPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    setSession(getSession());
    return onAuthChange(setSession);
  }, []);

  if (!isAmbassador(session)) {
    return (
      <SiteLayout>
        <section className="mx-auto max-w-2xl px-6 py-16">
          <p className="text-[10px] uppercase tracking-[0.35em] text-accent">Restricted</p>
          <h1 className="font-serif text-4xl text-primary mt-3">Ambassador access required</h1>
          <p className="mt-3 text-muted-foreground">
            Please sign in with your ambassador credentials to view this page.
          </p>
          <button
            onClick={() => navigate({ to: "/login", search: { account: "ambassador" as never } })}
            className="mt-6 px-5 py-2.5 bg-primary text-primary-foreground text-xs uppercase tracking-[0.2em] hover:bg-accent transition"
          >
            Go to Ambassador Login
          </button>
        </section>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
      <section className="mx-auto max-w-4xl px-6 py-12 space-y-12">
        <header className="flex justify-between items-start flex-wrap gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.35em] text-accent">Ambassador Dashboard</p>
            <h1 className="font-serif text-4xl text-primary mt-2">Welcome, {session?.username}</h1>
            <p className="mt-2 text-sm text-muted-foreground max-w-xl">
              Please take attendance regularly so we know the number of new students in your club.
              Your "new students this year" count feeds the sitewide Students Impacted metric
              automatically.
            </p>
          </div>
          <button
            onClick={async () => { await logout(); setSession(null); }}
            className="text-xs text-muted-foreground hover:text-accent underline underline-offset-4"
          >
            Log out
          </button>
        </header>

        <MetricsPanel />
        <EventAttendancePanel />

        <div>
          <h2 className="font-serif text-2xl text-primary">Officially Register Your Chapter</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Fill in your chapter's details, including the chapter lead's email, a short description,
            and a photo of the chapter lead. Editing an existing chapter? Click the pencil below.
          </p>
          <ChapterEditor getAuth={() => ({ password: ambassadorPassword() })} />
        </div>
      </section>
    </SiteLayout>
  );
}

function MetricsPanel() {
  const [stats, setStats] = useState<{
    articles: number;
    researchers: number;
    countries: number;
    studentsImpacted: number;
  } | null>(null);
  useEffect(() => {
    void getJournalStats().then(setStats);
  }, []);
  const tiles = [
    ["articles", "Articles published"],
    ["researchers", "Researchers featured"],
    ["countries", "Countries represented"],
    ["studentsImpacted", "Students impacted (live)"],
  ] as const;
  return (
    <div>
      <h2 className="font-serif text-2xl text-primary">Journal Metrics</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-4">
        {tiles.map(([k, label]) => (
          <div key={k} className="border border-border bg-card p-5">
            <p className="font-serif text-3xl text-primary">
              {stats ? stats[k].toLocaleString() : "—"}
            </p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-accent">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function EventAttendancePanel() {
  const [value, setValue] = useState<number>(0);
  const [draft, setDraft] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    void getEventAttendance().then((n) => { setValue(n); setDraft(String(n)); });
  }, []);

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      const n = Math.max(0, Math.floor(Number(draft) || 0));
      const res = await setEventAttendance({ data: { password: ambassadorPassword(), value: n } });
      setValue(res.value);
      setMsg("Saved.");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed to save.");
    } finally { setBusy(false); }
  }

  return (
    <div>
      <h2 className="font-serif text-2xl text-primary">Event Attendance</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Total students who have attended NYRJ events. This number appears on the public Journal
        Metrics page. Current value:{" "}
        <span className="text-accent font-semibold">{value.toLocaleString()}</span>
      </p>
      <form onSubmit={save} className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-[10px] uppercase tracking-[0.2em] text-accent mb-1">
            New total attendance
          </label>
          <input
            type="number"
            min={0}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="border border-border bg-background px-3 py-2 text-sm w-40"
          />
        </div>
        <button
          disabled={busy}
          className="px-5 py-2.5 bg-primary text-primary-foreground text-xs uppercase tracking-[0.2em] hover:bg-accent transition disabled:opacity-50"
        >
          {busy ? "Saving…" : "Update"}
        </button>
        {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
      </form>
    </div>
  );
}
