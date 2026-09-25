// Editor accounts: a second, individual login alongside the master staff login.
// Editors see the papers assigned to them plus the overall desk, and can send a
// recommendation (accept / decline / formatting changes). Nothing reaches the
// author until staff approve the recommendation.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const SITE_URL = "https://nyrj.org";
const STAFF_RECIPIENTS = ["keyaanmerchant24@gmail.com", "Madhavarora529@gmail.com"];

const StaffSchema = z.object({ staffToken: z.string().min(1) });
const EditorSchema = z.object({ editorToken: z.string().min(1) });

export type EditorAccountRow = {
  id: string;
  name: string;
  email: string;
  username: string;
  status: string;
  created_at: string;
};

export type EditorDeskRow = {
  id: string;
  title: string;
  status: string;
  decision: string;
  created_at: string;
  keywords: string;
  research_domain: string;
  abstract: string | null;
  submitter_email: string;
  manuscript_path: string | null;
  manuscript_filename: string | null;
  initial_reviewer_name: string;
  initial_reviewer_email: string;
  current_version: number;
};

export type RecommendationRow = {
  id: string;
  submission_id: string;
  submission_title: string;
  editor_name: string;
  editor_email: string;
  action: string;
  comments: string;
  status: string;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string;
  staff_message: string;
};

export type VersionRow = {
  id: string;
  submission_id: string;
  version: number;
  manuscript_filename: string;
  manuscript_path: string;
  label: string;
  note: string;
  created_at: string;
};

const DESK_COLS =
  "id, title, status, decision, created_at, keywords, research_domain, abstract, submitter_email, manuscript_path, manuscript_filename, initial_reviewer_name, initial_reviewer_email, current_version";

/* ------------------------------ accounts ---------------------------------- */

export const registerEditor = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        name: z.string().trim().min(1).max(200),
        email: z.string().trim().email().max(255),
        username: z.string().trim().min(3).max(60),
        password: z.string().min(8, "Use at least 8 characters.").max(200),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { hashPassword, newSalt, audit } = await import("./peer-review.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const salt = newSalt();
    const hash = await hashPassword(data.password, salt);
    const { error } = await supabaseAdmin.from("editor_accounts").insert({
      name: data.name,
      email: data.email.toLowerCase(),
      username: data.username.toLowerCase(),
      password_hash: hash,
      password_salt: salt,
      status: "pending",
    } as never);
    if (error) {
      if (error.code === "23505") throw new Error("That email or username is already registered.");
      throw new Error(error.message);
    }
    await audit(null, data.email.toLowerCase(), "Editor account requested", data.name);
    return { ok: true };
  });

export const editorLogin = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({ username: z.string().trim().min(1).max(60), password: z.string().min(1).max(200) })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { verifyPassword } = await import("./peer-review.server");
    const { issueEditorToken } = await import("./editor-auth.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("editor_accounts")
      .select("id, name, email, password_hash, password_salt, status")
      .eq("username", data.username.trim().toLowerCase())
      .maybeSingle();
    const r = row as {
      id: string;
      name: string;
      email: string;
      password_hash: string;
      password_salt: string;
      status: string;
    } | null;
    if (!r) throw new Error("Incorrect username or password.");
    const ok = await verifyPassword(data.password, r.password_salt, r.password_hash);
    if (!ok) throw new Error("Incorrect username or password.");
    if (r.status === "pending")
      throw new Error("Your editor account is awaiting approval by our editorial staff.");
    if (r.status !== "approved") throw new Error("This editor account is not active.");
    const { token, expiresAt } = issueEditorToken(r.id);
    return { token, expiresAt, name: r.name, email: r.email };
  });

