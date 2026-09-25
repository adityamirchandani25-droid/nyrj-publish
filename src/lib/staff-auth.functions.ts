import { createServerFn } from "@tanstack/react-start";
import { getRequestIP, getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

const LoginSchema = z.object({
  password: z.string().min(1).max(500),
});

// Simple in-memory rate limiter: 5 attempts per IP per 10 minutes.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const attempts = new Map<string, { count: number; firstAt: number }>();

function checkRateLimit(ip: string) {
  const now = Date.now();
  const rec = attempts.get(ip);
  if (!rec || now - rec.firstAt > WINDOW_MS) {
    attempts.set(ip, { count: 1, firstAt: now });
    return;
  }
  rec.count += 1;
  if (rec.count > MAX_ATTEMPTS) {
    throw new Error("Too many login attempts. Please try again later.");
  }
}

function recordSuccess(ip: string) {
  attempts.delete(ip);
}


export const staffLogin = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => LoginSchema.parse(d))
  .handler(async ({ data }) => {
    const ip =
      getRequestIP({ xForwardedFor: true }) ??
      getRequestHeader("cf-connecting-ip") ??
      "unknown";
    checkRateLimit(ip);

    const { checkStaffPassword, issueStaffToken } = await import("./staff-auth.server");
    if (!checkStaffPassword(data.password)) {
      throw new Error("Incorrect staff password.");
    }
    recordSuccess(ip);
    return issueStaffToken();
  });
