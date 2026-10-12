-- Track when a revision request actually reached the author and each follow-up.
ALTER TABLE public.manuscript_submissions
  ADD COLUMN IF NOT EXISTS revision_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS revision_reminder_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS revision_staff_alert_sent_at timestamptz;

-- One workload reminder per calendar day while an initial reviewer has a queue.
ALTER TABLE public.initial_reviewers
  ADD COLUMN IF NOT EXISTS workload_reminder_sent_on date;

ALTER TABLE public.review_assignments
  ADD COLUMN IF NOT EXISTS no_response_followup_sent_at timestamptz;

CREATE INDEX IF NOT EXISTS manuscript_submissions_revision_followup_idx
  ON public.manuscript_submissions (revision_requested_at)
  WHERE status = 'waiting for edits' AND decision = 'pending';
