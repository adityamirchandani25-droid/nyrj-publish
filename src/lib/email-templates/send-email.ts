import * as React from "react";
import { render } from "@react-email/render";
import { TEMPLATES } from "./registry";

// Server-only: reads SENDGRID_API_KEY. Never import from client components.

const SITE_NAME = "National Youth Research Journal";
// Domain authenticated in SendGrid.
const FROM_DOMAIN = "nyrj.org";
const FROM_ADDRESS = `noreply@${FROM_DOMAIN}`;
const SENDGRID_ENDPOINT = "https://api.sendgrid.com/v3/mail/send";
const SEND_TIMEOUT_MS = 12_000;
const RETRY_DELAYS_MS = [250, 750];

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
  const recipient = template.to || to;
  if (!recipient) {
    throw new Error("Recipient is required (the template defines no fixed recipient)");
  }

  const templateData = options.templateData ?? {};
  const subject =
    typeof template.subject === "function" ? template.subject(templateData) : template.subject;

  let html = "";
  let text = "";
  try {
    const element = React.createElement(template.component, templateData);
    html = await render(element);
    text = await render(element, { plainText: true });
  } catch (error) {
    const detail = `Template render failed: ${errorMessage(error)}`;
    await logSentEmail({
      template: templateName,
      to_email: recipient,
      subject,
      html,
      text_body: text,
      reply_to: options.replyTo ?? null,
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
  if (options.replyTo) body["reply_to"] = { email: options.replyTo };
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
      reply_to: options.replyTo ?? null,
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
    reply_to: options.replyTo ?? null,
    status: "sent",
    error: null,
  });

  return { sent: true };
}

/** Re-delivers a stored email without re-rendering it. Used by the staff retry controls. */
export async function resendRenderedEmail(email: RenderedEmail): Promise<void> {
  const body: Record<string, unknown> = {
    personalizations: [
      {
        to: [{ email: email.to }],
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
  if (email.replyTo) body["reply_to"] = { email: email.replyTo };
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
