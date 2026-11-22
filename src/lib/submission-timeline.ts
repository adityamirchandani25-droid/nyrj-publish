export type SubmissionTimeline = {
  stage: string;
  next: string;
  estimate: string | null;
};

export function submissionTimeline(input: {
  status: string;
  decision: string;
  reviewerDueAt?: string | null;
  now?: Date;
}): SubmissionTimeline {
  if (input.decision === "declined")
    return { stage: "Closed", next: "Contact the editorial team with questions.", estimate: null };
  if (input.status === "published")
    return {
      stage: "Published",
      next: "Your article is available in the library.",
      estimate: null,
    };
  if (input.status === "publishing")
    return {
      stage: "Publishing",
      next: "The team will prepare and publish the final article.",
      estimate: null,
    };
  if (input.status === "waiting for edits")
    return {
      stage: "Author revisions",
      next: "Review the edits and submit your revised manuscript.",
      estimate: null,
    };
  if (input.status === "secondary review") {
    const due = input.reviewerDueAt ? new Date(input.reviewerDueAt) : null;
    const validDue = due && Number.isFinite(due.getTime());
    return {
      stage: "Peer review",
      next:
        validDue && due < (input.now ?? new Date())
          ? "The reviewer target has passed; the editorial team will follow up."
          : "The reviewer will return feedback for editorial review.",
      estimate:
        validDue && due >= (input.now ?? new Date())
          ? `Reviewer target (estimate): ${due.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`
          : null,
    };
  }
  if (input.status === "editorial review")
    return {
      stage: "Editorial review",
      next: "An editor will review the manuscript and decide the next step.",
      estimate: null,
    };
  return {
    stage: "Initial review",
    next: "The initial reviewer will assess the submission.",
    estimate: null,
  };
}
