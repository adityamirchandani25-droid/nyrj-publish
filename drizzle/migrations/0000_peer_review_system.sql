-- Keywords / research domain on submissions
ALTER TABLE public.manuscript_submissions
  ADD COLUMN IF NOT EXISTS keywords TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS research_domain TEXT NOT NULL DEFAULT '';

-- Peer reviewer accounts (self-registered, staff-approved)
CREATE TABLE IF NOT EXISTS public.peer_reviewers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  expertise TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ
);

GRANT ALL ON public.peer_reviewers TO service_role;
ALTER TABLE public.peer_reviewers ENABLE ROW LEVEL SECURITY;

-- Review assignments
CREATE TABLE IF NOT EXISTS public.review_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES public.manuscript_submissions(id) ON DELETE CASCADE,
  reviewer_email TEXT NOT NULL,
  reviewer_name TEXT NOT NULL DEFAULT '',
  invite_token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'invited',
  assigned_by TEXT NOT NULL DEFAULT '',
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  due_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '15 days'),
  responded_at TIMESTAMPTZ,
  review_comments TEXT NOT NULL DEFAULT '',
  review_submitted_at TIMESTAMPTZ,
  edits_sent_at TIMESTAMPTZ,
  edits_sent_body TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS review_assignments_submission_idx ON public.review_assignments(submission_id);
CREATE INDEX IF NOT EXISTS review_assignments_email_idx ON public.review_assignments(lower(reviewer_email));

GRANT ALL ON public.review_assignments TO service_role;
ALTER TABLE public.review_assignments ENABLE ROW LEVEL SECURITY;

-- Simple audit trail
CREATE TABLE IF NOT EXISTS public.review_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID REFERENCES public.manuscript_submissions(id) ON DELETE CASCADE,
  actor TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS review_audit_submission_idx ON public.review_audit_log(submission_id, created_at DESC);

GRANT ALL ON public.review_audit_log TO service_role;
ALTER TABLE public.review_audit_log ENABLE ROW LEVEL SECURITY;
