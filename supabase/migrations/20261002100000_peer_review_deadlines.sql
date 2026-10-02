-- Once the 15-day deadline passes, the assignment status becomes
-- `no_response`. This timestamp lets the daily job retry staff alerts after a
-- temporary email-provider failure without recreating the history event.
alter table public.review_assignments
  add column if not exists no_response_notified_at timestamptz;
