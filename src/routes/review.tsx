import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { SiteLayout } from "@/components/SiteLayout";
import {
  getInvite,
  getReviewerWorkflow,
  registerReviewer,
  respondToInvite,
  reviewerLogin,
  requestReviewerPasswordReset,
  resetReviewerPassword,
  listMyAssignments,
  submitReview,
  type InviteView,
  type ReviewerAssignmentView,
} from "@/lib/peer-review.functions";

export const Route = createFileRoute("/review")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : undefined,
    reset: typeof search.reset === "string" ? search.reset : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Peer Review Portal — National Youth Research Journal" },
      {
        name: "description",
        content:
          "Peer reviewers for the National Youth Research Journal accept invitations and return reviews here.",
      },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Peer Review Portal — NYRJ" },
      {
        property: "og:description",
        content: "Accept a review invitation or return your review to the editorial team.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReviewPage,
});

const RSESSION = "nyrj.reviewer.v1";
type ReviewerSession = { token: string; expiresAt: number; name: string; email: string };

function readReviewer(): ReviewerSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(RSESSION);
    if (!raw) return null;
    const s = JSON.parse(raw) as ReviewerSession;
    if (Date.now() > s.expiresAt) {
      window.localStorage.removeItem(RSESSION);
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

const label = "text-[10px] uppercase tracking-[0.25em] text-accent";
const input =
  "mt-1 w-full border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-accent outline-none";
const btn =
  "px-5 py-2.5 bg-primary text-primary-foreground text-xs uppercase tracking-[0.2em] hover:bg-accent transition disabled:opacity-50";
const btnGhost =
  "px-5 py-2.5 border border-border text-primary text-xs uppercase tracking-[0.2em] hover:border-accent transition disabled:opacity-50";

function statusText(s: string) {
  switch (s) {
    case "invited":
      return "Awaiting your response";
    case "accepted":
      return "Accepted — review due";
    case "declined":
      return "Declined";
    case "review_received":
      return "Review submitted — thank you";
    case "sent_to_author":
      return "Feedback shared with the author";
    case "no_response":
      return "Review window closed — deadline passed";
    default:
      return s;
  }
}

function ReviewPage() {
  const { token, reset } = Route.useSearch();
  return (
    <SiteLayout>
      <section className="mx-auto max-w-3xl px-6 py-16">
        <p className={label}>Peer Review</p>
        <h1 className="font-serif text-4xl sm:text-5xl text-primary mt-3">Reviewer Portal</h1>
        {token ? (
          <ReviewerAccountPanel inviteToken={token} />
        ) : reset ? (
          <ResetPasswordForm token={reset} />
        ) : (
          <ReviewerAccountPanel />
        )}
      </section>
    </SiteLayout>
  );
}

/* --------------------------- invitation by link --------------------------- */

function InvitePanel({ token, session }: { token: string; session: ReviewerSession }) {
  const [invite, setInvite] = useState<InviteView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [comments, setComments] = useState("");
  const [touched, setTouched] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  async function load() {
    try {
      const v = await getInvite({ data: { token, reviewerToken: session.token } });
      setInvite(v);
      setLoadError(null);
      // Never overwrite text the reviewer has already typed.
      setComments((prev) => (touched && prev ? prev : v.comments || ""));
    } catch (e) {
      if (!invite) {
        setLoadError(e instanceof Error ? e.message : "This review link is not valid.");
      } else {
        setError(e instanceof Error ? e.message : "Could not refresh this invitation.");
      }
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, session.token]);

  if (loadError && !invite) return <p className="mt-8 text-sm text-destructive">{loadError}</p>;
  if (!invite) return <p className="mt-8 text-sm text-muted-foreground">Loading…</p>;

  const due = new Date(invite.dueAt).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  async function respond(accept: boolean) {
    setBusy(true);
    setError(null);
    try {
      await respondToInvite({ data: { token, reviewerToken: session.token, accept } });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function send(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await submitReview({ data: { token, reviewerToken: session.token, comments } });
      setDone("Thank you — your review has been sent to our editorial team.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-8 space-y-8">
      <div className="border border-border bg-card p-6">
        <p className={label}>Manuscript</p>
        <h2 className="font-serif text-2xl text-primary mt-2">{invite.title}</h2>
        {invite.researchDomain && (
          <p className="mt-2 text-sm text-muted-foreground">
            <span className="text-primary">Domain:</span> {invite.researchDomain}
          </p>
        )}
        {invite.keywords && (
          <p className="text-sm text-muted-foreground">
            <span className="text-primary">Keywords:</span> {invite.keywords}
          </p>
        )}
        {invite.abstract && (
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
            {invite.abstract}
          </p>
        )}
        {invite.manuscriptUrl && (
          <a
            href={invite.manuscriptUrl}
            target="_blank"
            rel="noreferrer"
            className={`${btnGhost} mt-4 inline-block`}
          >
            Open manuscript PDF
          </a>
        )}
        <p className="mt-4 text-xs uppercase tracking-[0.2em] text-accent">
          {statusText(invite.status)}
        </p>
      </div>

      {invite.status === "invited" && (
        <div className="border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Thank you for considering this invitation. We deeply appreciate your time. If you
            accept, we kindly ask that your review be returned by <strong>{due}</strong> — 15 days
            from the day it was assigned. If now isn't the right time, declining is completely
            understandable and helps us find another reviewer quickly.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button className={btn} disabled={busy} onClick={() => respond(true)}>
              Accept invitation
            </button>
            <button className={btnGhost} disabled={busy} onClick={() => respond(false)}>
              Respectfully decline
            </button>
          </div>
          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        </div>
      )}

      {invite.status === "declined" && (
        <p className="text-sm text-muted-foreground">
          You have declined this invitation. Thank you all the same — we hope to work with you on a
          future manuscript.
        </p>
      )}

      {(invite.status === "accepted" || invite.status === "review_received") && (
        <form onSubmit={send} className="border border-border bg-card p-6">
          <p className={label}>Your review</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Please share your edits, comments, and recommendation below. Your review is due by{" "}
            <strong>{due}</strong>.
          </p>
          <textarea
            className={`${input} min-h-[240px]`}
            value={comments}
            onChange={(e) => {
              setTouched(true);
              setComments(e.target.value);
            }}
            maxLength={20000}
            placeholder="Summary, strengths, specific edits, and your recommendation…"
          />
          {done && <p className="mt-3 text-sm text-accent">{done}</p>}
          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
          <button className={`${btn} mt-4`} disabled={busy || !comments.trim()}>
            {invite.status === "review_received" ? "Resend review" : "Send review to editors"}
          </button>
        </form>
      )}

      {invite.status === "sent_to_author" && (
        <p className="text-sm text-muted-foreground">
          Your feedback has been shared with the author. Thank you for supporting student research.
        </p>
      )}
    </div>
  );
}

/* ------------------------ reviewer account + inbox ------------------------ */

function ReviewerAccountPanel({ inviteToken }: { inviteToken?: string }) {
  const [session, setSession] = useState<ReviewerSession | null>(null);
  const [mode, setMode] = useState<"login" | "register" | "forgot">("login");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setSession(readReviewer());
    setReady(true);
  }, []);

  if (!ready) return null;

  if (session && inviteToken) {
    return (
      <div className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Signed in as <span className="text-primary">{session.name}</span> ({session.email})
          </p>
          <button
            className={btnGhost}
            onClick={() => {
              window.localStorage.removeItem(RSESSION);
              setSession(null);
            }}
          >
            Switch reviewer account
          </button>
        </div>
        <InvitePanel token={inviteToken} session={session} />
      </div>
    );
  }

  if (session) return <ReviewerInbox session={session} onLogout={() => setSession(null)} />;

  return (
    <div className="mt-8">
      <p className="text-sm text-muted-foreground leading-relaxed">
        {inviteToken
          ? "Sign in with the reviewer account matching this invitation. If you do not have an account yet, request one below; editorial staff must approve it before you can open the manuscript or respond."
          : "Peer reviewers sign in here to see the manuscripts assigned to them. New reviewers can request an account — our editorial staff approves each request before access is granted."}
      </p>
      <div className="mt-6 flex gap-3">
        <button
          className={mode === "login" ? btn : btnGhost}
          onClick={() => setMode("login")}
          type="button"
        >
          Sign in
        </button>
        <button
          className={mode === "register" ? btn : btnGhost}
          onClick={() => setMode("register")}
          type="button"
        >
          Request an account
        </button>
      </div>
      {mode === "login" && (
        <ReviewerLoginForm onLogin={setSession} onForgot={() => setMode("forgot")} />
      )}
      {mode === "register" && <ReviewerRegisterForm />}
      {mode === "forgot" && <ForgotPasswordForm onBack={() => setMode("login")} />}
    </div>
  );
}

function ReviewerLoginForm({
  onLogin,
  onForgot,
}: {
  onLogin: (s: ReviewerSession) => void;
  onForgot: () => void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const s = await reviewerLogin({ data: { username, password } });
      window.localStorage.setItem(RSESSION, JSON.stringify(s));
      onLogin(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 border border-border bg-card p-6 space-y-4">
      <div>
        <label className={label}>Username</label>
        <input className={input} value={username} onChange={(e) => setUsername(e.target.value)} />
      </div>
      <div>
        <label className={label}>Password</label>
        <input
          className={input}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex items-center gap-4 flex-wrap">
        <button className={btn} disabled={busy}>
          Sign in
        </button>
        <button
          type="button"
          onClick={onForgot}
          className="text-xs text-accent underline underline-offset-4"
        >
          Forgot your password?
        </button>
      </div>
    </form>
  );
}

function ForgotPasswordForm({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await requestReviewerPasswordReset({ data: { email } });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="mt-6 border border-border bg-card p-6">
        <p className="text-sm text-muted-foreground leading-relaxed">
          If an account exists for <strong>{email}</strong>, we have just emailed a link for
          choosing a new password. It stays valid for one hour. Do check your spam folder, and write
          to NYRJINFO@gmail.com if you need a hand.
        </p>
        <button type="button" onClick={onBack} className={`${btnGhost} mt-5`}>
          Back to sign in
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-6 border border-border bg-card p-6 space-y-4">
      <p className="text-sm text-muted-foreground leading-relaxed">
        Enter the email address on your reviewer account and we will send you a link to set a new
        password.
      </p>
      <div>
        <label className={label}>Email address</label>
        <input
          className={input}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex items-center gap-4 flex-wrap">
        <button className={btn} disabled={busy || !email.trim()}>
          {busy ? "Sending…" : "Send reset link"}
        </button>
        <button
          type="button"
          onClick={onBack}
          className="text-xs text-accent underline underline-offset-4"
        >
          Back to sign in
        </button>
      </div>
    </form>
  );
}

function ResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError("Please use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await resetReviewerPassword({ data: { token, password } });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update your password.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="mt-8 border border-border bg-card p-6">
        <p className="text-sm text-muted-foreground leading-relaxed">
          Your password has been updated. You can now sign in with it.
        </p>
        <a href="/review" className={`${btn} mt-5 inline-block`}>
          Go to sign in
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-8 border border-border bg-card p-6 space-y-4">
      <p className="text-sm text-muted-foreground leading-relaxed">
        Choose a new password for your reviewer account.
      </p>
      <div>
        <label className={label}>New password</label>
        <input
          className={input}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div>
        <label className={label}>Confirm new password</label>
        <input
          className={input}
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <button className={btn} disabled={busy}>
        {busy ? "Saving…" : "Set new password"}
      </button>
    </form>
  );
}

function ReviewerRegisterForm() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    username: "",
    password: "",
    expertise: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  function set(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await registerReviewer({ data: form });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the request.");
    } finally {
      setBusy(false);
    }
  }

  if (done)
    return (
      <div className="mt-6 border border-border bg-card p-6">
        <p className="text-sm text-muted-foreground">
          Thank you. Your reviewer account request has been sent to our editorial staff. You'll
          receive an email once it is approved, and can then sign in with the username and password
          you chose.
        </p>
      </div>
    );

  return (
    <form onSubmit={submit} className="mt-6 border border-border bg-card p-6 space-y-4">
      <div>
        <label className={label}>Full name</label>
        <input className={input} value={form.name} onChange={(e) => set("name", e.target.value)} />
      </div>
      <div>
        <label className={label}>Email</label>
        <input
          className={input}
          type="email"
          value={form.email}
          onChange={(e) => set("email", e.target.value)}
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Use the same email our editors send invitations to.
        </p>
      </div>
      <div>
        <label className={label}>Choose a username</label>
        <input
          className={input}
          value={form.username}
          onChange={(e) => set("username", e.target.value)}
        />
      </div>
      <div>
        <label className={label}>Choose a password</label>
        <input
          className={input}
          type="password"
          value={form.password}
          onChange={(e) => set("password", e.target.value)}
        />
        <p className="mt-1 text-xs text-muted-foreground">At least 8 characters.</p>
      </div>
      <div>
        <label className={label}>Fields of expertise</label>
        <input
          className={input}
          value={form.expertise}
          onChange={(e) => set("expertise", e.target.value)}
          placeholder="e.g. Molecular biology, statistics"
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <button className={btn} disabled={busy}>
        Request reviewer account
      </button>
    </form>
  );
}

