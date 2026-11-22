import type { Mail } from "mailtrap";

export type RenderedProviderBody = {
  personalizations: { to: { email: string }[]; custom_args?: Record<string, string> }[];
  subject: string;
  content: { type: string; value: string }[];
  reply_to?: { email: string };
  attachments?: { filename: string; content: string; type?: string; disposition?: string }[];
};

/** Converts the existing rendered message into Mailtrap's transactional SDK shape. */
export function mailtrapMessage(
  body: RenderedProviderBody,
  fromEmail: string,
  fromName: string,
): Mail {
  const recipient = body.personalizations[0]?.to[0]?.email;
  if (!recipient) throw new Error("Mailtrap recipient is missing");
  const text = body.content.find((part) => part.type === "text/plain")?.value ?? "";
  const html = body.content.find((part) => part.type === "text/html")?.value ?? "";
  const metadata = body.personalizations[0]?.custom_args ?? {};
  return {
    from: { email: fromEmail, name: fromName },
    to: [{ email: recipient }],
    subject: body.subject,
    text,
    html,
    ...(body.reply_to ? { reply_to: body.reply_to } : {}),
    ...(body.attachments?.length ? { attachments: body.attachments } : {}),
    ...(metadata.template ? { category: metadata.template } : {}),
    ...(Object.keys(metadata).length ? { custom_variables: metadata } : {}),
  };
}
