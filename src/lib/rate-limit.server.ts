import { createHmac } from "node:crypto";
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";

export type RateLimitOptions = {
  /** Stable, code-owned bucket name such as `staff-login`. */
  scope: string;
  /** Maximum requests allowed during the fixed window. */
  limit: number;
  /** Fixed-window duration in seconds. */
  windowSeconds: number;
  /** Optional account/token/email identity. Defaults to the request IP. */
  identity?: string;
};

function requestIp(): string {
  const raw =
    getRequestIP({ xForwardedFor: true }) ??
    getRequestHeader("x-real-ip") ??
    getRequestHeader("cf-connecting-ip") ??
    "unknown";
  return raw.split(",")[0]?.trim().slice(0, 128) || "unknown";
}

function rateLimitSecret(): string {
  const secret = process.env.RATE_LIMIT_SECRET?.trim() || process.env.STAFF_PASSWORD?.trim();
  if (!secret) throw new Error("Server rate limiting is not configured.");
  return secret;
}

function identityHash(identity: string): string {
  return createHmac("sha256", rateLimitSecret()).update(identity).digest("hex");
}

function waitMessage(seconds: number): string {
  if (seconds < 60) return `Please try again in ${Math.max(1, seconds)} seconds.`;
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return `Please try again in about ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}

/**
 * Consumes a durable quota stored in Postgres. The identity is HMACed before
 * storage, so the limiter never persists raw IPs, emails, user IDs, or tokens.
 * It deliberately fails closed if the shared limiter is unavailable.
 */
export async function enforceRateLimit(options: RateLimitOptions): Promise<void> {
  const identity = options.identity?.trim()
    ? `identity:${options.identity.trim().slice(0, 500)}`
    : `ip:${requestIp()}`;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("consume_api_rate_limit", {
    p_scope: options.scope,
    p_identity_hash: identityHash(identity),
    p_limit: options.limit,
    p_window_seconds: options.windowSeconds,
  });
  if (error) {
    console.error(`[rate-limit] ${options.scope} failed:`, error);
    throw new Error("This service is temporarily unavailable. Please try again shortly.");
  }
  const result = data?.[0];
  if (!result?.allowed) {
    throw new Error(
      `Too many requests. ${waitMessage(result?.retry_after_seconds ?? options.windowSeconds)}`,
    );
  }
}
