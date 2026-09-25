CREATE TABLE public.editor_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  username text NOT NULL,
  password_hash text NOT NULL,
  password_salt text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz
);
CREATE UNIQUE INDEX editor_accounts_email_key ON public.editor_accounts (lower(email));
CREATE UNIQUE INDEX editor_accounts_username_key ON public.editor_accounts (lower(username));
GRANT ALL ON public.editor_accounts TO service_role;
ALTER TABLE public.editor_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Deny all client access to editor_accounts" ON public.editor_accounts AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE TABLE public.editor_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.manuscript_submissions(id) ON DELETE CASCADE,
  editor_name text NOT NULL DEFAULT '',
  editor_email text NOT NULL DEFAULT '',
  action text NOT NULL,
  comments text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by text NOT NULL DEFAULT '',
  staff_message text NOT NULL DEFAULT ''
);
CREATE INDEX editor_recommendations_submission_idx ON public.editor_recommendations (submission_id);
GRANT ALL ON public.editor_recommendations TO service_role;
ALTER TABLE public.editor_recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Deny all client access to editor_recommendations" ON public.editor_recommendations AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE TABLE public.manuscript_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.manuscript_submissions(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1,
  manuscript_path text NOT NULL DEFAULT '',
  manuscript_filename text NOT NULL DEFAULT '',
  label text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX manuscript_versions_submission_idx ON public.manuscript_versions (submission_id);
GRANT ALL ON public.manuscript_versions TO service_role;
ALTER TABLE public.manuscript_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Deny all client access to manuscript_versions" ON public.manuscript_versions AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

ALTER TABLE public.manuscript_submissions
  ADD COLUMN IF NOT EXISTS resubmit_token text,
  ADD COLUMN IF NOT EXISTS current_version integer NOT NULL DEFAULT 1;
CREATE INDEX IF NOT EXISTS manuscript_submissions_resubmit_token_idx ON public.manuscript_submissions (resubmit_token);