-- Initial reviewers use normal Supabase Auth accounts. The nullable UUID is
-- bound on first authenticated portal access after the JWT email is matched to
-- the existing reviewer rotation row. Existing reviewers and assignments are
-- preserved unchanged.

alter table public.initial_reviewers
  add column if not exists auth_user_id uuid references auth.users(id) on delete set null;

create unique index if not exists initial_reviewers_auth_user_id_key
  on public.initial_reviewers (auth_user_id)
  where auth_user_id is not null;

create index if not exists initial_reviewers_email_lower_idx
  on public.initial_reviewers (lower(email));

create index if not exists manuscript_submissions_initial_reviewer_email_lower_idx
  on public.manuscript_submissions (lower(initial_reviewer_email))
  where deleted_at is null;

-- These tables stay server-only. Authenticated reviewers access them through
-- server functions that validate their Supabase JWT and reviewer assignment.
revoke all on table public.initial_reviewers from anon, authenticated;
revoke all on table public.editor_recommendations from anon, authenticated;
grant select, insert, update on table public.initial_reviewers to service_role;
grant select, insert, update on table public.editor_recommendations to service_role;
