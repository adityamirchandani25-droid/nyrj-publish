import assert from "node:assert/strict";
import { test } from "node:test";
import { submissionTimeline } from "../submission-timeline.ts";

test("student timeline shows the stage and next step without inventing a date", () => {
  const initial = submissionTimeline({ status: "submitted", decision: "pending" });
  assert.equal(initial.stage, "Initial review");
  assert.equal(initial.estimate, null);
  assert.match(initial.next, /initial reviewer/);
  const waiting = submissionTimeline({ status: "waiting for edits", decision: "pending" });
  assert.match(waiting.next, /submit your revised manuscript/);
});

test("peer-review target is labeled as an estimate and stale dates are not projected", () => {
  const now = new Date("2026-11-22T12:00:00Z");
  const future = submissionTimeline({
    status: "secondary review",
    decision: "pending",
    reviewerDueAt: "2026-11-28T12:00:00Z",
    now,
  });
  assert.match(future.estimate ?? "", /estimate/);
  const overdue = submissionTimeline({
    status: "secondary review",
    decision: "pending",
    reviewerDueAt: "2026-11-01T12:00:00Z",
    now,
  });
  assert.equal(overdue.estimate, null);
  assert.match(overdue.next, /follow up/);
});
