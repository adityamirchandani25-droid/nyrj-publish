/** Explicit allowlist: never send author, contact, referral or consent records to reviewers. */
export const REVIEWER_DETAIL_FIELDS = {
  research_type: "Research type",
  research_type_other: "Other research type",
  comments: "Submission comments",
  conflict_of_interest: "Conflict of interest declared",
  conflict_explanation: "Conflict explanation",
  funding: "Funding declared",
  funding_source: "Funding source",
  used_gen_ai: "Generative AI used",
  gen_ai_explanation: "AI usage explanation",
  is_original: "Original work",
  not_under_consideration: "Not under consideration elsewhere",
  has_human_or_vertebrate: "Human or vertebrate research",
  data_availability: "Data availability",
  all_authors_consent: "All authors consented",
} as const;

export type ReviewerSubmission = {
  details: Array<{ label: string; value: string }>;
  files: Array<{ label: string; url: string }>;
};

export function reviewerDetails(row: Record<string, unknown>): ReviewerSubmission["details"] {
  return Object.entries(REVIEWER_DETAIL_FIELDS).flatMap(([key, label]) => {
    const value = row[key];
    return typeof value === "boolean"
      ? [{ label, value: value ? "Yes" : "No" }]
      : typeof value === "string" && value.trim()
        ? [{ label, value }]
        : [];
  });
}
