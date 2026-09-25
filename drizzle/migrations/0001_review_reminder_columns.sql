ALTER TABLE public.review_assignments
  ADD COLUMN IF NOT EXISTS invite_reminder_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_reminder_sent_at timestamptz;