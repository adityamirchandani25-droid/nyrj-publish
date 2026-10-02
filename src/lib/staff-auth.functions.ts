import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const LoginSchema = z.object({
  password: z.string().min(1).max(500),
});

export const staffLogin = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => LoginSchema.parse(d))
  .handler(async ({ data }) => {
    const { enforceRateLimit } = await import("./rate-limit.server");
    await enforceRateLimit({ scope: "staff-login", limit: 5, windowSeconds: 10 * 60 });

    const { checkStaffPassword, issueStaffToken } = await import("./staff-auth.server");
    if (!checkStaffPassword(data.password)) {
      throw new Error("Incorrect staff password.");
    }
    return issueStaffToken();
  });
