CREATE TABLE public.initial_reviewers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  assigned_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.initial_reviewers TO service_role;

ALTER TABLE public.initial_reviewers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deny all client access to initial_reviewers"
ON public.initial_reviewers AS RESTRICTIVE FOR ALL
TO anon, authenticated USING (false) WITH CHECK (false);

INSERT INTO public.initial_reviewers (name, email) VALUES
  ('Jay', 'jay.amit.bapat@gmail.com'),
  ('Prahul', 'prakota3@gmail.com'),
  ('Nolen', 'nolengritz@gmail.com');

ALTER TABLE public.manuscript_submissions
  ADD COLUMN IF NOT EXISTS initial_reviewer_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS initial_reviewer_email text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS initial_reviewer_assigned_at timestamptz;