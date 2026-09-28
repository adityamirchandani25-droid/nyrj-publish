import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const StatusEnum = z.enum([
  "initial review",
  "editorial review",
  "waiting for edits",
  "secondary review",
  "publishing",
  "published",
]);
const DecisionEnum = z.enum(["pending", "accepted", "declined"]);

const UpsertSchema = z.object({
  staffToken: z.string().min(1),
  studentEmail: z.string().trim().email().max(255),
  manuscriptName: z.string().trim().min(1).max(255),
  status: StatusEnum,
  decision: DecisionEnum,
});

export type SubmissionRow = {
  id: string;
  student_email: string;
  manuscript_name: string;
  status: z.infer<typeof StatusEnum>;
  decision: z.infer<typeof DecisionEnum>;
  created_at: string;
  updated_at: string;
};

export const editorUpsertSubmission = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => UpsertSchema.parse(d))
  .handler(async ({ data }) => {
    const { verifyStaffToken } = await import("./staff-auth.server");
    verifyStaffToken(data.staffToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("submissions")
      .upsert(
        {
          student_email: data.studentEmail.toLowerCase(),
          manuscript_name: data.manuscriptName,
          status: data.status,
          decision: data.decision,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "student_email,manuscript_name" },
      )
      .select()
      .single();
    if (error) {
      console.error("[server] supabase error:", error);
      throw new Error("An unexpected error occurred. Please try again.");
    }
    return row as SubmissionRow;
  });

const LookupSchema = z.object({
  staffToken: z.string().min(1),
  studentEmail: z.string().trim().email().max(255),
});

export const editorListByEmail = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => LookupSchema.parse(d))
  .handler(async ({ data }) => {
    const { verifyStaffToken } = await import("./staff-auth.server");
    verifyStaffToken(data.staffToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("submissions")
      .select("*")
      .eq("student_email", data.studentEmail.trim().toLowerCase())
      .order("updated_at", { ascending: false });
    if (error) {
      console.error("[server] supabase error:", error);
      throw new Error("An unexpected error occurred. Please try again.");
    }
    return (rows ?? []) as SubmissionRow[];
  });

const DeleteSchema = z.object({
  staffToken: z.string().min(1),
  id: z.string().uuid(),
});

export const editorDeleteSubmission = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => DeleteSchema.parse(d))
  .handler(async ({ data }) => {
    const { verifyStaffToken } = await import("./staff-auth.server");
    verifyStaffToken(data.staffToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("submissions").delete().eq("id", data.id);
    if (error) {
      console.error("[server] supabase error:", error);
      throw new Error("An unexpected error occurred. Please try again.");
    }
    return { ok: true as const };
  });
