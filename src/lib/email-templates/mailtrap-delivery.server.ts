import { MailtrapClient } from "mailtrap";
import { DeliveryUncertainError } from "./send-email";
import { mailtrapMessage, type RenderedProviderBody } from "./mailtrap-message";

export async function deliverViaMailtrap(body: Record<string, unknown>): Promise<string | null> {
  const token = process.env["MAILTRAP_API_KEY"]?.trim();
  const fromEmail = process.env["MAILTRAP_FROM_EMAIL"]?.trim();
  if (!token) throw new Error("MAILTRAP_API_KEY is not configured");
  if (!fromEmail) throw new Error("MAILTRAP_FROM_EMAIL is not configured");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fromEmail)) {
    throw new Error("MAILTRAP_FROM_EMAIL is not a valid email address");
  }

  const client = new MailtrapClient({ token, sandbox: false, bulk: false });
  const message = mailtrapMessage(
    body as RenderedProviderBody,
    fromEmail,
    process.env["MAILTRAP_FROM_NAME"]?.trim() || "National Youth Research Journal",
  );
  try {
    const response = await client.send(message);
    if (!response.success) throw new Error("Mailtrap did not accept the email");
    return response.message_ids[0] ?? null;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const cause = error instanceof Error ? (error as Error & { cause?: unknown }).cause : null;
    const transport = cause as {
      code?: string;
      response?: { status?: number };
      request?: unknown;
    } | null;
    const status = transport?.response?.status;
    if (!status && (transport?.request || transport?.code)) {
      throw new DeliveryUncertainError(`Mailtrap result is unknown: ${detail}`, { cause: error });
    }
    throw new Error(`Mailtrap${status ? ` ${status}` : ""}: ${detail}`, { cause: error });
  }
}
