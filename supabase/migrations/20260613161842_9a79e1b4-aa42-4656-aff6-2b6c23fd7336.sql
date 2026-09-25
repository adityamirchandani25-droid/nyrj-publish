CREATE TABLE public.guidance_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  url text NOT NULL,
  provider text NOT NULL,
  embed_id text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.guidance_videos TO anon, authenticated;
GRANT ALL ON public.guidance_videos TO service_role;

ALTER TABLE public.guidance_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read guidance videos"
  ON public.guidance_videos FOR SELECT
  TO anon, authenticated
  USING (true);