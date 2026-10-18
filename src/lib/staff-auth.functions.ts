import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const LoginSchema = z.object({
  password: z.string().min(1).max(500),
});

export const staffLogin = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => LoginSchema.parse(d))
  .handler(async ({ data }) => {
    // Editorial staff often share a school or office IP. Keep a bounded
    // brute-force guard without locking out the whole team after five logins.
    const { enforceRateLimit } = await import("./rate-limit.server");
    await enforceRateLimit({ scope: "staff-login", limit: 20, windowSeconds: 10 * 60 });

    const { checkStaffPassword, issueStaffToken } = await import("./staff-auth.server");
    if (!checkStaffPassword(data.password)) {
      throw new Error("Incorrect staff password.");
    }
    return issueStaffToken();
  });
