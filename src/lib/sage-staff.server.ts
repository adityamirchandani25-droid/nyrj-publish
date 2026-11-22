import { supabaseAdmin as db } from "@/integrations/supabase/client.server";
import { allRows, reviewOverview } from "./review-workflow.server";
import { staffQuestionIntent } from "./sage-intent";

function list(label: string, rows: string[]) {
  return `${label}: ${rows.length}.${
    rows.length
      ? "\n" +
        rows
          .slice(0, 40)
          .map((r) => `• ${r}`)
          .join("\n")
      : ""
  }${rows.length > 40 ? "\nShowing the first 40; open the dashboard for all records." : ""}`;
}

// Staff operational answers are derived directly from live rows. No model is
// given private records, asked to infer a status, or allowed to execute SQL.
export async function answerStaffQuestion(messages: string[]) {
  const question = messages.at(-1) ?? "";
  const previousQuestion = messages.at(-3) ?? "";
  const papers = await reviewOverview();
  const q = question.toLowerCase();
  const intent = staffQuestionIntent(question, previousQuestion);
  const active = papers.filter((p) => p.reviewStatus !== "completed");
  const paperLine = (p: (typeof papers)[number]) =>
    `${p.title} — ${p.current_version > 1 ? `New revision v${p.current_version} · ` : ""}${p.status}; decision: ${p.decision}${p.libraryOnly ? " (published library record)" : p.legacy ? " (legacy tracking record)" : ""}${p.published && !p.libraryOnly ? " (published in library)" : ""}${p.deleted_at ? " (in trash)" : ""}${p.current_version > 1 && !p.legacy ? ` · [Open latest submission](/admin/submissions?review=${p.id})` : ""}`;
  const quoted = question.match(/["“](.+?)["”]/)?.[1]?.toLowerCase();
  const matches = papers.filter((p) =>
    quoted
      ? p.title.toLowerCase().includes(quoted)
      : p.title.length > 3 && q.includes(p.title.toLowerCase()),
  );
  let reply: string;
  if (/^what about (those|them)\??$/i.test(question.trim())) {
    reply = `I can follow up on ${intent === "emails" ? "failed, accepted, or pending emails" : intent === "reviewers" ? "overdue reviewers or a specific paper" : "a specific record"}. Which part do you mean?`;
  } else if (matches.length) {
    reply = matches
      .map(
        (p) =>
          `${paperLine(p)}\n${p.assignments.map((a) => `${a.reviewer_name || a.reviewer_email}: ${a.status}`).join("\n") || "No peer reviewer assignments recorded."}${p.revision_reminders_paused ? "\nResubmission reminders are paused." : ""}`,
      )
      .join("\n\n");
  } else if (/status|paper (called|named)/.test(q) && !/(all|submissions|papers)/.test(q)) {
    reply =
      "I could not identify that paper. Put its title (or part of the title) in quotation marks so I can check the record.";
  } else if (intent === "counts") {
    reply = `${papers.length} papers are recorded, including historical records; ${active.length} are active. ${active.flatMap((p) => p.assignments.filter((a) => ["invited", "accepted", "no_response"].includes(a.status))).length} reviewer assignments are awaiting feedback.`;
  } else if (intent === "resubmissions") {
    reply = list(
      "Papers awaiting author resubmission",
      papers.filter((p) => p.reviewStatus === "awaiting resubmission").map(paperLine),
    );
  } else if (intent === "reviewers") {
    const overdueOnly = /overdue|late|past due/.test(q);
    reply = list(
      overdueOnly
        ? "Overdue reviewer assignments without submitted feedback"
        : "Reviewer assignments without submitted feedback",
      active.flatMap((p) =>
        p.assignments
          .filter(
            (a) =>
              ["invited", "accepted", "no_response"].includes(a.status) &&
              (!overdueOnly || (a.due_at && Date.parse(a.due_at) < Date.now())),
          )
          .map(
            (a) =>
              `${a.reviewer_name || a.reviewer_email} — ${p.title} (${a.status}${a.due_at ? `; due ${a.due_at.slice(0, 10)}` : ""})`,
          ),
      ),
    );
  } else if (intent === "approvals") {
    const [reviewers, editors, recommendations] = await Promise.all([
      allRows((a, b) =>
        db
          .from("peer_reviewers")
          .select("id,name,email")
          .eq("status", "pending")
          .order("id")
          .range(a, b),
      ),
      allRows((a, b) =>
        db
          .from("editor_accounts")
          .select("id,name,email")
          .eq("status", "pending")
          .order("id")
          .range(a, b),
      ),
      allRows((a, b) =>
        db
          .from("editor_recommendations")
          .select("id,submission_id,action,status")
          .eq("status", "pending")
          .order("id")
          .range(a, b),
      ),
    ]);
    reply = [
      list(
        "Reviewer account requests",
        reviewers.map((r) => `${r.name} (${r.email})`),
      ),
      list(
        "Editor account requests",
        editors.map((r) => `${r.name} (${r.email})`),
      ),
      list(
        "Editorial recommendations needing approval",
        recommendations.map(
          (r) =>
            `${papers.find((p) => p.id === r.submission_id)?.title || r.submission_id} — ${r.action}`,
        ),
      ),
      list(
        "Peer reviews ready for staff approval and sending",
        active.flatMap((p) =>
          p.assignments
            .filter((a) => a.status === "review_received")
            .map((a) => `${p.title} — ${a.reviewer_name || a.reviewer_email}`),
        ),
      ),
    ].join("\n\n");
  } else if (intent === "emails") {
    const [mail, notifications] = await Promise.all([
      allRows((a, b) =>
        db
          .from("sent_emails")
          .select("id,to_email,subject,status,created_at")
          .order("created_at", { ascending: false })
          .order("id")
          .range(a, b),
      ),
      allRows((a, b) =>
        db
          .from("review_staff_notifications")
          .select("id,recipient,status,sent_at")
          .order("id")
          .range(a, b),
      ),
    ]);
    const failuresOnly = /fail|reject|bounce/.test(q);
    reply =
      `Email log: ${mail.filter((m) => m.status === "sent").length} accepted by the email service; ${mail.filter((m) => m.status === "failed").length} failed. Acceptance does not confirm inbox delivery.\n\n` +
      list(
        "Peer review notifications needing attention",
        notifications.filter((n) => n.status !== "sent").map((n) => `${n.recipient} — ${n.status}`),
      ) +
      `\n\nRecent ${failuresOnly ? "failed " : ""}email records:\n` +
      mail
        .filter((m) => !failuresOnly || m.status === "failed")
        .slice(0, 10)
        .map((m) => `• ${m.subject} → ${m.to_email}: ${m.status} (${m.created_at})`)
        .join("\n");
  } else {
    reply = `I don't have enough information to answer “${question.slice(0, 180)}” from journal records. I can check approval requests, reviewer feedback, resubmissions, email logs, or a paper title in quotation marks. For a policy or general research question, exit staff mode and ask Sage again.`;
  }
  return {
    reply: `Checked live data at ${new Date().toISOString()}.\n\n${reply}\n\n→ [Staff dashboard](/admin/submissions)`,
  };
}