export const listEditorAccounts = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => StaffSchema.parse(d))
  .handler(async ({ data }): Promise<EditorAccountRow[]> => {
    const { verifyStaffToken } = await import("./staff-auth.server");
    verifyStaffToken(data.staffToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("editor_accounts")
      .select("id, name, email, username, status, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []) as EditorAccountRow[];
  });

export const setEditorStatus = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    StaffSchema.extend({
      id: z.string().uuid(),
      status: z.enum(["approved", "rejected"]),
      actor: z.string().trim().max(120).optional().default("staff"),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { verifyStaffToken } = await import("./staff-auth.server");
    verifyStaffToken(data.staffToken);
    const { audit } = await import("./peer-review.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row, error } = await supabaseAdmin
      .from("editor_accounts")
      .update({
        status: data.status,
        approved_at: data.status === "approved" ? new Date().toISOString() : null,
      } as never)
      .eq("id", data.id)
      .select("name, email")
      .single();
    if (error) throw new Error(error.message);
    const e = row as { name: string; email: string };

    try {
      const { sendTemplateEmail } = await import("./email-templates/send-email");
      await sendTemplateEmail("editor-account-approved", e.email, {
        idempotencyKey: `editor-account-${data.id}-${data.status}`,
        replyTo: "NYRJINFO@gmail.com",
        templateData: { editorName: e.name, approved: data.status === "approved" },
      });
    } catch (err) {
      console.error("[server] editor account email failed:", err);
    }
    await audit(null, data.actor, `Editor account ${data.status}`, `${e.name} (${e.email})`);
    return { ok: true };
  });

/* -------------------------------- desk ------------------------------------ */

export const editorDesk = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => EditorSchema.parse(d))
  .handler(async ({ data }) => {
    const { requireEditor } = await import("./editor-auth.server");
    const me = await requireEditor(data.editorToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows, error } = await supabaseAdmin
      .from("manuscript_submissions")
      .select(DESK_COLS)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) throw new Error(error.message);
    const all = (rows ?? []) as EditorDeskRow[];
    const mine = all.filter(
      (r) => (r.initial_reviewer_email ?? "").toLowerCase() === me.email.toLowerCase(),
    );

    const { data: recs } = await supabaseAdmin
      .from("editor_recommendations")
      .select("id, submission_id, action, status, comments, created_at, staff_message")
      .eq("editor_email", me.email.toLowerCase())
      .order("created_at", { ascending: false });

    return {
      me,
      assigned: mine,
      all,
      myRecommendations: (recs ?? []) as Array<{
        id: string;
        submission_id: string;
        action: string;
        status: string;
        comments: string;
        created_at: string;
        staff_message: string;
      }>,
    };
  });

export const submitRecommendation = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    EditorSchema.extend({
      submissionId: z.string().uuid(),
      action: z.enum(["accept", "decline", "formatting"]),
      comments: z.string().trim().max(20000).optional().default(""),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { requireEditor } = await import("./editor-auth.server");
    const me = await requireEditor(data.editorToken);
    const { audit } = await import("./peer-review.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.action === "formatting" && !data.comments.trim()) {
      throw new Error("Please write the changes you would like the author to make.");
    }

    const { data: sub } = await supabaseAdmin
      .from("manuscript_submissions")
      .select("id, title, initial_reviewer_email")
      .eq("id", data.submissionId)
      .single();
    const s = sub as { title: string; initial_reviewer_email: string } | null;
    if (!s) throw new Error("Submission not found.");

    // An editor may only recommend on manuscripts assigned to them (or ones
    // nobody has been assigned to yet).
    const assignedTo = (s.initial_reviewer_email ?? "").trim().toLowerCase();
    if (assignedTo && assignedTo !== me.email.toLowerCase()) {
      throw new Error(
        "This manuscript is assigned to another editor, so a recommendation can't be submitted for it.",
      );
    }

    const { error } = await supabaseAdmin.from("editor_recommendations").insert({
      submission_id: data.submissionId,
      editor_name: me.name,
      editor_email: me.email.toLowerCase(),
      action: data.action,
      comments: data.comments,
      status: "pending",
    } as never);
    if (error) throw new Error(error.message);

    try {
      const { sendTemplateEmail } = await import("./email-templates/send-email");
      for (const to of STAFF_RECIPIENTS) {
        await sendTemplateEmail("editor-recommendation", to, {
          idempotencyKey: `editor-rec-${data.submissionId}-${me.id}-${Date.now()}`,
          replyTo: me.email,
          templateData: {
            editorName: me.name,
            editorEmail: me.email,
            title: s.title,
            action: data.action,
            comments: data.comments,
            dashboardUrl: `${SITE_URL}/admin/submissions`,
          },
        });
      }
    } catch (err) {
      console.error("[server] editor recommendation email failed:", err);
    }

    await audit(
      data.submissionId,
      me.email,
      "Editor recommendation submitted",
      `${data.action} — awaiting staff approval`,
    );
    return { ok: true };
  });

/* --------------------------- staff: recommendations ----------------------- */

export const listRecommendations = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => StaffSchema.parse(d))
  .handler(async ({ data }): Promise<RecommendationRow[]> => {
    const { verifyStaffToken } = await import("./staff-auth.server");
    verifyStaffToken(data.staffToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("editor_recommendations")
      .select(
        "id, submission_id, editor_name, editor_email, action, comments, status, created_at, reviewed_at, reviewed_by, staff_message",
      )
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) throw new Error(error.message);
    const list = (rows ?? []) as Omit<RecommendationRow, "submission_title">[];
    const ids = Array.from(new Set(list.map((r) => r.submission_id)));
    const titles = new Map<string, string>();
    if (ids.length) {
      const { data: subs } = await supabaseAdmin
        .from("manuscript_submissions")
        .select("id, title")
        .in("id", ids);
      for (const s of (subs ?? []) as Array<{ id: string; title: string }>) {
        titles.set(s.id, s.title);
      }
    }
    return list.map((r) => ({ ...r, submission_title: titles.get(r.submission_id) ?? "Manuscript" }));
  });

