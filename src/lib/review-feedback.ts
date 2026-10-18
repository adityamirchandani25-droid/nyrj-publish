import { z } from "zod";
export const reviewFeedbackSchema = z
  .object({
    comments: z.string().trim().max(20000).default(""),
    filePath: z.string().max(500).optional(),
    fileName: z.string().trim().max(255).optional(),
  })
  .refine(
    (v) => Boolean(v.comments || (v.filePath && v.fileName)),
    "Write comments or upload an annotated paper (or both).",
  )
  .refine(
    (v) => Boolean(v.filePath) === Boolean(v.fileName),
    "The review attachment is incomplete.",
  );
