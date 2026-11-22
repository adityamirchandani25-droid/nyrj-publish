import assert from "node:assert/strict";
import { test } from "node:test";
import { staffQuestionIntent } from "../sage-intent.ts";

test("Sage staff mode routes different questions and carries a follow-up topic", () => {
  assert.equal(staffQuestionIntent("Which reviewers haven't sent feedback?"), "reviewers");
  assert.equal(staffQuestionIntent("Are our emails bouncing?"), "emails");
  assert.equal(staffQuestionIntent("How many papers are active?"), "counts");
  assert.equal(staffQuestionIntent("Which papers await resubmission?"), "resubmissions");
  assert.equal(staffQuestionIntent("Any requests to accept?"), "approvals");
  assert.equal(staffQuestionIntent("What is an ORCID?"), "unknown");
  assert.equal(staffQuestionIntent("What about those?", "Are our emails bouncing?"), "emails");
  assert.equal(
    staffQuestionIntent("And which are overdue?", "Which reviewers haven't sent feedback?"),
    "reviewers",
  );
});
