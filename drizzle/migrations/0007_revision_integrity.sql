-- Close links that were already used by the old revision flow, and normalize
-- still-open legacy links so the new status guard does not strand an author.
UPDATE public.manuscript_submissions
SET resubmit_token = NULL
WHERE resubmit_token IS NOT NULL
  AND current_version > 1
  AND status <> 'waiting for edits';

UPDATE public.manuscript_submissions
SET resubmit_token = NULL
WHERE resubmit_token IS NOT NULL
  AND (decision <> 'pending' OR deleted_at IS NOT NULL);

UPDATE public.manuscript_submissions
SET status = 'waiting for edits'
WHERE resubmit_token IS NOT NULL
  AND decision = 'pending'
  AND deleted_at IS NULL;

-- A paper can have only one stored file for each revision number. This makes
-- concurrent finalize requests safe and supports idempotent version snapshots.
CREATE UNIQUE INDEX IF NOT EXISTS manuscript_versions_submission_version_key
  ON public.manuscript_versions (submission_id, version);

-- Resubmission links belong to exactly one paper. Null means there is no open
-- revision window; the token is cleared after a successful upload.
CREATE UNIQUE INDEX IF NOT EXISTS manuscript_submissions_resubmit_token_key
  ON public.manuscript_submissions (resubmit_token)
  WHERE resubmit_token IS NOT NULL;