/** Staff approve (and optionally edit) a recommendation. Only now does the author hear anything. */
export const resolveRecommendation = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    StaffSchema.extend({
      id: z.string().uuid(),
      approve: z.boolean(),
      message: z.string().trim().max(20000).optional().default(""),
      reviewedBy: z.string().trim().max(120).optional().default("staff"),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { verifyStaffToken } = await import("./staff-auth.server");
    verifyStaffToken(data.staffToken);
    const { audit } = await import("./peer-review.server");
    const { newResubmitToken } = await import("./editor-auth.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: recRow, error } = await supabaseAdmin
      .from("editor_recommendations")
      .select("id, submission_id, action, comments, status")
      .eq("id", data.id)
      .single();
    if (error || !recRow) throw new Error("Recommendation not found.");
    const rec = recRow as { submission_id: string; action: string; comments: string; status: string };
    if (rec.status !== "pending") throw new Error("This recommendation was already handled.");

    const now = new Date().toISOString();

    if (!data.approve) {
      await supabaseAdmin
        .from("editor_recommendations")
        .update({
          status: "rejected",
          reviewed_at: now,
          reviewed_by: data.reviewedBy,
          staff_message: data.message,
        } as never)
        .eq("id", data.id);
      await audit(rec.submission_id, data.reviewedBy, "Editor recommendation declined by staff", "");
      return { ok: true, emailed: false };
    }

    const { data: subRow } = await supabaseAdmin
      .from("manuscript_submissions")
      .select("id, title, submitter_email, authors, resubmit_token")
      .eq("id", rec.submission_id)
      .single();
    const sub = subRow as {
      title: string;
      submitter_email: string;
      authors: Array<{ name?: string }> | null;
      resubmit_token: string | null;
    } | null;
    if (!sub) throw new Error("Submission not found.");
    const authorName = Array.isArray(sub.authors) ? (sub.authors[0]?.name ?? "there") : "there";
    const body = data.message.trim() || rec.comments;

    let emailed = false;
    if (rec.action === "formatting") {
      const token = sub.resubmit_token ?? newResubmitToken();
      if (!sub.resubmit_token) {
        await supabaseAdmin
          .from("manuscript_submissions")
          .update({ resubmit_token: token } as never)
          .eq("id", rec.submission_id);
      }
      const resubmitUrl = `${SITE_URL}/resubmit?token=${token}`;
      try {
        const { sendTemplateEmail } = await import("./email-templates/send-email");
        await sendTemplateEmail("author-revision-request", sub.submitter_email, {
          idempotencyKey: `author-revision-${data.id}`,
          replyTo: "NYRJINFO@gmail.com",
          templateData: { authorName, title: sub.title, body, resubmitUrl },
        });
        emailed = true;
      } catch (err) {
        console.error("[server] author revision email failed:", err);
      }
      await supabaseAdmin
        .from("manuscript_submissions")
        .update({ status: "waiting for edits" } as never)
        .eq("id", rec.submission_id);
    } else {
      const decision = rec.action === "accept" ? "accepted" : "declined";
      await supabaseAdmin
        .from("manuscript_submissions")
        .update({ decision } as never)
        .eq("id", rec.submission_id);
      try {
        const { sendTemplateEmail } = await import("./email-templates/send-email");
        await sendTemplateEmail("submission-status", sub.submitter_email, {
          idempotencyKey: `status-${rec.submission_id}-${decision}-${data.id}`,
          replyTo: "NYRJINFO@gmail.com",
          templateData: {
            authorName,
            title: sub.title,
            status: decision === "accepted" ? "publishing" : "declined",
            decision,
            note: body,
          },
        });
        emailed = true;
      } catch (err) {
        console.error("[server] decision email failed:", err);
      }
    }

    await supabaseAdmin
      .from("editor_recommendations")
      .update({
        status: "approved",
        reviewed_at: now,
        reviewed_by: data.reviewedBy,
        staff_message: body,
      } as never)
      .eq("id", data.id);

    await audit(
      rec.submission_id,
      data.reviewedBy,
      "Editor recommendation approved and sent to author",
      rec.action,
    );
    return { ok: true, emailed };
  });

/* ----------------------------- version history ---------------------------- */

export const listVersions = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => StaffSchema.extend({ submissionId: z.string().uuid() }).parse(d))
  .handler(async ({ data }): Promise<VersionRow[]> => {
    const { verifyStaffToken } = await import("./staff-auth.server");
    verifyStaffToken(data.staffToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("manuscript_versions")
      .select("id, submission_id, version, manuscript_filename, manuscript_path, label, note, created_at")
      .eq("submission_id", data.submissionId)
      .order("version", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []) as VersionRow[];
  });

/* ------------------------- author resubmission ---------------------------- */

const ResubmitToken = z.object({ token: z.string().trim().min(10).max(200) });

async function submissionForToken(token: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("manuscript_submissions")
    .select("id, title, submitter_email, current_version, status, authors")
    .eq("resubmit_token", token)
    .is("deleted_at", null)
    .maybeSingle();
  const row = data as {
    id: string;
    title: string;
    submitter_email: string;
    current_version: number;
    status: string;
    authors: Array<{ name?: string }> | null;
  } | null;
  if (!row) throw new Error("This upload link is no longer valid. Please reply to our email.");
  return row;
}

export const getResubmitInfo = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => ResubmitToken.parse(d))
  .handler(async ({ data }) => {
    const row = await submissionForToken(data.token);
    return { title: row.title, version: row.current_version, status: row.status };
  });

