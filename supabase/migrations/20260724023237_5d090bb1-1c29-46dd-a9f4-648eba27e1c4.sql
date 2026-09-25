
CREATE TABLE public.chapters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_number int NOT NULL UNIQUE,
  school_name text NOT NULL,
  location text,
  chapter_lead text,
  new_students_this_year int NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.chapters TO anon, authenticated;
GRANT ALL ON public.chapters TO service_role;
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Chapters are publicly readable" ON public.chapters FOR SELECT USING (true);
CREATE TRIGGER chapters_touch_updated BEFORE UPDATE ON public.chapters FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.site_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.site_settings TO anon, authenticated;
GRANT ALL ON public.site_settings TO service_role;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Site settings are publicly readable" ON public.site_settings FOR SELECT USING (true);
CREATE TRIGGER site_settings_touch_updated BEFORE UPDATE ON public.site_settings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
