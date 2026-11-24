export type BrevoDeliveryEvent = {
  messageId?: string;
  email?: string;
  event?: string;
  reason?: string;
};

export type AcceptedNotification = {
  id: string;
  recipient: string;
  provider_message_id: string | null;
};

/** Only a definite invalid-sender rejection can safely reopen an accepted send. */
export function confirmedBrevoSenderRejections(
  notifications: AcceptedNotification[],
  events: BrevoDeliveryEvent[],
): Map<string, string> {
  const byMessageId = new Map(
    notifications
      .filter((row) => row.provider_message_id?.startsWith("<"))
      .map((row) => [row.provider_message_id!, row]),
  );
  const delivered = new Set<string>();
  const rejected = new Map<string, string>();

  for (const event of events) {
    const row = byMessageId.get(event.messageId ?? "");
    if (!row || event.email?.toLowerCase() !== row.recipient.toLowerCase()) continue;
    if (event.event === "delivered") delivered.add(row.id);
    if (
      event.event === "error" &&
      /sending has been rejected because the sender you used .+ is not valid/i.test(
        event.reason ?? "",
      )
    ) {
      rejected.set(row.id, event.reason!.slice(0, 400));
    }
  }

  for (const id of delivered) rejected.delete(id);
  return rejected;
}
