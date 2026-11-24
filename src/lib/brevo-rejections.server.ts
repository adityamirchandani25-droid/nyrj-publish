import type { BrevoDeliveryEvent } from "./brevo-rejections";

const BREVO_EVENTS_URL = "https://api.brevo.com/v3/smtp/statistics/events";

/** Brevo's event report is the source of truth after its send API accepts a request. */
export async function recentBrevoDeliveryEvents(): Promise<BrevoDeliveryEvent[]> {
  const apiKey = process.env.BREVO_API_KEY?.trim();
  if (process.env.EMAIL_PROVIDER?.trim().toLowerCase() !== "brevo" || !apiKey) {
    throw new Error("Brevo must be the active email provider before checking rejections.");
  }

  const events: BrevoDeliveryEvent[] = [];
  for (let offset = 0; offset < 50_000; offset += 5_000) {
    const url = new URL(BREVO_EVENTS_URL);
    url.searchParams.set("days", "90");
    url.searchParams.set("limit", "5000");
    url.searchParams.set("offset", String(offset));
    const response = await fetch(url, {
      headers: { "api-key": apiKey, Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as {
        code?: unknown;
        message?: unknown;
      };
      const detail =
        typeof body.message === "string"
          ? body.message.replaceAll(apiKey, "[redacted]").slice(0, 180)
          : typeof body.code === "string"
            ? body.code.slice(0, 80)
            : "";
      if (response.status === 401) {
        throw new Error(
          `Brevo refused this deployment's API key or server IP (401${detail ? `: ${detail}` : ""}). No emails were retried. Check the Production BREVO_API_KEY and Brevo IP authorization.`,
        );
      }
      if (response.status === 403) {
        throw new Error(
          `Brevo denied delivery-log access (403${detail ? `: ${detail}` : ""}). The API key needs Transactional email access. No emails were retried.`,
        );
      }
      throw new Error(
        `Could not check Brevo delivery events (${response.status}${detail ? `: ${detail}` : ""}). No emails were retried.`,
      );
    }
    const report = (await response.json()) as { events?: BrevoDeliveryEvent[] };
    if (!Array.isArray(report.events))
      throw new Error("Brevo returned an invalid delivery report.");
    events.push(...report.events);
    if (report.events.length < 5_000) return events;
  }
  throw new Error("Brevo has too many recent events to reconcile safely in one request.");
}
