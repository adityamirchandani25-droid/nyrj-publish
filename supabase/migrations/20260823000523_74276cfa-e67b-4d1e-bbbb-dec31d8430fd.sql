CREATE TABLE IF NOT EXISTS public.sponsors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  tier TEXT NOT NULL DEFAULT 'supporter',
  website TEXT,
  blurb TEXT,
  logo_path TEXT,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sponsors TO anon;
GRANT SELECT ON public.sponsors TO authenticated;
GRANT ALL ON public.sponsors TO service_role;
ALTER TABLE public.sponsors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Sponsors are publicly readable" ON public.sponsors;
CREATE POLICY "Sponsors are publicly readable" ON public.sponsors FOR SELECT TO anon, authenticated USING (true);