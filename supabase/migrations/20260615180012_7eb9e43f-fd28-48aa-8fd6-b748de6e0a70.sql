CREATE TABLE public.editorial_team (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  role text,
  affiliation text,
  bio text,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.editorial_team TO anon, authenticated;
GRANT ALL ON public.editorial_team TO service_role;
ALTER TABLE public.editorial_team ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read editorial team" ON public.editorial_team FOR SELECT TO anon, authenticated USING (true);
CREATE TRIGGER editorial_team_touch_updated_at BEFORE UPDATE ON public.editorial_team FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();