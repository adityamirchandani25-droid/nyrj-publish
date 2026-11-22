export type RenderedProviderBody = {
  personalizations: { to: { email: string }[]; custom_args?: Record<string, string> }[];
  subject: string;
  content: { type: string; value: string }[];
  reply_to?: { email: string };
  attachments?: { filename: string; content: string }[];
};

export type BrevoMessage = {
  sender: { email: string; name: string };
  to: { email: string }[];
  subject: string;
  htmlContent: string;
  textContent: string;
  replyTo?: { email: string };
  attachment?: { name: string; content: string }[];
  tags?: string[];
  headers?: Record<string, string>;
};

/** Keep the project's rendered templates and logical-send keys when switching providers. */
export function brevoMessage(
  body: RenderedProviderBody,
  fromEmail: string,
  fromName: string,
): BrevoMessage {
  const recipient = body.personalizations[0]?.to[0]?.email;
  if (!recipient) throw new Error("Brevo recipient is missing");
  const metadata = body.personalizations[0]?.custom_args ?? {};
  const key = metadata.idempotency_key;
  return {
    sender: { email: fromEmail, name: fromName },
    to: [{ email: recipient }],
    subject: body.subject,
    textContent: body.content.find((part) => part.type === "text/plain")?.value ?? "",
    htmlContent: body.content.find((part) => part.type === "text/html")?.value ?? "",
    ...(body.reply_to ? { replyTo: body.reply_to } : {}),
    ...(body.attachments?.length
      ? {
          attachment: body.attachments.map((file) => ({
            name: file.filename,
            content: file.content,
          })),
        }
      : {}),
    ...(metadata.template ? { tags: [metadata.template] } : {}),
    ...(key ? { headers: { "X-Nyrj-Idempotency-Key": key } } : {}),
  };
}
