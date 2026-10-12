/** Imports replies received at the journal Gmail address into the peer review panel. */
type GmailPart = {
  mimeType?: string;
  filename?: string;
  body?: { data?: string; attachmentId?: string; size?: number };
  parts?: GmailPart[];
  headers?: Array<{ name: string; value: string }>;
};
type GmailMessage = {
  id: string;
  internalDate?: string;
  snippet?: string;
  payload?: GmailPart;
};
type Assignment = {
  id: string;
  submission_id: string;
  reviewer_email: string;
  assigned_at: string;
};
type StoredAttachment = { name: string; path: string };

const MAILBOX = "NYRJINFO@gmail.com";
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;
const ALLOWED_MIMES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "text/plain",
]);

export function gmailReviewSyncConfigured(): boolean {
  return Boolean(
    process.env.GMAIL_CLIENT_ID &&
    process.env.GMAIL_CLIENT_SECRET &&
    process.env.GMAIL_REFRESH_TOKEN,
  );
}

function decodeBase64Url(value: string): Buffer {
  return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function partsOf(part: GmailPart | undefined): GmailPart[] {
  if (!part) return [];
  return [part, ...(part.parts ?? []).flatMap(partsOf)];
}

function header(part: GmailPart | undefined, name: string): string {
  return part?.headers?.find((item) => item.name.toLowerCase() === name)?.value ?? "";
}

function senderAddress(raw: string): string {
  const address = raw.match(/<([^<>@\s]+@[^<>@\s]+)>/)?.[1] ?? raw.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address) ? address.toLowerCase() : "";
}

function findAssignment(
  sender: string,
  subject: string,
  receivedAt: number,
  assignments: Assignment[],
  titles: Map<string, string>,
): Assignment | null {
  const available = assignments.filter(
    (row) =>
      row.reviewer_email.trim().toLowerCase() === sender &&
      Date.parse(row.assigned_at) <= receivedAt,
  );
  const taggedId = subject.match(/\[NYRJ Review ([0-9a-f-]{36})\]/i)?.[1]?.toLowerCase();
  if (taggedId) return available.find((row) => row.id.toLowerCase() === taggedId) ?? null;
  const byTitle = available.filter((row) => {
    const title = titles.get(row.submission_id)?.trim().toLowerCase();
    return title && subject.toLowerCase().includes(title);
  });
  if (byTitle.length === 1) return byTitle[0];
  return available.length === 1 ? available[0] : null;
}

