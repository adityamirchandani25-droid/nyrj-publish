-- Close links that were already used by the old revision flow, and normalize
-- still-open legacy links so the new status guard does not strand an author.
update public.manuscript_submissions
set resubmit_token = null
where resubmit_token is not null
  and current_version > 1
  and status <> 'waiting for edits';

update public.manuscript_submissions
set resubmit_token = null
where resubmit_token is not null
  and (decision <> 'pending' or deleted_at is not null);

update public.manuscript_submissions
set status = 'waiting for edits'
where resubmit_token is not null
  and decision = 'pending'
  and deleted_at is null;

-- A paper can have only one stored file for each revision number. This makes
-- concurrent finalize requests safe and supports idempotent version snapshots.
create unique index if not exists manuscript_versions_submission_version_key
  on public.manuscript_versions (submission_id, version);

-- Resubmission links belong to exactly one paper. Null means there is no open
-- revision window; the token is cleared after a successful upload.
create unique index if not exists manuscript_submissions_resubmit_token_key
  on public.manuscript_submissions (resubmit_token)
  where resubmit_token is not null;
