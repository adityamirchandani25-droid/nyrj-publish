import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { CitationBundle } from "./citation-formats";

export const generateArticleCitations = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }): Promise<CitationBundle> => {
    const { enforceRateLimit } = await import("./rate-limit.server");
    await enforceRateLimit({ scope: "citation-generate", limit: 60, windowSeconds: 60 * 60 });
    const { getArticleCitations } = await import("./citation-generator.server");
    return getArticleCitations(data.id);
  });
