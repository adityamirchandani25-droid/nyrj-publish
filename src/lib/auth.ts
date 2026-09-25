// Auth for NYRJ.
// - "researcher" sessions are backed by Supabase email/password auth (real accounts).
// - "staff" sessions are issued by the server: the typed password is sent to a
//   server function that verifies it against process.env.STAFF_PASSWORD and
//   returns a signed, expiring token. The password itself never lives in the
//   client bundle and is never stored in the browser.
// Both surface through the same Session type so the existing UI keeps working.

import { supabase } from "@/integrations/supabase/client";
import { staffLogin } from "@/lib/staff-auth.functions";

export type Role = "researcher" | "staff" | "ambassador";

export type Session = {
  role: Role;
  username: string; // researcher: email. staff/ambassador: display name they entered.
  loggedInAt: number;
  staffToken?: string;
  staffTokenExpiresAt?: number;
  // For ambassador role only: the shared password. Not a secret (user-chosen
  // memorable code); stored so the client can pass it to gated server fns.
  ambassadorPassword?: string;
};

const KEY = "nyrj.session.v1";

// Service outages should never be reported to a person as a wrong password.
const OUTAGE_MESSAGE =
  "Our sign-in service is temporarily unreachable. Please try again in a few minutes.";

function loginErrorMessage(err: unknown, fallback: string): string {
  const msg = err instanceof Error ? err.message : fallback;
  if (
    /failed to fetch|network|load failed|fetch failed|timeout|timed out|50[234]|unavailable|unexpected error occurred/i.test(
      msg,
    )
  ) {
    return OUTAGE_MESSAGE;
  }
  return msg;
}

type Listener = (s: Session | null) => void;
const listeners = new Set<Listener>();

export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    // Auto-expire staff sessions whose signed token has elapsed.
    if (s.role === "staff" && s.staffTokenExpiresAt && Date.now() > s.staffTokenExpiresAt) {
      window.localStorage.removeItem(KEY);
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

function writeSession(s: Session | null) {
  if (typeof window === "undefined") return;
  if (s) window.localStorage.setItem(KEY, JSON.stringify(s));
  else window.localStorage.removeItem(KEY);
  listeners.forEach((l) => l(s));
}

export function onAuthChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// ---- Staff (editors) ----
export async function loginStaff(
  username: string,
  password: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!username.trim()) return { ok: false, error: "Username is required." };
  try {
    const { token, expiresAt } = await staffLogin({ data: { password } });
    writeSession({
      role: "staff",
      username: username.trim(),
      loggedInAt: Date.now(),
      staffToken: token,
      staffTokenExpiresAt: expiresAt,
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: loginErrorMessage(err, "Login failed.") };
  }
}

export function isStaff(s: Session | null): boolean {
  return s?.role === "staff";
}

export function isResearcher(s: Session | null): boolean {
  return s?.role === "researcher";
}

export function isAmbassador(s: Session | null): boolean {
  return s?.role === "ambassador";
}

// ---- Ambassadors (chapter leads) ----
// The ambassador password is shared and intentionally memorable. The server
// re-validates it on every mutation, so storing it in the session is fine.
export async function loginAmbassador(
  displayName: string,
  password: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!displayName.trim()) return { ok: false, error: "Please enter your name." };
  if (!password.trim()) return { ok: false, error: "Password is required." };
  try {
    // Trial-set the current value to itself; server will reject if pw is wrong.
    const { getStudentsImpacted, setStudentsImpacted } = await import("./ambassadors.functions");
    const current = await getStudentsImpacted();
    await setStudentsImpacted({ data: { password, value: current } });
    writeSession({
      role: "ambassador",
      username: displayName.trim(),
      loggedInAt: Date.now(),
      ambassadorPassword: password,
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: loginErrorMessage(err, "Login failed.") };
  }
}

export function ambassadorPassword(): string {
  const s = getSession();
  if (!s || s.role !== "ambassador" || !s.ambassadorPassword) {
    throw new Error("Your ambassador session has expired. Please sign in again.");
  }
  return s.ambassadorPassword;
}

// Used by editor-only server calls. Returns the signed token issued at login
// (server-validated, time-limited). Throws if there is no active staff session.
export function staffToken(): string {
  const s = getSession();
  if (!s || s.role !== "staff" || !s.staffToken) {
    throw new Error("Your staff session has expired. Please sign in again.");
  }
  return s.staffToken;
}

// ---- Students (researchers) — Email + Password ----
export async function signUpStudent(email: string, password: string, fullName?: string) {
  const emailRedirectTo =
    typeof window === "undefined" ? undefined : `${window.location.origin}/login?account=student`;
  const { data, error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: {
      emailRedirectTo,
      data: fullName?.trim() ? { full_name: fullName.trim() } : undefined,
    },
  });
  if (error) throw error;
  if (data.session && data.user?.email) {
    writeSession({
      role: "researcher",
      username: data.user.email,
      loggedInAt: Date.now(),
    });
  }
  return data;
}

export async function signInStudent(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error) throw error;
  if (data.user?.email) {
    writeSession({
      role: "researcher",
      username: data.user.email,
      loggedInAt: Date.now(),
    });
  }
  return data;
}

export async function resendStudentConfirmation(email: string) {
  const normalized = email.trim().toLowerCase();
  const emailRedirectTo =
    typeof window === "undefined" ? undefined : `${window.location.origin}/login?account=student`;
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: normalized,
    options: { emailRedirectTo },
  });
  if (error) throw error;
}

// ---- Unified logout ----
export async function logout() {
  const current = getSession();
  writeSession(null);
  if (current?.role === "researcher") {
    try {
      await supabase.auth.signOut();
    } catch {
      /* ignore */
    }
  }
}

// ---- Supabase ↔ session bridge ----
// Called once from __root so the localStorage Session mirrors the Supabase user.
let bridged = false;
export function bridgeSupabaseSession() {
  if (bridged || typeof window === "undefined") return;
  bridged = true;

  const apply = (email: string | undefined) => {
    const current = getSession();
    if (email) {
      // Don't overwrite an active staff session.
      if (current?.role === "staff") return;
      if (current?.role === "researcher" && current.username === email) return;
      writeSession({ role: "researcher", username: email, loggedInAt: Date.now() });
    } else if (current?.role === "researcher") {
      writeSession(null);
    }
  };

  supabase.auth.getSession().then(({ data }) => {
    apply(data.session?.user.email ?? undefined);
  });

  supabase.auth.onAuthStateChange((_event, session) => {
    apply(session?.user.email ?? undefined);
  });
}
