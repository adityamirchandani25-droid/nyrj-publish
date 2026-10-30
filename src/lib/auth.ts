// Auth for NYRJ.
// - "researcher" sessions are backed by Supabase email/password auth (real accounts).
// - "staff" sessions are issued by the server: the typed password is sent to a
//   server function that verifies it against process.env.STAFF_PASSWORD and
//   returns a signed, expiring token. The password itself never lives in the
//   client bundle and is never stored in the browser.
// These login types share the same Session type so the existing UI keeps working.

import { supabase } from "@/integrations/supabase/client";
import { staffLogin } from "@/lib/staff-auth.functions";
import { developerLogin } from "@/lib/developer-auth.functions";

export type Role = "researcher" | "staff" | "ambassador" | "developer";

export type Session = {
  role: Role;
  username: string; // researcher: email. staff/ambassador: display name they entered.
  loggedInAt: number;
  staffToken?: string;
  staffTokenExpiresAt?: number;
  developerToken?: string;
  developerTokenExpiresAt?: number;
  // For ambassador role only: the shared password. Not a secret (user-chosen
  // memorable code); stored so the client can pass it to gated server fns.
  ambassadorPassword?: string;
};

const KEY = "nyrj.session.v1";
const PRODUCTION_AUTH_ORIGIN = "https://nyrj.org";

/**
 * Auth links must always return to the public journal in hosted environments.
 * Using window.location.origin unconditionally lets preview/proxy hosts leak
 * into confirmation emails and makes Supabase fall back to its Site URL when
 * that origin is not allow-listed.
 */
export function authRedirectUrl(path: `/${string}`): string {
  const browserOrigin = typeof window === "undefined" ? null : window.location.origin;
  const browserHost = typeof window === "undefined" ? "" : window.location.hostname;
  const localBrowser = ["localhost", "127.0.0.1", "0.0.0.0"].includes(browserHost);
  return new URL(path, localBrowser && browserOrigin ? browserOrigin : PRODUCTION_AUTH_ORIGIN).href;
}

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
    if (
      (s.role === "staff" && s.staffTokenExpiresAt && Date.now() > s.staffTokenExpiresAt) ||
      (s.role === "developer" &&
        (!s.developerToken || !s.developerTokenExpiresAt || Date.now() > s.developerTokenExpiresAt))
    ) {
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

export async function loginDeveloper(
  password: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { token, expiresAt } = await developerLogin({ data: { password } });
    writeSession({
      role: "developer",
      username: "Developer",
      loggedInAt: Date.now(),
      developerToken: token,
      developerTokenExpiresAt: expiresAt,
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: loginErrorMessage(error, "Developer login failed.") };
  }
}

export function isDeveloper(s: Session | null): boolean {
  return s?.role === "developer";
}

export function developerToken(): string {
  const session = getSession();
  if (!isDeveloper(session) || !session?.developerToken) {
    throw new Error("Developer session expired. Please sign in again.");
  }
  return session.developerToken;
}

export function isResearcher(s: Session | null): boolean {
  return s?.role === "researcher";
}

export function isAmbassador(s: Session | null): boolean {
  return s?.role === "ambassador";
}

// ---- Ambassadors (chapter leads) ----
export async function loginAmbassador(
  email: string,
  password: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!email.trim()) return { ok: false, error: "Email is required." };
  if (!password.trim()) return { ok: false, error: "Password is required." };
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) throw error;
    const { ambassadorLogin } = await import("./ambassadors.functions");
    await ambassadorLogin({ data: {} });
    writeSession({
      role: "ambassador",
      username:
        (typeof data.user.user_metadata?.full_name === "string" &&
          data.user.user_metadata.full_name.trim()) ||
        data.user.email ||
        email.trim().toLowerCase(),
      loggedInAt: Date.now(),
    });
    return { ok: true };
  } catch (err) {
    await supabase.auth.signOut().catch(() => undefined);
    return { ok: false, error: loginErrorMessage(err, "Login failed.") };
  }
}

export async function signUpAmbassador(
  name: string,
  email: string,
  password: string,
  accessCode: string,
): Promise<{ ok: true; existingUser: boolean } | { ok: false; error: string }> {
  try {
    const { createAmbassadorAccount } = await import("./ambassadors.functions");
    const result = await createAmbassadorAccount({ data: { name, email, password, accessCode } });
    return { ok: true, existingUser: result.existingUser };
  } catch (err) {
    return { ok: false, error: loginErrorMessage(err, "Account creation failed.") };
  }
}

/** Legacy credentials are retained only for browser sessions created before individual accounts. */
export function ambassadorCredentials(): { password?: string } {
  const s = getSession();
  if (!s || s.role !== "ambassador") {
    throw new Error("Your ambassador session has expired. Please sign in again.");
  }
  return s.ambassadorPassword ? { password: s.ambassadorPassword } : {};
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
  const emailRedirectTo = authRedirectUrl("/login?account=student");
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

export async function signInStudentWithGoogle() {
  if (typeof window === "undefined")
    throw new Error("Google sign-in is only available in a browser.");
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: authRedirectUrl("/login?account=student"),
    },
  });
  if (error) throw error;
  return data;
}

export async function resendStudentConfirmation(email: string) {
  const normalized = email.trim().toLowerCase();
  const emailRedirectTo = authRedirectUrl("/login?account=student");
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
  if (current?.role === "researcher" || current?.role === "ambassador") {
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

  const ensureProfile = async (user: {
    id: string;
    email?: string;
    user_metadata?: Record<string, unknown>;
  }) => {
    if (!user.email) return;
    const metadataName = user.user_metadata?.full_name ?? user.user_metadata?.name;
    const fullName = typeof metadataName === "string" ? metadataName.trim() : "";
    const { error } = await supabase.from("profiles").upsert(
      {
        id: user.id,
        email: user.email,
        full_name: fullName || null,
      },
      { onConflict: "id", ignoreDuplicates: true },
    );
    if (error) console.error("[auth] Failed to create researcher profile:", error.message);
  };

  const apply = async (
    user:
      { id: string; email?: string; user_metadata?: Record<string, unknown> } | null | undefined,
  ) => {
    const current = getSession();
    if (user?.email) {
      // Don't overwrite one of the app's separate privileged/shared sessions.
      if (
        current?.role === "staff" ||
        current?.role === "ambassador" ||
        current?.role === "developer"
      )
        return;
      await ensureProfile(user);
      if (
        getSession()?.role === "staff" ||
        getSession()?.role === "ambassador" ||
        getSession()?.role === "developer"
      )
        return;
      if (current?.role === "researcher" && current.username === user.email) return;
      writeSession({ role: "researcher", username: user.email, loggedInAt: Date.now() });
    } else if (current?.role === "researcher") {
      writeSession(null);
    }
  };

  supabase.auth.getSession().then(({ data }) => {
    void apply(data.session?.user);
  });

  supabase.auth.onAuthStateChange((_event, session) => {
    void apply(session?.user);
  });
}
