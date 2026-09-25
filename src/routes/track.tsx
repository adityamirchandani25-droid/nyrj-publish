import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteLayout } from "@/components/SiteLayout";
import { supabase } from "@/integrations/supabase/client";
import { bridgeSupabaseSession, getSession, onAuthChange, type Session } from "@/lib/auth";

export const Route = createFileRoute("/track")({
  head: () => ({
    meta: [
      { title: "Track Submissions — NYRJ" },
      {
        name: "description",
        content:
          "Track the status of manuscripts you've submitted to the National Youth Research Journal.",
      },
    ],
  }),
  component: TrackPage,
});

type StatusVal =
  | "initial review"
  | "editorial review"
  | "waiting for edits"
  | "secondary review"
  | "publishing"
  | "published";
type DecisionVal = "pending" | "accepted" | "declined";

type Submission = {
  id: string;
  manuscript_name: string;
  status: StatusVal;
  decision: DecisionVal;
  updated_at: string;
};

type ManuscriptRow = {
  id: string;
  title: string;
  status: string;
  created_at: string;
  research_type: string | null;
};

function TrackPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [subs, setSubs] = useState<Submission[]>([]);
  const [manuscripts, setManuscripts] = useState<ManuscriptRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    bridgeSupabaseSession();
    setSession(getSession());
    setReady(true);
    return onAuthChange(setSession);
  }, []);

  useEffect(() => {
    if (!session || session.role !== "researcher") return;
    let active = true;
    (async () => {
      const [{ data: s, error: e1 }, { data: m, error: e2 }] = await Promise.all([
        supabase
          .from("submissions")
          .select("id, manuscript_name, status, decision, updated_at")
          .order("updated_at", { ascending: false }),
        supabase
          .from("manuscript_submissions")
          .select("id, title, status, created_at, research_type")
          .order("created_at", { ascending: false }),
      ]);
      if (!active) return;
      if (e1) setError(e1.message);
      else setSubs((s ?? []) as Submission[]);
      if (!e2) setManuscripts((m ?? []) as ManuscriptRow[]);
    })();
    return () => {
      active = false;
    };
  }, [session]);

  if (!ready) {
    return (
      <SiteLayout>
        <section className="mx-auto max-w-3xl px-6 py-16">Loading…</section>
      </SiteLayout>
    );
  }

  if (!session || session.role !== "researcher") {
    return (
      <SiteLayout>
        <section className="mx-auto max-w-3xl px-6 py-16">
          <p className="text-[10px] uppercase tracking-[0.35em] text-accent">For Authors</p>
          <h1 className="font-serif text-4xl text-primary mt-3">Track Your Submissions</h1>
          <p className="mt-4 text-muted-foreground">
            Sign in with your student account to see the status of every manuscript you've submitted
            to NYRJ.
          </p>
          <button
            onClick={() => navigate({ to: "/login" })}
            className="mt-6 px-5 py-2.5 bg-primary text-primary-foreground text-xs uppercase tracking-[0.2em] hover:bg-accent transition"
          >
            Log in to view
          </button>
        </section>
      </SiteLayout>
    );
  }

  const total = subs.length + manuscripts.length;

  return (
    <SiteLayout>
      <section className="mx-auto max-w-4xl px-6 py-16">
        <p className="text-[10px] uppercase tracking-[0.35em] text-accent">For Authors</p>
        <h1 className="font-serif text-4xl text-primary mt-3">Track Your Submissions</h1>
        <p className="mt-3 text-muted-foreground">
          Live status for every manuscript tied to{" "}
          <span className="text-accent">{session.username}</span>.
        </p>

        {error && <p className="mt-4 text-xs text-destructive">{error}</p>}

        {total === 0 && (
          <div className="mt-10 border border-dashed border-border p-8 text-center">
            <p className="text-sm text-muted-foreground italic">
              No submissions yet. Once you submit a manuscript it will appear here — default status
              is "pending / in review" until an editor updates it.
            </p>
            <Link
              to="/submit/apply"
              className="mt-6 inline-block px-5 py-2.5 bg-accent text-accent-foreground text-xs uppercase tracking-[0.2em]"
            >
              Submit a Manuscript →
            </Link>
          </div>
        )}

        {manuscripts.length > 0 && (
          <>
            <h2 className="mt-10 font-serif text-2xl text-primary">Recent Submissions</h2>
            <ul className="mt-4 space-y-3">
              {manuscripts.map((m) => (
                <li key={m.id} className="border border-border bg-card p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-serif text-lg text-primary">{m.title}</p>
                    <span className="px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] bg-muted text-muted-foreground">
                      {m.status ?? "pending / in review"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Submitted {new Date(m.created_at).toLocaleDateString()} ·{" "}
                    {m.research_type ?? "Research Paper"}
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}

        {subs.length > 0 && (
          <>
            <h2 className="mt-10 font-serif text-2xl text-primary">Editor-Tracked Manuscripts</h2>
            <ul className="mt-4 space-y-3">
              {subs.map((r) => (
                <li key={r.id} className="border border-border bg-card p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-serif text-lg text-primary">{r.manuscript_name}</p>
                    <span
                      className={`px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] ${
                        r.decision === "accepted"
                          ? "bg-accent text-accent-foreground"
                          : r.decision === "declined"
                            ? "bg-destructive text-destructive-foreground"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {r.decision}
                    </span>
                  </div>
                  <p className="mt-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Status: <span className="text-accent">{r.status}</span>
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </SiteLayout>
  );
}
