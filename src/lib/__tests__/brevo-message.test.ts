import assert from "node:assert/strict";
import test from "node:test";
import { brevoMessage } from "../email-templates/brevo-message.ts";

test("Brevo preserves reviewer content, reply-to, attachments, and workflow key", () => {
  const message = brevoMessage(
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
      attachments: [{ filename: "paper.pdf", content: "cGRm" }],
    },
    "noreply@nyrj.org",
    "National Youth Research Journal",
  );

  assert.deepEqual(message.sender, {
    email: "noreply@nyrj.org",
    name: "National Youth Research Journal",
  });
  assert.deepEqual(message.to, [{ email: "reviewer@example.com" }]);
  assert.equal(message.subject, "Review a paper");
  assert.equal(message.textContent, "Plain text");
  assert.equal(message.htmlContent, "<p>Plain text</p>");
  assert.deepEqual(message.replyTo, { email: "staff@example.com" });
  assert.deepEqual(message.attachment, [{ name: "paper.pdf", content: "cGRm" }]);
  assert.deepEqual(message.tags, ["reviewer-invitation"]);
  assert.equal(message.headers?.["X-Nyrj-Idempotency-Key"], "assignment-1");
});