async function accessToken(): Promise<string> {
  const body = new URLSearchParams({
    client_id: process.env.GMAIL_CLIENT_ID ?? "",
    client_secret: process.env.GMAIL_CLIENT_SECRET ?? "",
    refresh_token: process.env.GMAIL_REFRESH_TOKEN ?? "",
    grant_type: "refresh_token",
  });
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Gmail OAuth refresh failed (${response.status})`);
  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("Gmail OAuth did not return an access token");
  return data.access_token;
}

async function gmailGet<T>(url: URL, token: string): Promise<T> {
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${token}`, accept: "application/json" },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Gmail API request failed (${response.status})`);
  return (await response.json()) as T;
}

export async function syncGmailReviewReplies(): Promise<{
  checked: number;
  imported: number;
  unmatched: number;
  configured: boolean;
}> {
  if (!gmailReviewSyncConfigured())
    return { checked: 0, imported: 0, unmatched: 0, configured: false };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { audit } = await import("./peer-review.server");
  const token = await accessToken();
  const profile = await gmailGet<{ emailAddress?: string }>(
    new URL("https://gmail.googleapis.com/gmail/v1/users/me/profile"),
    token,
  );
  if (profile.emailAddress?.toLowerCase() !== MAILBOX.toLowerCase()) {
    throw new Error("Gmail sync credentials do not belong to the journal mailbox");
  }

  const { data: assignmentRows, error: assignmentError } = await supabaseAdmin
    .from("review_assignments")
    .select("id, submission_id, reviewer_email, assigned_at")
    .order("assigned_at", { ascending: false })
    .limit(2000);
  if (assignmentError) throw new Error(assignmentError.message);
  const assignments = (assignmentRows ?? []) as Assignment[];
  const submissionIds = [...new Set(assignments.map((row) => row.submission_id))];
  const titles = new Map<string, string>();
  for (let start = 0; start < submissionIds.length; start += 500) {
    const { data, error } = await supabaseAdmin
      .from("manuscript_submissions")
      .select("id, title")
      .in("id", submissionIds.slice(start, start + 500));
    if (error) throw new Error(error.message);
    for (const item of data ?? []) titles.set(item.id, item.title);
  }

  const ids: string[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < 3; page++) {
    const url = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages");
    url.searchParams.set("q", `to:${MAILBOX} newer_than:30d -in:spam -in:trash`);
    url.searchParams.set("maxResults", "100");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const result = await gmailGet<{ messages?: Array<{ id: string }>; nextPageToken?: string }>(
      url,
      token,
    );
    ids.push(...(result.messages ?? []).map((message) => message.id));
    pageToken = result.nextPageToken;
    if (!pageToken) break;
  }
  const importedIds = new Set<string>();
  for (let start = 0; start < ids.length; start += 100) {
    const { data, error } = await supabaseAdmin
      .from("peer_review_email_replies")
      .select("gmail_message_id")
      .in("gmail_message_id", ids.slice(start, start + 100));
    if (error) throw new Error(error.message);
    for (const row of data ?? []) importedIds.add(row.gmail_message_id);
  }

  let checked = 0;
  let imported = 0;
  let unmatched = 0;
  const importOne = async (id: string) => {
    try {
      const url = new URL(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(id)}`,
      );
      url.searchParams.set("format", "full");
      const message = await gmailGet<GmailMessage>(url, token);
      checked++;
      const sender = senderAddress(header(message.payload, "from"));
      if (!sender || sender === MAILBOX.toLowerCase()) return;
      const subject = header(message.payload, "subject").slice(0, 500);
      const receivedAt = Number(message.internalDate);
      if (!Number.isFinite(receivedAt)) return;
      const assignment = findAssignment(sender, subject, receivedAt, assignments, titles);
      if (!assignment) {
        unmatched++;
        return;
      }
      const parts = partsOf(message.payload);
      const plain = parts.find((part) => part.mimeType === "text/plain" && part.body?.data);
      const bodyText = plain?.body?.data
        ? decodeBase64Url(plain.body.data).toString("utf8").slice(0, 30000)
        : (message.snippet ?? "").slice(0, 30000);
      const attachments: StoredAttachment[] = [];
      for (const part of parts) {
        if (!part.filename || !part.body?.attachmentId || !ALLOWED_MIMES.has(part.mimeType ?? ""))
          continue;
        if ((part.body.size ?? 0) > MAX_ATTACHMENT_BYTES) continue;
        const attachmentUrl = new URL(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(id)}/attachments/${encodeURIComponent(part.body.attachmentId)}`,
        );
        const attachment = await gmailGet<{ data?: string; size?: number }>(attachmentUrl, token);
        if (!attachment.data) continue;
        const bytes = decodeBase64Url(attachment.data);
        if (bytes.length > MAX_ATTACHMENT_BYTES) continue;
        const safeName =
          part.filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 180) || "attachment";
        const path = `review-email/${assignment.id}/${id}/${attachments.length}-${safeName}`;
        const { error: uploadError } = await supabaseAdmin.storage
          .from("submissions")
          .upload(path, bytes, { contentType: part.mimeType, upsert: true });
        if (uploadError) throw new Error(uploadError.message);
        attachments.push({ name: part.filename.slice(0, 255), path });
      }
      const { error: insertError } = await supabaseAdmin.from("peer_review_email_replies").insert({
        gmail_message_id: id,
        assignment_id: assignment.id,
        from_email: sender,
        subject,
        body_text: bodyText,
        received_at: new Date(receivedAt).toISOString(),
        attachments,
      } as never);
      if (insertError) {
        if (insertError.code === "23505") return;
        throw new Error(insertError.message);
      }
      imported++;
      await audit(assignment.submission_id, sender, "Reviewer email reply received", subject);
    } catch (error) {
      console.error("[gmail-review-sync] message import failed:", id, error);
    }
  };
  const pendingIds = ids.filter((candidate) => !importedIds.has(candidate));
  for (let start = 0; start < pendingIds.length; start += 10) {
    await Promise.all(pendingIds.slice(start, start + 10).map(importOne));
  }
  return { checked, imported, unmatched, configured: true };
}
