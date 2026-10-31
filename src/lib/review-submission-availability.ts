export function reviewSubmissionBlocker(
  paper: { status: string; decision: string; deleted_at: string | null } | null,
): string | null {
  if (!paper || paper.deleted_at) return "This manuscript is no longer available for review.";
  if (paper.decision === "declined" || paper.status === "published")
    return "This manuscript has been closed by the editorial team. Contact them if you were asked to review it.";
  if (paper.status === "waiting for edits")
    return "This manuscript is waiting for the author's revision. You can submit another review after the revised manuscript arrives.";
  return null;
}
