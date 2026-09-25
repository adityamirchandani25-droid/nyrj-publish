CREATE TABLE public.advisors (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  title text,
  affiliation text,
  bio text,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.advisors TO anon, authenticated;
GRANT ALL ON public.advisors TO service_role;
ALTER TABLE public.advisors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read advisors" ON public.advisors FOR SELECT TO anon, authenticated USING (true);
CREATE TRIGGER advisors_touch_updated_at BEFORE UPDATE ON public.advisors FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();