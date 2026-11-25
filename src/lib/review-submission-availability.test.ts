import test from "node:test";
import assert from "node:assert/strict";
import { reviewSubmissionBlocker, reviewerMaySubmit } from "./review-submission-availability.ts";

test("accepted reviewers can submit after a missed deadline while unaccepted invitations stay closed", () => {
  assert.equal(reviewerMaySubmit("no_response", "2026-11-01T00:00:00Z"), true);
  assert.equal(reviewerMaySubmit("no_response", null), false);
  assert.equal(reviewerMaySubmit("declined", "2026-11-01T00:00:00Z"), false);
  assert.equal(reviewerMaySubmit("accepted", "2026-11-01T00:00:00Z"), true);
  assert.equal(reviewSubmissionBlocker({ status: "initial review", decision: "pending", deleted_at: null }), null);
  assert.match(reviewSubmissionBlocker({ status: "published", decision: "accepted", deleted_at: null })!, /closed/);
});
