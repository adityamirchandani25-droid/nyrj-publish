
-- 1. Library entries: add DOI, NYRJ ID, featured, citation_count
ALTER TABLE public.library_entries
  ADD COLUMN IF NOT EXISTS doi text,
  ADD COLUMN IF NOT EXISTS nyrj_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS citation_count integer NOT NULL DEFAULT 0;

-- NYRJ ID auto-assign sequence + trigger (format SP-#####, starting at 10001)
CREATE SEQUENCE IF NOT EXISTS public.nyrj_id_seq START 10001;

CREATE OR REPLACE FUNCTION public.assign_nyrj_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.nyrj_id IS NULL THEN
    NEW.nyrj_id := 'SP-' || lpad(nextval('public.nyrj_id_seq')::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_library_entries_nyrj_id ON public.library_entries;
CREATE TRIGGER trg_library_entries_nyrj_id
  BEFORE INSERT ON public.library_entries
  FOR EACH ROW EXECUTE FUNCTION public.assign_nyrj_id();

-- Backfill existing rows
UPDATE public.library_entries
SET nyrj_id = 'SP-' || lpad(nextval('public.nyrj_id_seq')::text, 5, '0')
WHERE nyrj_id IS NULL;

-- Citation increment RPC (public; safe atomic counter)
CREATE OR REPLACE FUNCTION public.increment_citation_count(_id uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.library_entries
  SET citation_count = citation_count + 1
  WHERE id = _id
  RETURNING citation_count;
$$;

GRANT EXECUTE ON FUNCTION public.increment_citation_count(uuid) TO anon, authenticated;

-- 2. Manuscript submissions
CREATE TABLE IF NOT EXISTS public.manuscript_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submitter_email text NOT NULL,
  title text NOT NULL,
  abstract text,
  research_type text,
  comments text,
  authors jsonb NOT NULL DEFAULT '[]'::jsonb,
  conflict_of_interest boolean NOT NULL DEFAULT false,
  conflict_explanation text,
  funding boolean NOT NULL DEFAULT false,
  funding_source text,
  used_gen_ai boolean NOT NULL DEFAULT false,
  gen_ai_explanation text,
  manuscript_path text,
  manuscript_filename text,
  supplementary_paths jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'submitted',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.manuscript_submissions TO authenticated;
GRANT ALL ON public.manuscript_submissions TO service_role;

ALTER TABLE public.manuscript_submissions ENABLE ROW LEVEL SECURITY;

-- No client-side policies (all access via service role server functions)
CREATE POLICY "service role manages submissions"
  ON public.manuscript_submissions FOR ALL
  USING (false) WITH CHECK (false);

CREATE TRIGGER trg_manuscript_submissions_updated_at
  BEFORE UPDATE ON public.manuscript_submissions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3. Team members
CREATE TABLE IF NOT EXISTS public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  role text NOT NULL,
  bio text,
  photo_path text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.team_members TO anon, authenticated;
GRANT ALL ON public.team_members TO service_role;

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public can read team members"
  ON public.team_members FOR SELECT
  USING (true);

CREATE TRIGGER trg_team_members_updated_at
  BEFORE UPDATE ON public.team_members
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Seed founders
INSERT INTO public.team_members (name, role, bio, sort_order) VALUES
  ('Madhav Arora', 'Founder & CEO', 'Tired of his own research going to waste because there was nowhere to publish it, Madhav founded NYRJ to build the kind of student research journal he wanted to be able to publish in. He oversees publicity, publishing, and the journal''s editorial direction.', 1),
  ('Keyaan Merchant', 'Co-Founder & COO', 'A precise editor with a sharp ear for argument, Keyaan leads manuscript review and outward communication. He works directly with authors and reviewers to make sure every published piece is clear, rigorous, and original.', 2)
ON CONFLICT DO NOTHING;
