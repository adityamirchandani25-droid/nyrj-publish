import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useId, useState, type FormEvent } from "react";
import { SiteLayout } from "@/components/SiteLayout";
import { AuthorDashboard } from "@/components/AuthorDashboard";
import {
  bridgeSupabaseSession,
  getSession,
  isResearcher,
  loginStaff,
  logout,
  onAuthChange,
  resendStudentConfirmation,
  signInStudent,
  signInStudentWithGoogle,
  signUpStudent,
  type Role,
  type Session,
} from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { loginAmbassador } from "@/lib/auth";

/**
 * Turns a raw sign-in failure into something a student can act on.
 * Service outages are reported as outages rather than as bad credentials,
 * so nobody is told their password is wrong when it isn't.
 */
function isServiceOutage(msg: string): boolean {
  return /failed to fetch|network|load failed|fetch failed|timeout|timed out|503|502|504|unavailable|unexpected error occurred/i.test(
    msg,
  );
}

const OUTAGE_MESSAGE =
  "Our sign-in service is temporarily unreachable. Your account is safe — please try again in a few minutes.";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>) =>
    ({
      account:
        search.account === "student" ||
        search.account === "staff" ||
        search.account === "ambassador"
          ? search.account
          : undefined,
      mode: search.mode === "signup" ? "signup" : undefined,
    }) as { account?: "student" | "staff" | "ambassador"; mode?: "signup" },
  head: () => ({
    meta: [
      { title: "Log In — NYRJ" },
      { name: "description", content: "Log in to the National Youth Research Journal." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: LoginPage,
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

function LoginPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const searchRole: Role | null =
    search.account === "student"
      ? "researcher"
      : search.account === "staff"
        ? "staff"
        : search.account === "ambassador"
          ? "ambassador"
          : null;
  const [role, setRole] = useState<Role | null>(searchRole);
  const [current, setCurrent] = useState<Session | null>(null);
  const [oauthError, setOauthError] = useState<string | null>(null);

  useEffect(() => {
    bridgeSupabaseSession();
    setCurrent(getSession());
    return onAuthChange(setCurrent);
  }, []);

  useEffect(() => {
    setRole(searchRole);
  }, [searchRole]);

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const query = new URLSearchParams(window.location.search);
    const description = hash.get("error_description") ?? query.get("error_description");
    const oauthFailure = hash.get("error") ?? query.get("error");
    if (description || oauthFailure) {
      setOauthError(
        description?.replace(/\+/g, " ") ??
          "Google sign-in was cancelled or could not be completed. Please try again.",
      );
      window.history.replaceState(null, "", "/login");
    }
  }, []);

  function chooseRole(nextRole: Role | null) {
    setRole(nextRole);
    if (typeof window !== "undefined") {
      const account = nextRole === "researcher" ? "student" : nextRole;
      const nextUrl = account ? `/login?account=${account}` : "/login";
      window.history.replaceState(null, "", nextUrl);
    }
  }

  if (current) {
    return (
      <SiteLayout>
        <section className="mx-auto max-w-3xl px-6 py-16">
          <p className="text-[10px] uppercase tracking-[0.35em] text-accent">Signed In</p>
          <h2 className="font-serif text-4xl text-primary mt-3">Welcome, {current.username}</h2>
          <p className="mt-3 text-muted-foreground">
            You are logged in as{" "}
            <span className="text-accent uppercase tracking-[0.2em] text-xs">{current.role}</span>.
          </p>
          <div className="mt-6 flex gap-4">
            <button
              onClick={() => navigate({ to: "/" })}
              className="px-5 py-2.5 bg-primary text-primary-foreground text-xs uppercase tracking-[0.2em] hover:bg-accent transition"
            >
              Go to Home
            </button>
            <button
              onClick={async () => {
                await logout();
                setCurrent(null);
              }}
              className="px-5 py-2.5 border border-primary text-primary text-xs uppercase tracking-[0.2em] hover:bg-primary hover:text-primary-foreground transition"
            >
              Log Out
            </button>
          </div>

          {isResearcher(current) && (
            <>
              <AuthorGuidelinesPanel />
              <AuthorDashboard email={current.username} />
              <SubmissionTracker email={current.username} />
            </>
          )}
        </section>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
      <section className="mx-auto max-w-2xl px-6 py-16">
        <p className="text-[10px] uppercase tracking-[0.35em] text-accent">Account Access</p>
        <h2 className="font-serif text-4xl sm:text-5xl text-primary mt-3">Log In</h2>
        <p className="mt-3 text-muted-foreground">Choose how you'd like to sign in.</p>
        {oauthError && (
          <p className="mt-5 border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {oauthError}
          </p>
        )}

        {role === null && (
          <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <a
              href="/login?account=student"
              onClick={(e) => {
                e.preventDefault();
                chooseRole("researcher");
              }}
              className="border border-border bg-card p-6 text-left hover:border-accent transition"
            >
              <p className="text-[10px] uppercase tracking-[0.25em] text-accent">Student</p>
              <h3 className="font-serif text-2xl text-primary mt-2">Student Login</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Sign in or create an account with your email and password.
              </p>
            </a>
            <a
              href="/login?account=staff"
              onClick={(e) => {
                e.preventDefault();
                chooseRole("staff");
              }}
              className="border border-border bg-card p-6 text-left hover:border-accent transition"
            >
              <p className="text-[10px] uppercase tracking-[0.25em] text-accent">Staff</p>
              <h3 className="font-serif text-2xl text-primary mt-2">Staff Login</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                For editors with publishing access.
              </p>
            </a>
            <a
              href="/review"
              className="border border-border bg-card p-6 text-left hover:border-accent transition"
            >
              <p className="text-[10px] uppercase tracking-[0.25em] text-accent">Peer Reviewer</p>
              <h3 className="font-serif text-2xl text-primary mt-2">Reviewer Login</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                For invited peer reviewers. Create an account — access is granted once our editors
                approve it.
              </p>
            </a>
            <a
              href="/initial-reviewer"
              className="border border-border bg-card p-6 text-left hover:border-accent transition"
            >
              <p className="text-[10px] uppercase tracking-[0.25em] text-accent">
                Initial Reviewer
              </p>
              <h3 className="font-serif text-2xl text-primary mt-2">Initial Reviewer Login</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Create an account with the reviewer access code, then sign in to view assigned
                manuscripts.
              </p>
            </a>
            <a
              href="/login?account=ambassador"
              onClick={(e) => {
                e.preventDefault();
                chooseRole("ambassador");
              }}
              className="border border-border bg-card p-6 text-left hover:border-accent transition"
            >
              <p className="text-[10px] uppercase tracking-[0.25em] text-accent">Ambassador</p>
              <h3 className="font-serif text-2xl text-primary mt-2">Ambassador Login</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                For chapter leads registering clubs and reporting attendance.
              </p>
            </a>
          </div>
        )}

        {role === "staff" && (
          <StaffForm onBack={() => chooseRole(null)} onSuccess={() => navigate({ to: "/" })} />
        )}
        {role === "researcher" && (
          <StudentOtpForm
            onBack={() => chooseRole(null)}
            onSuccess={() => setCurrent(getSession())}
          />
        )}
        {role === "ambassador" && (
          <AmbassadorForm
            onBack={() => chooseRole(null)}
            onSuccess={() => navigate({ to: "/ambassador" })}
          />
        )}

        <AuthorGuidelinesPanel />
      </section>
    </SiteLayout>
  );
}

function AuthorGuidelinesPanel() {
  return (
    <section className="mt-10 border border-border bg-card p-6">
      <p className="text-[10px] uppercase tracking-[0.25em] text-accent">Author Guidelines</p>
      <h3 className="mt-2 font-serif text-2xl text-primary">Prepare your manuscript</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Review the required manuscript structure, title-page format, approved reference styles, and
        submission formatting before uploading your paper. No login is required to view or download
        the guide.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <a
          href="/docs/author-guidelines.pdf"
          target="_blank"
          rel="noreferrer"
          className="inline-block px-5 py-2.5 bg-primary text-primary-foreground text-xs uppercase tracking-[0.2em] hover:bg-accent transition"
        >
          Open Author Guidelines PDF
        </a>
        <a
          href="/docs/author-guidelines.pdf"
          download="NYRJ-Author-Guidelines.pdf"
          className="inline-block px-5 py-2.5 border border-primary text-primary text-xs uppercase tracking-[0.2em] hover:bg-primary hover:text-primary-foreground transition"
        >
          Download PDF
        </a>
      </div>
    </section>
  );
}

function StaffForm({ onBack, onSuccess }: { onBack: () => void; onSuccess: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await loginStaff(username, password);
      if (r.ok) {
        setError(null);
        onSuccess();
      } else setError(r.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-10 border border-border bg-card p-6 space-y-4 max-w-md">
      <p className="text-[10px] uppercase tracking-[0.25em] text-accent">Staff Login</p>
      <FieldRow label="Username" value={username} onChange={setUsername} />
      <FieldRow label="Password" type="password" value={password} onChange={setPassword} />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex items-center gap-4">
        <button className="px-5 py-2.5 bg-primary text-primary-foreground text-xs uppercase tracking-[0.2em] hover:bg-accent transition">
          Log In
        </button>
        <button
          type="button"
          onClick={onBack}
          className="text-xs text-muted-foreground hover:text-accent underline underline-offset-4"
        >
          ← Choose a different login
        </button>
      </div>
    </form>
  );
}

function AmbassadorForm({ onBack, onSuccess }: { onBack: () => void; onSuccess: () => void }) {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await loginAmbassador(name, password);
      if (r.ok) onSuccess();
      else setError(r.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-10 border border-border bg-card p-6 space-y-4 max-w-md">
      <p className="text-[10px] uppercase tracking-[0.25em] text-accent">Ambassador Login</p>
      <form onSubmit={submit} className="space-y-4">
        <FieldRow label="Your Name" value={name} onChange={setName} placeholder="Jane Doe" />
        <FieldRow
          label="Ambassador Password"
          type="password"
          value={password}
          onChange={setPassword}
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex items-center gap-4">
          <button
            disabled={busy}
            className="px-5 py-2.5 bg-primary text-primary-foreground text-xs uppercase tracking-[0.2em] hover:bg-accent transition disabled:opacity-50"
          >
            {busy ? "Signing in…" : "Log In"}
          </button>
          <button
            type="button"
            onClick={onBack}
            className="text-xs text-muted-foreground hover:text-accent underline underline-offset-4"
          >
            ← Back
          </button>
        </div>
      </form>

      <p className="pt-4 border-t border-border text-xs text-muted-foreground">
        Forgot the password? Email NYRJINFO@Gmail.com and the team will help you.
      </p>
    </div>
  );
}

function StudentOtpForm({ onBack, onSuccess }: { onBack: () => void; onSuccess: () => void }) {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const searchMode = search.mode === "signup" ? "signup" : "login";
  const [mode, setMode] = useState<"login" | "signup">(searchMode);
  const [step, setStep] = useState<"auth" | "profile">("auth");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [age, setAge] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  async function signInWithGoogle() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await signInStudentWithGoogle();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Google sign-in failed.";
      setError(isServiceOutage(msg) ? OUTAGE_MESSAGE : msg);
      setBusy(false);
    }
  }

  async function resendConfirmation() {
    const normalized = email.trim().toLowerCase();
    if (!normalized) {
      setError("Enter your email address above first.");
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await resendStudentConfirmation(normalized);
      setNotice(
        "Confirmation email sent. Check your inbox and spam folder, then follow the link before signing in.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't resend the confirmation email.");
    } finally {
      setBusy(false);
    }
  }

  async function sendReset() {
    const normalized = email.trim().toLowerCase();
    if (!normalized) {
      setError("Enter your email address above, then click “Forgot your password?”.");
      return;
    }
    setBusy(true);
    setError(null);
    setNeedsConfirmation(false);
    setNotice(null);
    try {
      const { error: rErr } = await supabase.auth.resetPasswordForEmail(normalized, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (rErr) throw rErr;
      setNotice(
        "If an account exists for that email, we've sent a password reset link. Check your inbox (and spam folder).",
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Couldn't send the reset email. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    setMode(searchMode);
    setError(null);
  }, [searchMode]);

  function chooseMode(nextMode: "login" | "signup") {
    setMode(nextMode);
    setError(null);
    setNotice(null);
    setNeedsConfirmation(false);
    if (typeof window !== "undefined") {
      window.history.replaceState(
        null,
        "",
        nextMode === "signup" ? "/login?account=student&mode=signup" : "/login?account=student",
      );
    }
  }

  async function routeAfterAuth() {
    const { count } = await supabase
      .from("submissions")
      .select("id", { count: "exact", head: true });
    if ((count ?? 0) > 0) {
      onSuccess();
    } else {
      navigate({ to: "/" });
    }
  }

  async function submitLogin(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    setNeedsConfirmation(false);
    try {
      await signInStudent(email, password);
      await routeAfterAuth();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Login failed.";
      if (isServiceOutage(msg)) {
        setError(OUTAGE_MESSAGE);
      } else if (/invalid.*credentials/i.test(msg)) {
        setError(
          "That email or password doesn't match an account. If you're new, use Sign up below.",
        );
      } else if (/not confirmed/i.test(msg)) {
        setNeedsConfirmation(true);
        setError(
          "Your account isn't confirmed yet. Resend the confirmation email, then follow its link before signing in.",
        );
      } else {
        setError(msg);
      }
    } finally {
      setBusy(false);
    }
  }

  async function submitSignup(e: FormEvent) {
    e.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!fullName.trim()) {
      setError("Please enter your full name.");
      return;
    }
    if (!normalizedEmail) {
      setError("Please enter your email address.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const data = await signUpStudent(normalizedEmail, password, fullName);
      if (!data.session) {
        setNotice(
          "Check your inbox and spam folder for a confirmation email. Follow its link before signing in.",
        );
        setMode("login");
        setNeedsConfirmation(true);
        return;
      }
      setStep("profile");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sign up failed.";
      if (isServiceOutage(msg)) {
        setError(OUTAGE_MESSAGE);
      } else if (/registered|already/i.test(msg)) {
        setError("An account with that email already exists. Please log in instead.");
      } else if (/invalid.*email/i.test(msg)) {
        setError("Please enter a valid email address.");
      } else if (/weak|password/i.test(msg)) {
        setError("Please use a stronger password with at least 6 characters.");
      } else {
        setError(
          "We couldn't create the account. Please check the email and password, then try again.",
        );
      }
    } finally {
      setBusy(false);
    }
  }

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Not signed in.");
      const profileEmail = userData.user?.email ?? email.trim().toLowerCase();
      const { error: upErr } = await supabase.from("profiles").upsert({
        id: uid,
        email: profileEmail,
        full_name: fullName.trim(),
        phone: phone.trim(),
        age: age.trim() ? Number(age.trim()) : null,
      });
      if (upErr) throw upErr;
      await routeAfterAuth();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-10 border border-border bg-card p-6 space-y-4 max-w-md">
      <p className="text-[10px] uppercase tracking-[0.25em] text-accent">
        {mode === "login" ? "Student Login" : "Student Sign Up"}
      </p>

      {step === "auth" && (
        <>
          <button
            type="button"
            onClick={signInWithGoogle}
            disabled={busy}
            className="flex w-full items-center justify-center gap-3 border border-border bg-background px-5 py-3 text-sm font-medium text-foreground transition hover:border-accent hover:bg-secondary disabled:opacity-50"
          >
            <GoogleIcon />
            {busy ? "Opening Google…" : "Continue with Google"}
          </button>
          <div className="flex items-center gap-3" aria-hidden="true">
            <span className="h-px flex-1 bg-border" />
            <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              or use email
            </span>
            <span className="h-px flex-1 bg-border" />
          </div>
        </>
      )}

      {step === "auth" && mode === "login" && (
        <form onSubmit={submitLogin} className="space-y-4">
          <FieldRow
            label="Email Address"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="you@example.com"
          />
          <FieldRow label="Password" type="password" value={password} onChange={setPassword} />
          {error && <p className="text-xs text-destructive">{error}</p>}
          {notice && <p className="text-xs text-accent">{notice}</p>}
          {needsConfirmation && (
            <button
              type="button"
              onClick={resendConfirmation}
              disabled={busy}
              className="text-xs text-accent hover:text-primary underline underline-offset-4 disabled:opacity-50"
            >
              Resend confirmation email
            </button>
          )}
          <button
            type="button"
            onClick={sendReset}
            disabled={busy}
            className="text-xs text-muted-foreground hover:text-accent underline underline-offset-4 disabled:opacity-50"
          >
            Forgot your password?
          </button>

          <div className="flex items-center gap-4">
            <button
              disabled={busy}
              className="px-5 py-2.5 bg-primary text-primary-foreground text-xs uppercase tracking-[0.2em] hover:bg-accent transition disabled:opacity-50"
            >
              {busy ? "Signing in…" : "Log In"}
            </button>
            <button
              type="button"
              onClick={onBack}
              className="text-xs text-muted-foreground hover:text-accent underline underline-offset-4"
            >
              ← Back
            </button>
          </div>
          <p className="pt-4 border-t border-border text-xs text-muted-foreground">
            Don't have an account?{" "}
            <a
              href="/login?account=student&mode=signup"
              onClick={() => {
                chooseMode("signup");
              }}
              className="text-accent underline underline-offset-4"
            >
              Sign up here
            </a>
          </p>
        </form>
      )}

      {step === "auth" && mode === "signup" && (
        <form onSubmit={submitSignup} className="space-y-4">
          <FieldRow
            label="Full Name"
            value={fullName}
            onChange={setFullName}
            placeholder="Jane Doe"
          />
          <FieldRow
            label="Email Address"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="you@example.com"
          />
          <FieldRow
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            placeholder="At least 6 characters"
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex items-center gap-4">
            <button
              disabled={busy}
              className="px-5 py-2.5 bg-primary text-primary-foreground text-xs uppercase tracking-[0.2em] hover:bg-accent transition disabled:opacity-50"
            >
              {busy ? "Creating…" : "Create Account"}
            </button>
            <a
              href="/login?account=student"
              onClick={() => {
                chooseMode("login");
              }}
              className="text-xs text-muted-foreground hover:text-accent underline underline-offset-4"
            >
              ← Back to login
            </a>
          </div>
        </form>
      )}

      {step === "profile" && (
        <form onSubmit={saveProfile} className="space-y-4">
          <p className="text-sm">Just a few quick details to finish your account.</p>
          <FieldRow label="Full Name" value={fullName} onChange={setFullName} />
          <FieldRow
            label="Phone Number"
            type="tel"
            value={phone}
            onChange={setPhone}
            placeholder="(555) 555-5555"
          />
          <FieldRow label="Age" type="number" value={age} onChange={setAge} placeholder="e.g. 16" />
          <p className="text-xs text-muted-foreground italic">
            We don't sell your information. Please refer to our{" "}
            <a href="/privacy" className="text-accent underline underline-offset-2">
              Privacy Policy
            </a>{" "}
            for more information.
          </p>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <button
            disabled={busy}
            className="px-5 py-2.5 bg-primary text-primary-foreground text-xs uppercase tracking-[0.2em] hover:bg-accent transition disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save & Continue"}
          </button>
        </form>
      )}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 shrink-0">
      <path
        fill="#4285F4"
        d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.4Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.98-.9 6.63-2.36l-3.24-2.54c-.9.6-2.05.96-3.39.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.62A10 10 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.39 13.93A6.02 6.02 0 0 1 6.08 12c0-.67.12-1.32.31-1.93V7.45H3.04A10 10 0 0 0 2 12c0 1.61.39 3.14 1.04 4.55l3.35-2.62Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.94c1.47 0 2.79.5 3.83 1.5l2.87-2.88A9.62 9.62 0 0 0 12 2a10 10 0 0 0-8.96 5.45l3.35 2.62C7.18 7.7 9.39 5.94 12 5.94Z"
      />
    </svg>
  );
}

function FieldRow({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="block text-xs uppercase tracking-[0.2em] text-accent mb-1">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        placeholder={placeholder}
        className="w-full border border-border bg-background px-3 py-2 text-sm"
      />
    </div>
  );
}

function SubmissionTracker({ email }: { email: string }) {
  const [rows, setRows] = useState<Submission[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await supabase
        .from("submissions")
        .select("id, manuscript_name, status, decision, updated_at")
        .order("updated_at", { ascending: false });
      if (!active) return;
      if (error) setError(error.message);
      else setRows((data ?? []) as Submission[]);
    })();
    return () => {
      active = false;
    };
  }, [email]);

  if (!rows?.length) return null;

  return (
    <div className="mt-14 border-t-2 border-primary pt-8">
      <p className="text-[10px] uppercase tracking-[0.35em] text-accent">Additional Records</p>
      <h3 className="font-serif text-3xl text-primary mt-2">Editor-tracked manuscripts</h3>
      <p className="mt-3 text-muted-foreground text-sm">
        Live status of every manuscript tied to <span className="text-accent">{email}</span>.
      </p>

      {error && <p className="mt-4 text-xs text-destructive">{error}</p>}

      {rows.length > 0 && (
        <ul className="mt-6 space-y-3">
          {rows.map((r) => (
            <li key={r.id} className="border border-border bg-card p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-serif text-lg text-primary">{r.manuscript_name}</p>
                <DecisionBadge decision={r.decision} />
              </div>
              <p className="mt-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Status: <span className="text-accent">{r.status}</span>
              </p>
              {r.decision === "declined" && (
                <p className="mt-2 text-xs text-muted-foreground italic">
                  (If you would like to appeal, please email{" "}
                  <a
                    href="mailto:NYRJINFO@gmail.com"
                    className="text-primary underline underline-offset-2"
                  >
                    NYRJINFO@gmail.com
                  </a>
                  )
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DecisionBadge({ decision }: { decision: DecisionVal }) {
  const styles =
    decision === "accepted"
      ? "bg-accent text-accent-foreground"
      : decision === "declined"
        ? "bg-destructive text-destructive-foreground"
        : "bg-muted text-muted-foreground";
  return (
    <span className={`px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] ${styles}`}>
      {decision}
    </span>
  );
}
