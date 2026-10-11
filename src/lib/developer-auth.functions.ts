import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const PasswordSchema = z.object({ password: z.string().min(1).max(500) });
const TokenSchema = z.object({ token: z.string().min(1).max(300) });

export const developerLogin = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => PasswordSchema.parse(data))
  .handler(async ({ data }) => {
    const { checkDeveloperPassword, issueDeveloperToken } = await import("./developer-auth.server");
    if (!checkDeveloperPassword(data.password)) {
      const { enforceRateLimit } = await import("./rate-limit.server");
      await enforceRateLimit({ scope: "developer-login", limit: 5, windowSeconds: 10 * 60 });
      throw new Error("Incorrect developer password.");
    }
    return issueDeveloperToken("tools");
  });

export const verifyDeveloperAccess = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => TokenSchema.parse(data))
  .handler(async ({ data }) => {
    const { verifyDeveloperToken } = await import("./developer-auth.server");
    verifyDeveloperToken(data.token, "tools");
    return { authorized: true };
  });

const CodeSchema = z.object({ text: z.string().min(1).max(500) });

export const verifyDeveloperCode = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => CodeSchema.parse(data))
  .handler(async ({ data }) => {
    const { checkDeveloperPassword } = await import("./developer-auth.server");
    if (!checkDeveloperPassword(data.text)) {
      const { enforceRateLimit } = await import("./rate-limit.server");
      await enforceRateLimit({ scope: "developer-code", limit: 10, windowSeconds: 10 * 60 });
      return { matched: false as const };
    }
    return { matched: true as const };
  });
