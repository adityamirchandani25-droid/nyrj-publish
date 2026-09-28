import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const StaffSchema = z.object({ staffToken: z.string().min(1) });

export type InitialReviewerRow = {
  id: string;
  name: string;
  email: string;
  active: boolean;
  portal_enabled: boolean;
  assigned_count: number;
  created_at: string;
};

export const listInitialReviewers = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => StaffSchema.parse(d))
  .handler(async ({ data }): Promise<InitialReviewerRow[]> => {
    const { verifyStaffToken } = await import("./staff-auth.server");
    verifyStaffToken(data.staffToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("initial_reviewers")
      .select("id, name, email, active, portal_enabled, assigned_count, created_at")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []) as InitialReviewerRow[];
  });

export const addInitialReviewer = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    StaffSchema.extend({
      name: z.string().trim().min(1).max(120),
      email: z.string().trim().email().max(255),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { verifyStaffToken } = await import("./staff-auth.server");
    verifyStaffToken(data.staffToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("initial_reviewers")
      .insert({ name: data.name, email: data.email.toLowerCase() } as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setInitialReviewerActive = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    StaffSchema.extend({ id: z.string().uuid(), active: z.boolean() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { verifyStaffToken } = await import("./staff-auth.server");
    verifyStaffToken(data.staffToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("initial_reviewers")
      .update({ active: data.active } as never)
      .eq("id", data.id);
    if (error) {
      console.error("[server] setInitialReviewerActive error:", error);
      throw new Error("Could not update the reviewer. Please try again.");
    }
    return { ok: true };
  });

export const removeInitialReviewer = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => StaffSchema.extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { verifyStaffToken } = await import("./staff-auth.server");
    verifyStaffToken(data.staffToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("initial_reviewers").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Assigns an initial reviewer to every live submission that does not have one
 * yet (oldest first), emails each assignee, and updates the spreadsheet.
 */
export const assignPendingSubmissions = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => StaffSchema.parse(d))
  .handler(async ({ data }) => {
    const { verifyStaffToken } = await import("./staff-auth.server");
    verifyStaffToken(data.staffToken);
    const { sweepInitialAssignments } = await import("./initial-reviewers.server");
    const { assigned, pending } = await sweepInitialAssignments();
    return { assigned, skipped: pending - assigned };
  });
