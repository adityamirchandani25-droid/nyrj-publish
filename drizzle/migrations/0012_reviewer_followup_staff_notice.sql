-- Track whether staff were notified of the latest reviewer follow-up.
ALTER TABLE public.review_assignments
  ADD COLUMN IF NOT EXISTS followup_staff_notified_at timestamptz;

-- Earlier reminders did not have this staff notice. Avoid sending old notices
-- when this feature is first deployed.
UPDATE public.review_assignments
SET followup_staff_notified_at = GREATEST(invite_reminder_sent_at, review_reminder_sent_at)
WHERE followup_staff_notified_at IS NULL
  AND (invite_reminder_sent_at IS NOT NULL OR review_reminder_sent_at IS NOT NULL);
