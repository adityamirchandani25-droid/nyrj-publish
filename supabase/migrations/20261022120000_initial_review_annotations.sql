-- Optional annotated manuscripts returned by initial reviewers; staff approve before delivery.
ALTER TABLE public.editor_recommendations
  ADD COLUMN IF NOT EXISTS review_file_path text,
  ADD COLUMN IF NOT EXISTS review_file_name text;