function ReviewerInbox({ session, onLogout }: { session: ReviewerSession; onLogout: () => void }) {
  const [rows, setRows] = useState<ReviewerAssignmentView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [workflowUrl, setWorkflowUrl] = useState<string | null>(null);

  async function load() {
    try {
      setRows(await listMyAssignments({ data: { reviewerToken: session.token } }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your assignments.");
    }
  }

  useEffect(() => {
    void load();
    void getReviewerWorkflow({ data: { reviewerToken: session.token } })
      .then((resource) => setWorkflowUrl(resource.url))
      .catch(() => setWorkflowUrl(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function act(row: ReviewerAssignmentView, accept: boolean) {
    setBusy(true);
    try {
      await respondToInvite({
        data: { token: row.token, reviewerToken: session.token, accept },
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function send(row: ReviewerAssignmentView) {
    setBusy(true);
    setNote(null);
    try {
      await submitReview({
        data: { token: row.token, reviewerToken: session.token, comments: draft },
      });
      setNote("Thank you — your review was sent to our editorial team.");
      setOpenId(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Signed in as <span className="text-primary">{session.name}</span>
        </p>
        <div className="flex flex-wrap gap-3">
          {workflowUrl && (
            <a href={workflowUrl} target="_blank" rel="noreferrer" className={btnGhost}>
              Editorial workflow PDF
            </a>
          )}
          <button
            className={btnGhost}
            onClick={() => {
              window.localStorage.removeItem(RSESSION);
              onLogout();
            }}
          >
            Sign out
          </button>
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
      {note && <p className="mt-4 text-sm text-accent">{note}</p>}

      {rows === null && <p className="mt-8 text-sm text-muted-foreground">Loading…</p>}
      {rows?.length === 0 && (
        <p className="mt-8 text-sm text-muted-foreground">
          You have no manuscripts assigned right now. We'll email you as soon as one is.
        </p>
      )}

      <div className="mt-8 space-y-6">
        {(rows ?? []).map((r) => (
          <div key={r.assignmentId} className="border border-border bg-card p-6">
            <h3 className="font-serif text-2xl text-primary">{r.title}</h3>
            <p className="mt-1 text-xs uppercase tracking-[0.2em] text-accent">
              {statusText(r.status)} ·{" "}
              {new Date(r.dueAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
            {r.researchDomain && (
              <p className="mt-2 text-sm text-muted-foreground">Domain: {r.researchDomain}</p>
            )}
            {r.keywords && <p className="text-sm text-muted-foreground">Keywords: {r.keywords}</p>}
            {r.abstract && (
              <p className="mt-3 text-sm text-muted-foreground whitespace-pre-wrap">{r.abstract}</p>
            )}
            {r.manuscriptUrl && (
              <a
                href={r.manuscriptUrl}
                target="_blank"
                rel="noreferrer"
                className={`${btnGhost} mt-4 inline-block`}
              >
                Open manuscript PDF
              </a>
            )}

            {r.status === "invited" && (
              <div className="mt-4 flex gap-3">
                <button className={btn} disabled={busy} onClick={() => act(r, true)}>
                  Accept
                </button>
                <button className={btnGhost} disabled={busy} onClick={() => act(r, false)}>
                  Decline
                </button>
              </div>
            )}

            {(r.status === "accepted" || r.status === "review_received") && (
              <div className="mt-4">
                {openId === r.assignmentId ? (
                  <>
                    <textarea
                      className={`${input} min-h-[200px]`}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      maxLength={20000}
                    />
                    <div className="mt-3 flex gap-3">
                      <button
                        className={btn}
                        disabled={busy || !draft.trim()}
                        onClick={() => send(r)}
                      >
                        Send review
                      </button>
                      <button className={btnGhost} onClick={() => setOpenId(null)}>
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <button
                    className={btn}
                    onClick={() => {
                      setDraft(r.comments || "");
                      setOpenId(r.assignmentId);
                    }}
                  >
                    {r.status === "review_received" ? "Edit review" : "Write review"}
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
