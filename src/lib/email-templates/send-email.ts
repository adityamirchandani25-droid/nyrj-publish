import * as React from "react";
import { render } from "@react-email/render";
import { TEMPLATES } from "./registry";

// Server-only: reads SENDGRID_API_KEY. Never import from client components.

const SITE_NAME = "National Youth Research Journal";
// Domain authenticated in SendGrid.
const FROM_DOMAIN = "nyrj.org";
const FROM_ADDRESS = `noreply@${FROM_DOMAIN}`;
const SENDGRID_ENDPOINT = "https://api.sendgrid.com/v3/mail/send";
// Keep transactional requests responsive during a provider outage. A second
// attempt covers brief network/429/5xx failures without holding a form open
// for the ~40 seconds the old three-attempt policy could consume.
const SEND_TIMEOUT_MS = 8_000;
const RETRY_DELAYS_MS = [300];
const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;

export type SendTemplateEmailResult =
  { sent: true } | { sent: false; reason: "recipient_suppressed" };

export interface SendTemplateEmailOptions {
  templateData?: Record<string, unknown>;
  /** Correlates the logical send in SendGrid event metadata. */
  idempotencyKey?: string;
  replyTo?: string;
  /** Base64-encoded file attachments (keep total under ~20 MB). */
  attachments?: { filename: string; content: string; type?: string }[];
}

export interface RenderedEmail {
  template: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string | null;
}

/**
 * Renders a registered template and sends it through SendGrid's Web API.
 * Sending is owned by the project's own SendGrid account.
 */
export async function sendTemplateEmail(
  templateName: string,
  to: string,
  options: SendTemplateEmailOptions = {},
): Promise<SendTemplateEmailResult> {
  const template = TEMPLATES[templateName];
  if (!template) {
    throw new Error(
      `Template '${templateName}' not found. Available: ${Object.keys(TEMPLATES).join(", ")}`,
    );
  }

  // Template-level `to` takes precedence — notification templates always
  // send to their fixed address.
  const rawRecipient = template.to || to;
  const templateData = options.templateData ?? {};
  const subject =
    typeof template.subject === "function" ? template.subject(templateData) : template.subject;
  let recipient = rawRecipient.trim();
  let replyTo = options.replyTo?.trim() || null;
  try {
    recipient = normalizeEmailAddress(rawRecipient, "Recipient");
    replyTo = options.replyTo ? normalizeEmailAddress(options.replyTo, "Reply-to address") : null;

    const attachmentBytes = (options.attachments ?? []).reduce(
      (total, attachment) => total + estimatedBase64Bytes(attachment.content),
      0,
    );
    if (attachmentBytes > MAX_ATTACHMENT_BYTES) {
      throw new Error("Email attachments exceed the 20 MB delivery limit");
    }
  } catch (error) {
    const detail = `Email validation failed: ${errorMessage(error)}`;
    await logSentEmail({
      template: templateName,
      to_email: recipient || "(missing)",
      subject,
      html: "",
      text_body: "",
      reply_to: replyTo,
      status: "failed",
      error: detail.slice(0, 500),
    });
    throw new Error(detail, { cause: error });
  }

  let html = "";
  let text = "";
  try {
    const element = React.createElement(template.component, templateData);
    [html, text] = await Promise.all([render(element), render(element, { plainText: true })]);
  } catch (error) {
    const detail = `Template render failed: ${errorMessage(error)}`;
    await logSentEmail({
      template: templateName,
      to_email: recipient,
      subject,
      html,
      text_body: text,
      reply_to: replyTo,
      status: "failed",
      error: detail,
    });
    throw new Error(detail, { cause: error });
  }

  const body: Record<string, unknown> = {
    personalizations: [
      {
        to: [{ email: recipient }],
        custom_args: {
          template: templateName,
          idempotency_key: options.idempotencyKey || crypto.randomUUID(),
        },
      },
    ],
    from: { email: FROM_ADDRESS, name: SITE_NAME },
    subject,
    content: [
      { type: "text/plain", value: text },
      { type: "text/html", value: html },
    ],
  };
  if (replyTo) body["reply_to"] = { email: replyTo };
  if (options.attachments?.length) {
    body["attachments"] = options.attachments.map((a) => ({
      content: a.content,
      filename: a.filename,
      type: a.type || "application/octet-stream",
      disposition: "attachment",
    }));
  }

  try {
    await deliverViaSendGrid(body);
  } catch (error) {
    const detail = errorMessage(error);
    await logSentEmail({
      template: templateName,
      to_email: recipient,
      subject,
      html,
      text_body: text,
      reply_to: replyTo,
      status: "failed",
      error: detail.slice(0, 500),
    });
    throw error;
  }

  await logSentEmail({
    template: templateName,
    to_email: recipient,
    subject,
    html,
    text_body: text,
    reply_to: replyTo,
    status: "sent",
    error: null,
  });

  return { sent: true };
}

