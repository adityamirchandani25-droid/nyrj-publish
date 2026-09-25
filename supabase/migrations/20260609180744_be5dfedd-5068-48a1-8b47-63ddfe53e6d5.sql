
CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  location text,
  event_date date,
  poster_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.events TO anon, authenticated;
GRANT ALL ON public.events TO service_role;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read events" ON public.events FOR SELECT TO anon, authenticated USING (true);
CREATE TRIGGER touch_events_updated BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.event_ideas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_email text NOT NULL,
  title text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.event_ideas TO service_role;
ALTER TABLE public.event_ideas ENABLE ROW LEVEL SECURITY;
-- No anon/authenticated policies; all inserts/reads go through service-role server functions.
