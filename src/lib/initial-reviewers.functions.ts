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
  open_count: number;
  open_papers: Array<{
    id: string;
    title: string;
    status: string;
    created_at: string;
    initial_reviewer_assigned_at: string | null;
  }>;
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

    // `assigned_count` is retained as a lifetime rotation counter. The staff
    // dashboard needs the live workload instead: only undecided, non-deleted
    // papers are ones the journal is still waiting on.
    const { data: papers, error: papersError } = await supabaseAdmin
      .from("manuscript_submissions")
      .select("id, title, status, created_at, initial_reviewer_assigned_at, initial_reviewer_email")
      .is("deleted_at", null)
      .eq("decision", "pending")
      .neq("status", "published")
      .neq("initial_reviewer_email", "")
      .order("created_at", { ascending: true })
      .limit(500);
    if (papersError) throw new Error(papersError.message);

    const byReviewer = new Map<string, InitialReviewerRow["open_papers"]>();
    for (const paper of (papers ?? []) as Array<{
      id: string;
      title: string;
      status: string;
      created_at: string;
      initial_reviewer_assigned_at: string | null;
      initial_reviewer_email: string;
    }>) {
      const key = paper.initial_reviewer_email.trim().toLowerCase();
      const list = byReviewer.get(key) ?? [];
      list.push({
        id: paper.id,
        title: paper.title,
        status: paper.status,
        created_at: paper.created_at,
        initial_reviewer_assigned_at: paper.initial_reviewer_assigned_at,
      });
      byReviewer.set(key, list);
    }

    return (rows ?? []).map((row) => {
      const openPapers = byReviewer.get(row.email.trim().toLowerCase()) ?? [];
      return { ...row, open_count: openPapers.length, open_papers: openPapers };
    }) as InitialReviewerRow[];
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
    const { data: reviewer } = await supabaseAdmin
      .from("initial_reviewers")
      .select("email")
      .eq("id", data.id)
      .maybeSingle();
    if (!reviewer) throw new Error("Reviewer not found.");
    const { count, error: countError } = await supabaseAdmin
      .from("manuscript_submissions")
      .select("id", { count: "exact", head: true })
      .ilike("initial_reviewer_email", reviewer.email)
      .eq("decision", "pending")
      .neq("status", "published")
      .is("deleted_at", null);
    if (countError) throw new Error(countError.message);
    if ((count ?? 0) > 0) {
      throw new Error("Pause this reviewer instead; they still have open papers assigned.");
    }
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
