import assert from "node:assert/strict";
import test from "node:test";
import { mailtrapMessage } from "../email-templates/mailtrap-message.ts";

test("Mailtrap keeps the existing recipient, content, reply-to, attachment, and retry metadata", () => {
  const message = mailtrapMessage(
    {
      personalizations: [
        {
          to: [{ email: "reviewer@example.com" }],
          custom_args: { template: "reviewer-invitation", idempotency_key: "assignment-1" },
        },
      ],
      subject: "Review a paper",
      content: [
        { type: "text/plain", value: "Plain text" },
        { type: "text/html", value: "<p>Plain text</p>" },
      ],
      reply_to: { email: "staff@example.com" },
      attachments: [{ filename: "paper.pdf", content: "cGRm", type: "application/pdf" }],
    },
    "noreply@nyrj.org",
    "National Youth Research Journal",
  );

  assert.deepEqual(message.from, {
    email: "noreply@nyrj.org",
    name: "National Youth Research Journal",
  });
  assert.deepEqual(message.to, [{ email: "reviewer@example.com" }]);
  assert.equal("subject" in message && message.subject, "Review a paper");
  assert.equal("text" in message && message.text, "Plain text");
  assert.equal("html" in message && message.html, "<p>Plain text</p>");
  assert.deepEqual(message.reply_to, { email: "staff@example.com" });
  assert.equal(message.attachments?.[0]?.filename, "paper.pdf");
  assert.equal("category" in message && message.category, "reviewer-invitation");
  assert.equal(message.custom_variables?.idempotency_key, "assignment-1");
});
