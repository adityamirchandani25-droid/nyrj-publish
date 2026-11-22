import assert from "node:assert/strict";
import { test } from "node:test";
import { currentRoundFeedback, wasSharedWithAuthor } from "../reviewer-monitor.ts";

test("reviewer monitoring counts substantive feedback in the current manuscript round", () => {
  const round = "2026-11-07T12:00:00Z";
  const old = { submitted_at: "2026-11-01T12:00:00Z", comments: "Old review", file_path: null };
  const empty = { submitted_at: "2026-11-08T12:00:00Z", comments: "   ", file_path: null };
  const file = { submitted_at: "2026-11-09T12:00:00Z", comments: "", file_path: "reviews/new.pdf" };
  assert.equal(currentRoundFeedback([old, empty], round), null);
  assert.equal(currentRoundFeedback([old, file, empty], round), file.submitted_at);
  assert.equal(wasSharedWithAuthor(file.submitted_at, "2026-11-08T12:00:00Z"), false);
  assert.equal(wasSharedWithAuthor(file.submitted_at, "2026-11-10T12:00:00Z"), true);
});
