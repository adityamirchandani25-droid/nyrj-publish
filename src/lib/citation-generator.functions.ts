import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { CitationBundle } from "./citation-formats";

export const generateArticleCitations = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }): Promise<CitationBundle> => {
    const { getArticleCitations } = await import("./citation-generator.server");
    return getArticleCitations(data.id);
  });
