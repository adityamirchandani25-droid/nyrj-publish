export type FeedbackRecord = {
  submitted_at: string;
  comments: string | null;
  file_path: string | null;
};

/** The latest substantive feedback returned for this manuscript round. */
export function currentRoundFeedback(
  records: readonly FeedbackRecord[],
  roundStartedAt: string,
): string | null {
  return (
    records
      .filter(
        (record) =>
          record.submitted_at >= roundStartedAt &&
          (Boolean(record.comments?.trim()) || Boolean(record.file_path)),
      )
      .map((record) => record.submitted_at)
      .sort()
      .at(-1) ?? null
  );
}

export function wasSharedWithAuthor(returnedAt: string | null, editsSentAt: string | null) {
  return Boolean(returnedAt && editsSentAt && editsSentAt >= returnedAt);
}