/** Signed upload URL so the browser can send the file straight to storage. */
export const createRevisionUpload = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    ResubmitToken.extend({ filename: z.string().trim().min(1).max(260) }).parse(d),
  )
  .handler(async ({ data }) => {
    const row = await submissionForToken(data.token);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const safe = data.filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
    const path = `revisions/${row.id}/v${row.current_version + 1}-${Date.now()}-${safe}`;
    const { data: signed, error } = await supabaseAdmin.storage
      .from("submissions")
      .createSignedUploadUrl(path);
    if (error || !signed) throw new Error(error?.message ?? "Could not prepare the upload.");
    return { path, token: signed.token, signedUrl: signed.signedUrl };
  });

export const finalizeRevision = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    ResubmitToken.extend({
      path: z.string().trim().min(1).max(500),
      filename: z.string().trim().min(1).max(260),
      note: z.string().trim().max(5000).optional().default(""),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const row = await submissionForToken(data.token);
    const { audit } = await import("./peer-review.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const nextVersion = (row.current_version ?? 1) + 1;
    const { error } = await supabaseAdmin.from("manuscript_versions").insert({
      submission_id: row.id,
      version: nextVersion,
      manuscript_path: data.path,
      manuscript_filename: data.filename,
      label: "After edits",
      note: data.note,
    } as never);
    if (error) throw new Error(error.message);

    await supabaseAdmin
      .from("manuscript_submissions")
      .update({
        manuscript_path: data.path,
        manuscript_filename: data.filename,
        current_version: nextVersion,
        status: "secondary review",
      } as never)
      .eq("id", row.id);

    try {
      const { sendTemplateEmail } = await import("./email-templates/send-email");
      for (const to of STAFF_RECIPIENTS) {
        await sendTemplateEmail("revision-received", to, {
          idempotencyKey: `revision-staff-${row.id}-v${nextVersion}-${to}`,
          replyTo: row.submitter_email,
          templateData: {
            title: row.title,
            version: nextVersion,
            submitterEmail: row.submitter_email,
            toAuthor: false,
            note: data.note,
          },
        });
      }
      await sendTemplateEmail("revision-received", row.submitter_email, {
        idempotencyKey: `revision-author-${row.id}-v${nextVersion}`,
        replyTo: "NYRJINFO@gmail.com",
        templateData: {
          title: row.title,
          version: nextVersion,
          submitterEmail: row.submitter_email,
          toAuthor: true,
          note: "",
        },
      });
    } catch (err) {
      console.error("[server] revision emails failed:", err);
    }

    await audit(row.id, row.submitter_email, "Revised manuscript uploaded", `Version ${nextVersion}`);
    return { ok: true, version: nextVersion };
  });
