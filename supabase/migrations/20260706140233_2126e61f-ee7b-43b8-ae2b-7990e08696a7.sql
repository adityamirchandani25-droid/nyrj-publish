ALTER TABLE public.manuscript_submissions
  ADD COLUMN IF NOT EXISTS is_original boolean,
  ADD COLUMN IF NOT EXISTS not_under_consideration boolean,
  ADD COLUMN IF NOT EXISTS has_human_or_vertebrate boolean,
  ADD COLUMN IF NOT EXISTS consent_form_paths jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS data_availability text,
  ADD COLUMN IF NOT EXISTS all_authors_consent boolean,
  ADD COLUMN IF NOT EXISTS research_type_other text;