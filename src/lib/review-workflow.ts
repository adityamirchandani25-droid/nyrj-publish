export type ReviewStatus = "pending" | "comments sent" | "awaiting resubmission" | "completed";
export function reviewStatus(
  paper: { status: string; decision: string; deleted_at?: string | null },
  assignments: Array<{ status: string }>,
): ReviewStatus {
  if (paper.deleted_at || paper.decision === "declined" || paper.status === "published")
    return "completed";
  if (paper.status === "waiting for edits") return "awaiting resubmission";
  if (
    assignments.length &&
    assignments.every((a) => ["sent_to_author", "declined", "no_response"].includes(a.status)) &&
    assignments.some((a) => a.status === "sent_to_author")
  )
    return "comments sent";
  return "pending";
}
