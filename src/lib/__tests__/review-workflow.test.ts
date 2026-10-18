import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";
import { reviewFeedbackSchema } from "../review-feedback.ts";
import { reviewStatus } from "../review-workflow.ts";
import { checkStaffPassword, issueStaffToken, verifyStaffToken } from "../staff-auth.server.ts";

describe("review feedback inputs", () => {
  test("accepts text, annotation, and both", () => {
    for (const input of [
      { comments: "Useful feedback" },
      { filePath: "review-feedback/id/file.pdf", fileName: "paper.pdf" },
      { comments: "Changes", filePath: "file.pdf", fileName: "paper.pdf" },
    ])
      assert.equal(reviewFeedbackSchema.safeParse(input).success, true);
  });
  test("rejects empty, whitespace, and incomplete attachments", () => {
    for (const input of [
      {},
      { comments: "   " },
      { filePath: "file.pdf" },
      { comments: "Comments", fileName: "paper.pdf" },
    ])
      assert.equal(reviewFeedbackSchema.safeParse(input).success, false);
  });
  test("limits comments to 20,000 characters", () =>
    assert.equal(reviewFeedbackSchema.safeParse({ comments: "x".repeat(20001) }).success, false));
});
describe("historical paper status", () => {
  test("final and trashed papers are completed", () => {
    for (const p of [
      { status: "published", decision: "accepted" },
      { status: "submitted", decision: "declined" },
      { status: "submitted", decision: "pending", deleted_at: "2026-01-01" },
    ])
      assert.equal(reviewStatus(p, []), "completed");
  });
  test("author revision status wins over sent reviewer comments", () =>
    assert.equal(
      reviewStatus({ status: "waiting for edits", decision: "pending" }, [
        { status: "sent_to_author" },
      ]),
      "awaiting resubmission",
    ));
  test("reopened reviews are pending and recorded sent comments remain filterable", () => {
    assert.equal(
      reviewStatus({ status: "secondary review", decision: "pending" }, [{ status: "accepted" }]),
      "pending",
    );
    assert.equal(
      reviewStatus({ status: "editorial review", decision: "pending" }, [
        { status: "sent_to_author" },
        { status: "declined" },
      ]),
      "comments sent",
    );
  });
});
describe("staff access", () => {
  const original = process.env.STAFF_PASSWORD;
  afterEach(() => {
    if (original === undefined) delete process.env.STAFF_PASSWORD;
    else process.env.STAFF_PASSWORD = original;
  });
  test("checks the server secret and rejects forged and expired sessions", () => {
    process.env.STAFF_PASSWORD = "test-only-access-secret";
    assert.equal(checkStaffPassword("incorrect"), false);
    assert.equal(checkStaffPassword("test-only-access-secret"), true);
    const { token } = issueStaffToken();
    assert.doesNotThrow(() => verifyStaffToken(token));
    assert.throws(() => verifyStaffToken("0." + token.split(".")[1]));
    assert.throws(() => verifyStaffToken(""));
    assert.throws(() => verifyStaffToken(token + "00"));
    process.env.STAFF_PASSWORD = "rotated-secret";
    assert.throws(() => verifyStaffToken(token));
  });
  test("fails closed when the server secret is missing", () => {
    delete process.env.STAFF_PASSWORD;
    assert.throws(() => checkStaffPassword("anything"));
    assert.throws(() => verifyStaffToken("forged.token"));
  });
});
