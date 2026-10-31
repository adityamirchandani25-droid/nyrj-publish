export function reviewSubmissionBlocker(
  paper: { status: string; decision: string; deleted_at: string | null } | null,
): string | null {
  if (!paper || paper.deleted_at) return "This manuscript is no longer available for review.";
  if (paper.decision === "declined" || paper.status === "published")
    return "This manuscript has been closed by the editorial team. Contact them if you were asked to review it.";
  // Another review may open an author revision window while this assignment
  // is still active. The reviewer must still be able to send feedback to staff.
  return null;
}
