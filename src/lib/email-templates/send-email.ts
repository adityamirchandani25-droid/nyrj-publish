import * as React from 'react'
import { render } from '@react-email/render'
import { TEMPLATES } from './registry'

// Server-only: reads SENDGRID_API_KEY. Never import from client components.

const SITE_NAME = "National Youth Research Journal"
// Domain authenticated in SendGrid.
const FROM_DOMAIN = "nyrj.org"
const FROM_ADDRESS = `noreply@${FROM_DOMAIN}`

export type SendTemplateEmailResult =
  | { sent: true }
  | { sent: false; reason: 'recipient_suppressed' }

export interface SendTemplateEmailOptions {
  templateData?: Record<string, any>
  /** Dedupes retries of the same logical send; defaults to a random UUID (no dedupe). */
  idempotencyKey?: string
  replyTo?: string
  /** Base64-encoded file attachments (keep total under ~20 MB). */
  attachments?: { filename: string; content: string; type?: string }[]
}

/**
 * Renders a registered template and sends it through SendGrid's Web API.
 * Sending is owned by the project's own SendGrid account.
 */
export async function sendTemplateEmail(
  templateName: string,
  to: string,
  options: SendTemplateEmailOptions = {}
): Promise<SendTemplateEmailResult> {
  const apiKey = process.env['SENDGRID_API_KEY']
  if (!apiKey) {
    throw new Error('SENDGRID_API_KEY is not configured')
  }

  const template = TEMPLATES[templateName]
  if (!template) {
    throw new Error(
      `Template '${templateName}' not found. Available: ${Object.keys(TEMPLATES).join(', ')}`
    )
  }

  // Template-level `to` takes precedence — notification templates always
  // send to their fixed address.
  const recipient = template.to || to
  if (!recipient) {
    throw new Error('Recipient is required (the template defines no fixed recipient)')
  }

  const templateData = options.templateData ?? {}
  const element = React.createElement(template.component, templateData)
  const html = await render(element)
  const text = await render(element, { plainText: true })
  const subject =
    typeof template.subject === 'function'
      ? template.subject(templateData)
      : template.subject

  const body: Record<string, any> = {
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
      { type: 'text/plain', value: text },
      { type: 'text/html', value: html },
    ],
  }
  if (options.replyTo) body['reply_to'] = { email: options.replyTo }
  if (options.attachments?.length) {
    body['attachments'] = options.attachments.map((a) => ({
      content: a.content,
      filename: a.filename,
      type: a.type || 'application/octet-stream',
      disposition: 'attachment',
    }))
  }

  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    await logSentEmail({
      template: templateName,
      to_email: recipient,
      subject,
      html,
      text_body: text,
      reply_to: options.replyTo ?? null,
      status: 'failed',
      error: `SendGrid ${res.status}: ${detail.slice(0, 500)}`,
    })
    throw new Error(`SendGrid send failed (${res.status}): ${detail.slice(0, 500)}`)
  }

  await logSentEmail({
    template: templateName,
    to_email: recipient,
    subject,
    html,
    text_body: text,
    reply_to: options.replyTo ?? null,
    status: 'sent',
    error: null,
  })

  return { sent: true }
}

/** Stores a full copy of every outgoing email so staff can read exactly what was sent. */
async function logSentEmail(row: {
  template: string
  to_email: string
  subject: string
  html: string
  text_body: string
  reply_to: string | null
  status: string
  error: string | null
}) {
  try {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    await supabaseAdmin.from('sent_emails').insert(row)
  } catch (err) {
    console.error('Failed to log sent email', err)
  }
}
