import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { SiteLayout } from "@/components/SiteLayout";
import { supabase } from "@/integrations/supabase/client";
import {
  getInitialReviewerDesk,
  submitInitialReview,
  createInitialReviewerAccount,
  type InitialReviewAssignment,
} from "@/lib/initial-reviewer-portal.functions";

export const Route = createFileRoute("/initial-reviewer")({
  head: () => ({
    meta: [
      { title: "Initial Reviewer Login — NYRJ" },
      { name: "description", content: "Secure initial reviewer desk for NYRJ manuscripts." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: InitialReviewerPage,
});

const input = "w-full border border-border bg-background px-3 py-2.5 text-sm";
const label = "text-[10px] uppercase tracking-[0.25em] text-accent";
const primaryButton =
  "px-5 py-2.5 bg-primary text-primary-foreground text-xs uppercase tracking-[0.2em] hover:bg-accent transition disabled:opacity-50";
const secondaryButton =
  "px-4 py-2 border border-border text-[11px] uppercase tracking-[0.2em] hover:bg-muted disabled:opacity-50";

function InitialReviewerPage() {
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setSignedIn(Boolean(data.session));
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(Boolean(session));
      setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return (
    <SiteLayout>
      <section className="mx-auto max-w-5xl px-6 py-16">
        <p className={label}>Editorial Review</p>
        <h1 className="font-serif text-4xl sm:text-5xl text-primary mt-3">Initial Reviewer</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Sign in with the email address in your reviewer invitation to view assigned manuscripts
          and send recommendations to NYRJ staff.
        </p>
        {!ready ? (
          <p className="mt-8 text-sm text-muted-foreground">Loading your reviewer desk…</p>
        ) : signedIn ? (
          <ReviewerDesk />
        ) : (
          <ReviewerAuth />
        )}
      </section>
    </SiteLayout>
  );
}

function ReviewerAuth() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    const normalized = email.trim().toLowerCase();
    try {
      if (mode === "signup") {
        const result = await createInitialReviewerAccount({
          data: { email: normalized, password, accessCode },
        });
        setNotice(
          result.delivery === "password_setup"
            ? "This email already has an NYRJ account. We emailed you a secure link to set its password and open your reviewer desk."
            : "Check your inbox to confirm your email, then return here to sign in.",
        );
        setMode("login");
        setPassword("");
        setAccessCode("");
      } else {
        const { error: loginError } = await supabase.auth.signInWithPassword({
          email: normalized,
          password,
        });
        if (loginError) throw loginError;
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not complete sign-in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-8 max-w-md border border-border bg-card p-6">
      <p className={label}>
        {mode === "login" ? "Initial Reviewer Login" : "Create Reviewer Account"}
      </p>
      <form onSubmit={submit} className="mt-5 space-y-4">
        <Field label="Reviewer email" type="email" value={email} onChange={setEmail} />
        <Field
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          minLength={mode === "signup" ? 8 : 1}
        />
        {mode === "signup" && (
          <Field
            label="Access code"
            type="password"
            value={accessCode}
            onChange={setAccessCode}
            minLength={4}
          />
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        {notice && <p className="text-sm text-primary">{notice}</p>}
        <div className="flex flex-wrap items-center gap-4">
          <button className={primaryButton} disabled={busy}>
            {busy ? "Please wait…" : mode === "login" ? "Sign In" : "Create Account"}
          </button>
          <button
            type="button"
            className="text-xs text-muted-foreground underline underline-offset-4 hover:text-accent"
            onClick={() => {
              setMode(mode === "login" ? "signup" : "login");
              setError(null);
              setNotice(null);
            }}
          >
            {mode === "login" ? "Create invited account" : "Back to login"}
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
  minLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  minLength?: number;
}) {
  return (
    <label className="block">
      <span className={label}>{text}</span>
      <input
        required
        type={type}
        value={value}
        minLength={minLength}
        onChange={(event) => onChange(event.target.value)}
        className={`${input} mt-1`}
      />
    </label>
  );
}

function ReviewerDesk() {
  const [data, setData] = useState<Awaited<ReturnType<typeof getInitialReviewerDesk>> | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      setData(await getInitialReviewerDesk());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load your reviewer desk.");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-center gap-3">
        {data && (
          <p className="mr-auto text-sm text-muted-foreground">
            Signed in as <span className="text-primary">{data.reviewer.name}</span> (
            {data.reviewer.email})
          </p>
        )}
        {data && (
          <a href={data.workflowUrl} className={secondaryButton} target="_blank" rel="noreferrer">
            Editorial workflow PDF
          </a>
        )}
        <button className={secondaryButton} onClick={() => void load()}>
          Refresh
        </button>
        <button
          className={secondaryButton}
          onClick={async () => {
            await supabase.auth.signOut();
          }}
        >
          Sign Out
        </button>
      </div>

      {error && (
        <p className="mt-6 border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </p>
      )}
      {!data && !error && (
        <p className="mt-6 text-sm text-muted-foreground">Loading assignments…</p>
      )}
      {data?.assignments.length === 0 && (
        <p className="mt-6 border border-border bg-card p-5 text-sm text-muted-foreground">
          You do not have any assigned manuscripts right now.
        </p>
      )}
      <div className="mt-6 space-y-5">
        {data?.assignments.map((assignment) => (
          <AssignmentCard key={assignment.id} assignment={assignment} onSubmitted={load} />
        ))}
      </div>
    </div>
  );
}

function AssignmentCard({
  assignment,
  onSubmitted,
}: {
  assignment: InitialReviewAssignment;
  onSubmitted: () => Promise<void>;
}) {
  const [action, setAction] = useState<"accept" | "decline">("accept");
  const [comments, setComments] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = assignment.recommendation?.status === "pending";
  const closed = assignment.decision !== "pending";

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await submitInitialReview({
        data: { submissionId: assignment.id, action, comments },
      });
      setOpen(false);
      setComments("");
      await onSubmitted();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not submit your review.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-[240px] flex-1">
          <p className={label}>Assigned manuscript</p>
          <h2 className="mt-2 font-serif text-2xl text-primary">{assignment.title}</h2>
          <p className="mt-2 text-xs text-muted-foreground">
            {assignment.status} · {assignment.decision} ·{" "}
            {new Date(assignment.created_at).toLocaleDateString()}
          </p>
          {assignment.research_domain && (
            <p className="mt-1 text-xs text-muted-foreground">
              Domain: {assignment.research_domain}
            </p>
          )}
          {assignment.keywords && (
            <p className="text-xs text-muted-foreground">Keywords: {assignment.keywords}</p>
          )}
        </div>
        {assignment.download_url && (
          <a href={assignment.download_url} className={secondaryButton}>
            Download manuscript
          </a>
        )}
      </div>
      {assignment.abstract && (
        <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
          {assignment.abstract}
        </p>
      )}

      {assignment.recommendation && (
        <div className="mt-4 border-l-2 border-accent pl-4 text-sm text-muted-foreground">
          Latest recommendation:{" "}
          <span className="text-primary">{assignment.recommendation.action}</span> ·{" "}
          {assignment.recommendation.status}
          {assignment.recommendation.staff_message && (
            <p className="mt-1">Staff note: {assignment.recommendation.staff_message}</p>
          )}
        </div>
      )}

      {!closed && !pending && (
        <div className="mt-5">
          <button className={primaryButton} onClick={() => setOpen((value) => !value)}>
            {open ? "Close Review" : "Review Manuscript"}
          </button>
        </div>
      )}
      {pending && (
        <p className="mt-5 text-sm text-accent">
          Your review is waiting for staff approval. Nothing has been sent to the author yet.
        </p>
      )}
      {closed && (
        <p className="mt-5 text-sm text-muted-foreground">
          This manuscript has a final decision and is closed for initial review.
        </p>
      )}

      {open && !pending && !closed && (
        <div className="mt-5 space-y-4 border-t border-border pt-5">
          <div className="flex gap-2">
            {(["accept", "decline"] as const).map((choice) => (
              <button
                key={choice}
                type="button"
                onClick={() => setAction(choice)}
                className={`${secondaryButton} ${action === choice ? "border-primary bg-primary text-primary-foreground" : ""}`}
              >
                Recommend {choice}
              </button>
            ))}
          </div>
          <label className="block">
            <span className={label}>Comments for the author</span>
            <textarea
              value={comments}
              onChange={(event) => setComments(event.target.value)}
              rows={8}
              maxLength={20000}
              placeholder="Write clear, constructive comments. Staff will review and may edit them before anything is sent to the author."
              className={`${input} mt-2`}
            />
          </label>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <button
            className={primaryButton}
            disabled={busy || !comments.trim()}
            onClick={() => void submit()}
          >
            {busy ? "Submitting…" : "Send to Staff for Approval"}
          </button>
        </div>
      )}
    </article>
  );
}
