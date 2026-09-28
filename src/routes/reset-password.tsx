import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { SiteLayout } from "@/components/SiteLayout";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset Your Password — NYRJ" },
      {
        name: "description",
        content: "Choose a new password for your National Youth Research Journal account.",
      },
      { property: "og:title", content: "Reset Your Password — NYRJ" },
      {
        property: "og:description",
        content: "Set a new password for your NYRJ account.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const initialReviewer =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("next") === "initial-reviewer";
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setReady(Boolean(data.session));
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { error: uErr } = await supabase.auth.updateUser({ password });
      if (uErr) throw uErr;
      setDone(true);
      setTimeout(() => {
        if (initialReviewer) navigate({ to: "/initial-reviewer" });
        else navigate({ to: "/" });
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update your password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SiteLayout>
      <section className="mx-auto max-w-md px-6 py-20">
        <p className="text-[10px] uppercase tracking-[0.35em] text-accent">
          {initialReviewer ? "Initial Reviewer Account" : "Account Security"}
        </p>
        <h1 className="font-serif text-3xl sm:text-4xl text-primary mt-3">Reset Your Password</h1>

        {done ? (
          <p className="mt-6 text-sm text-accent">
            Password updated. Taking you back to the journal…
          </p>
        ) : !ready ? (
          <p className="mt-6 text-sm text-muted-foreground">
            Open this page from the reset link we emailed you. If the link has expired, request a
            new one from the{" "}
            <a
              href={initialReviewer ? "/initial-reviewer" : "/login?account=student"}
              className="text-accent underline underline-offset-4"
            >
              {initialReviewer ? "initial reviewer login page" : "student login page"}
            </a>
            .
          </p>
        ) : (
          <form onSubmit={submit} className="mt-8 space-y-4 border border-border bg-card p-6">
            <label className="block">
              <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                New Password
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="mt-1 w-full border border-border bg-background px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                Confirm New Password
              </span>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="mt-1 w-full border border-border bg-background px-3 py-2 text-sm"
              />
            </label>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <button
              disabled={busy}
              className="px-5 py-2.5 bg-primary text-primary-foreground text-xs uppercase tracking-[0.2em] hover:bg-accent transition disabled:opacity-50"
            >
              {busy ? "Saving…" : "Set New Password"}
            </button>
          </form>
        )}
      </section>
    </SiteLayout>
  );
}
