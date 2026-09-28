-- Let a valid shared access code create a portal account without also adding
-- that person to the automatic manuscript-assignment rotation.

alter table public.initial_reviewers
  add column if not exists portal_enabled boolean not null default false;

-- Preserve access for every existing active initial reviewer.
update public.initial_reviewers
set portal_enabled = true
where active = true;

-- Account creation and linking rely on one reviewer row per normalized email.
create unique index if not exists initial_reviewers_email_lower_key
  on public.initial_reviewers (lower(email));
