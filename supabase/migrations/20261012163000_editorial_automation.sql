-- Keep the production Supabase migration history aligned with the editorial
-- automation schema used by the application. Every statement is idempotent so
-- this can repair environments where some columns were added manually.

alter table public.manuscript_submissions
  add column if not exists revision_requested_at timestamptz,
  add column if not exists revision_reminder_sent_at timestamptz,
  add column if not exists revision_staff_alert_sent_at timestamptz;

alter table public.initial_reviewers
  add column if not exists workload_reminder_sent_on date;

alter table public.review_assignments
  add column if not exists no_response_notified_at timestamptz,
  add column if not exists no_response_followup_sent_at timestamptz,
  add column if not exists followup_staff_notified_at timestamptz;

create table if not exists public.peer_review_email_replies (
  id uuid primary key default gen_random_uuid(),
  gmail_message_id text not null unique,
  assignment_id uuid not null references public.review_assignments(id) on delete cascade,
  from_email text not null,
  subject text not null default '',
  body_text text not null default '',
  received_at timestamptz not null,
  attachments jsonb not null default '[]'::jsonb,
  imported_at timestamptz not null default now()
);

drop index if exists public.manuscript_submissions_revision_followup_idx;
create index manuscript_submissions_revision_followup_idx
  on public.manuscript_submissions (revision_requested_at)
  where status = 'waiting for edits' and decision <> 'declined';

create index if not exists peer_review_email_replies_assignment_idx
  on public.peer_review_email_replies (assignment_id, received_at desc);

grant select, insert on public.peer_review_email_replies to service_role;
alter table public.peer_review_email_replies enable row level security;

drop policy if exists "Deny client access to peer review email replies"
  on public.peer_review_email_replies;
create policy "Deny client access to peer review email replies"
  on public.peer_review_email_replies as restrictive for all
  to anon, authenticated using (false) with check (false);

-- Do not send retroactive staff notices for reminders delivered before the
-- staff-notification feature was introduced.
update public.review_assignments
set followup_staff_notified_at = greatest(invite_reminder_sent_at, review_reminder_sent_at)
where followup_staff_notified_at is null
  and (invite_reminder_sent_at is not null or review_reminder_sent_at is not null);
