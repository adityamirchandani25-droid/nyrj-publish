ALTER TABLE public.chapters
  ADD COLUMN IF NOT EXISTS chapter_lead_2 text,
  ADD COLUMN IF NOT EXISTS chapter_lead_2_email text;

INSERT INTO public.site_settings (key, value, updated_at)
VALUES ('event_attendance', '60'::jsonb, now())
ON CONFLICT (key) DO NOTHING;