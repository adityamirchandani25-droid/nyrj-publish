import { DeliveryUncertainError } from "./send-email";
import { brevoMessage, type RenderedProviderBody } from "./brevo-message";

const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email";
const SEND_TIMEOUT_MS = 8_000;

/** Brevo's IP allowlist rejects requests from hosts with rotating egress IPs. */
export function unrecognisedIp(detail: string): string | null {
  return /unrecogni[sz]ed IP address\s+([0-9a-f.:]+[0-9a-f])/i.exec(detail)?.[1] ?? null;
}

export async function deliverViaBrevo(body: Record<string, unknown>): Promise<string | null> {
  const apiKey = process.env["BREVO_API_KEY"]?.trim();
  const fromEmail = process.env["BREVO_FROM_EMAIL"]?.trim();
  if (!apiKey) throw new Error("BREVO_API_KEY is not configured");
  if (!fromEmail) throw new Error("BREVO_FROM_EMAIL is not configured");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fromEmail)) {
    throw new Error("BREVO_FROM_EMAIL is not a valid email address");
  }

  const message = brevoMessage(
    body as RenderedProviderBody,
    fromEmail,
    process.env["BREVO_FROM_NAME"]?.trim() || "National Youth Research Journal",
  );
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
  try {
    const response = await fetch(BREVO_ENDPOINT, {
      method: "POST",
      headers: {
        "api-key": apiKey,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
      signal: controller.signal,
    });
    if (!response.ok) {
      const detail = (await response.text().catch(() => "")).slice(0, 500);
      const blockedIp = response.status === 401 ? unrecognisedIp(detail) : null;
      const error = blockedIp
        ? `Brevo 401: blocked unrecognised server IP ${blockedIp}. Nothing was sent. Turn off IP blocking in Brevo (Security → Authorized IPs), then retry.`
        : `Brevo ${response.status}: ${detail || response.statusText}`;
      if (response.status === 408 || response.status >= 500) {
        throw new DeliveryUncertainError(`${error} — check Brevo logs before retrying`);
      }
      throw new Error(error);
    }
    const result = (await response.json().catch(() => ({}))) as { messageId?: string };
    return result.messageId ?? null;
  } catch (error) {
    if (error instanceof DeliveryUncertainError) throw error;
    if (error instanceof Error && (error.name === "AbortError" || error instanceof TypeError)) {
      throw new DeliveryUncertainError(`Brevo result is unknown: ${error.message}`, {
        cause: error,
      });
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
