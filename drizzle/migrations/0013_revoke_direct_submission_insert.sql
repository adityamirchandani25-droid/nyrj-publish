-- Manuscripts are created only by the submitManuscript server function, which
-- runs as service_role after validating the payload, enforcing rate limits and
-- confirming that every file path belongs to the caller. The remaining client
-- INSERT grant let any signed-in user call the REST API directly and bypass
-- all of that (arbitrary status/decision, foreign file paths, no rate limit).
-- This only removes a client privilege; it does not change or delete rows.

drop policy if exists "Users can insert their own submission" on public.manuscript_submissions;
drop policy if exists "Authenticated users can insert their own submission" on public.manuscript_submissions;

revoke insert, update, delete on table public.manuscript_submissions from anon, authenticated;
