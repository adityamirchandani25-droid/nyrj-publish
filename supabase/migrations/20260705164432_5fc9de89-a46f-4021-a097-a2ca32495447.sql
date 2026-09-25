ALTER TABLE public.manuscript_submissions
  ADD COLUMN IF NOT EXISTS decision text NOT NULL DEFAULT 'pending';