/**
 * Sends the same template to independent recipients concurrently. Every send
 * is attempted and archived even when another recipient fails.
 */
export async function sendTemplateEmailToMany(
  templateName: string,
  recipients: readonly string[],
  options: SendTemplateEmailOptions | ((recipient: string) => SendTemplateEmailOptions) = {},
): Promise<void> {
  const uniqueRecipients = [
    ...new Map(
      recipients
        .map((recipient) => recipient.trim())
        .filter(Boolean)
        .map((recipient) => [recipient.toLowerCase(), recipient]),
    ).values(),
  ];
  if (uniqueRecipients.length === 0) throw new Error("At least one email recipient is required");

  const results = await Promise.allSettled(
    uniqueRecipients.map((recipient) =>
      sendTemplateEmail(
        templateName,
        recipient,
        typeof options === "function" ? options(recipient) : options,
      ),
    ),
  );
  const failures = results
    .filter((result): result is PromiseRejectedResult => result.status === "rejected")
    .map((result) => result.reason);
  if (failures.length) {
    throw new AggregateError(
      failures,
      `${failures.length} of ${uniqueRecipients.length} email deliveries failed`,
    );
  }
}

/** Re-delivers a stored email without re-rendering it. Used by the staff retry controls. */
export async function resendRenderedEmail(email: RenderedEmail): Promise<void> {
  const recipient = normalizeEmailAddress(email.to, "Recipient");
  const replyTo = email.replyTo ? normalizeEmailAddress(email.replyTo, "Reply-to address") : null;
  const body: Record<string, unknown> = {
    personalizations: [
      {
        to: [{ email: recipient }],
        custom_args: {
          template: email.template,
          retry: "true",
        },
      },
    ],
    from: { email: FROM_ADDRESS, name: SITE_NAME },
    subject: email.subject,
    content: [
      { type: "text/plain", value: email.text },
      { type: "text/html", value: email.html },
    ],
  };
  if (replyTo) body["reply_to"] = { email: replyTo };
  await deliverViaSendGrid(body);
}

async function deliverViaSendGrid(body: Record<string, unknown>): Promise<void> {
  const apiKey = process.env["SENDGRID_API_KEY"]?.trim();
  if (!apiKey) throw new Error("SENDGRID_API_KEY is not configured");

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
    try {
      const res = await fetch(SENDGRID_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (res.ok) return;

      const detail = (await res.text().catch(() => "")).slice(0, 500);
      const message = `SendGrid ${res.status}: ${detail || res.statusText}`;
      if (!isRetryableStatus(res.status) || attempt === RETRY_DELAYS_MS.length) {
        throw new Error(message);
      }
    } catch (error) {
      if (attempt === RETRY_DELAYS_MS.length || !isRetryableError(error)) {
        if (error instanceof Error && error.name === "AbortError") {
          throw new Error(`SendGrid request timed out after ${SEND_TIMEOUT_MS}ms`, {
            cause: error,
          });
        }
        throw error;
      }
    } finally {
      clearTimeout(timeout);
    }

    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
  }
}

function isRetryableStatus(status: number) {
  return status === 408 || status === 429 || status >= 500;
}

function isRetryableError(error: unknown) {
  if (!(error instanceof Error)) return true;
  if (error.name === "AbortError") return true;
  return !/^SendGrid 4\d\d:/.test(error.message);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function normalizeEmailAddress(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} is required`);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error(`${label} is not a valid email address`);
  }
  return normalized;
}

function estimatedBase64Bytes(value: string): number {
  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((value.length * 3) / 4) - padding);
}

/** Stores a full copy of every outgoing email so staff can read exactly what was sent. */
async function logSentEmail(row: {
  template: string;
  to_email: string;
  subject: string;
  html: string;
  text_body: string;
  reply_to: string | null;
  status: string;
  error: string | null;
}) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("sent_emails").insert(row);
    if (error) throw error;
  } catch (err) {
    console.error("Failed to log sent email", err);
  }
}
