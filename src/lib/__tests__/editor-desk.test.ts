import assert from "node:assert/strict";
import { test } from "node:test";
import { editorDeskSections } from "../editor-desk.ts";

test("editor counts track the displayed papers after submission, reassignment, and status updates", () => {
  const email = "editor@example.org";
  const first = { id: "1", initial_reviewer_email: email, status: "submitted" };
  const second = { id: "2", initial_reviewer_email: "other@example.org", status: "initial review" };
  let sections = editorDeskSections([first], email);
  assert.equal(sections.assigned.length, 1);
  assert.equal(sections.all.length, 1);
  sections = editorDeskSections([first, second], email);
  assert.equal(sections.all.length, 2);
  assert.equal(sections.assigned.length, 1);
  sections = editorDeskSections([first, { ...second, initial_reviewer_email: email }], email);
  assert.deepEqual(
    sections.assigned.map((paper) => paper.id),
    ["1", "2"],
  );
  sections = editorDeskSections([{ ...first, status: "published" }, second], email);
  assert.equal(sections.assigned.length, 1);
  assert.equal(sections.assigned[0]?.status, "published");
});
