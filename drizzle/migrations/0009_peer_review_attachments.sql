-- Reviewer uploads remain private until staff approves them for the author.
ALTER TABLE public.review_assignments
  ADD COLUMN IF NOT EXISTS review_file_path TEXT,
  ADD COLUMN IF NOT EXISTS review_file_name TEXT,
  ADD COLUMN IF NOT EXISTS edits_sent_file_path TEXT,
  ADD COLUMN IF NOT EXISTS edits_sent_file_name TEXT;

UPDATE public.manuscript_submissions AS m
SET decision = 'pending', status = 'editorial review'
WHERE m.decision = 'accepted'
  AND m.status IN ('initial review', 'editorial review')
  AND m.deleted_at IS NULL
  AND EXISTS (
    SELECT 1 FROM public.editor_recommendations AS r
    WHERE r.submission_id = m.id AND r.action = 'accept' AND r.status = 'approved'
  );
