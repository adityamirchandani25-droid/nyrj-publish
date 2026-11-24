import { test } from "node:test";
import assert from "node:assert/strict";
import { confirmedBrevoSenderRejections } from "./brevo-rejections.ts";

const rows = [
  { id: "one", recipient: "reviewer@example.org", provider_message_id: "<brevo-1>" },
  { id: "two", recipient: "other@example.org", provider_message_id: "<brevo-2>" },
  { id: "old", recipient: "third@example.org", provider_message_id: "sendgrid-id" },
];

test("reopens only matching invalid-sender rejections", () => {
  const result = confirmedBrevoSenderRejections(rows, [
    {
      messageId: "<brevo-1>",
      email: "REVIEWER@example.org",
      event: "error",
      reason:
        "Sending has been rejected because the sender you used noreply@nyrj.org is not valid.",
    },
    {
      messageId: "<brevo-2>",
      email: "someone-else@example.org",
      event: "error",
      reason:
        "Sending has been rejected because the sender you used noreply@nyrj.org is not valid.",
    },
    {
      messageId: "sendgrid-id",
      email: "third@example.org",
      event: "error",
      reason:
        "Sending has been rejected because the sender you used noreply@nyrj.org is not valid.",
    },
  ]);
  assert.deepEqual([...result.keys()], ["one"]);
});

test("never reopens a message with a delivered event", () => {
  const result = confirmedBrevoSenderRejections(rows, [
    {
      messageId: "<brevo-1>",
      email: "reviewer@example.org",
      event: "error",
      reason:
        "Sending has been rejected because the sender you used noreply@nyrj.org is not valid.",
    },
    { messageId: "<brevo-1>", email: "reviewer@example.org", event: "delivered" },
  ]);
  assert.equal(result.size, 0);
});
