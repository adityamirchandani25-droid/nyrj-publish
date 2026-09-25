CREATE TABLE public.library_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  authors text NOT NULL,
  issue text,
  topic text,
  grade text,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  file_path text NOT NULL,
  added_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.library_entries TO service_role;

ALTER TABLE public.library_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deny all client access to library_entries"
  ON public.library_entries
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);