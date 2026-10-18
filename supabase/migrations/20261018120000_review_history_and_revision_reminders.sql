BEGIN;

CREATE TABLE IF NOT EXISTS public.review_feedback_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.review_assignments(id) ON DELETE CASCADE,
  submission_id uuid NOT NULL REFERENCES public.manuscript_submissions(id) ON DELETE CASCADE,
  comments text NOT NULL DEFAULT '',
  file_path text,
  file_name text,
  submitted_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  notification_required boolean NOT NULL DEFAULT true,
  CHECK (btrim(comments) <> '' OR file_path IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS review_feedback_versions_assignment_idx
  ON public.review_feedback_versions (assignment_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS review_feedback_versions_submission_idx
  ON public.review_feedback_versions (submission_id, recorded_at DESC);

-- A durable per-feedback, per-recipient outbox also covers reviews recorded by email.
CREATE TABLE IF NOT EXISTS public.review_staff_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL REFERENCES public.review_feedback_versions(id) ON DELETE CASCADE,
  recipient text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sending','sent','failed')),
  claimed_at timestamptz,
  sent_at timestamptz,
  error text,
  UNIQUE(version_id, recipient)
);
CREATE INDEX IF NOT EXISTS review_staff_notifications_pending_idx
  ON public.review_staff_notifications (status, claimed_at);

ALTER TABLE public.manuscript_submissions
  ADD COLUMN IF NOT EXISTS revision_reminders_paused boolean NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS public.revision_reminder_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.manuscript_submissions(id) ON DELETE CASCADE,
  revision_requested_at timestamptz NOT NULL,
  reminder_number integer NOT NULL CHECK (reminder_number BETWEEN 1 AND 5),
  recipient text NOT NULL,
  status text NOT NULL DEFAULT 'sending' CHECK (status IN ('sending','sent','failed','cancelled')),
  attempted_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  error text,
  UNIQUE(submission_id, revision_requested_at, reminder_number)
);
CREATE INDEX IF NOT EXISTS revision_reminder_log_paper_idx
  ON public.revision_reminder_log (submission_id, attempted_at DESC);

ALTER TABLE public.review_feedback_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_staff_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revision_reminder_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.review_feedback_versions, public.review_staff_notifications, public.revision_reminder_log FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.review_feedback_versions, public.review_staff_notifications, public.revision_reminder_log TO service_role;

-- Preserve all surviving historical feedback. Overwritten pre-migration rounds
-- cannot be reconstructed; raw email replies remain available separately.
INSERT INTO public.review_feedback_versions (assignment_id, submission_id, comments, file_path, file_name, submitted_at, notification_required)
SELECT a.id, a.submission_id, coalesce(a.review_comments,''), a.review_file_path, a.review_file_name,
       coalesce(a.review_submitted_at,a.edits_sent_at,a.responded_at,a.assigned_at), a.status='review_received'
FROM public.review_assignments a
WHERE (btrim(coalesce(a.review_comments,'')) <> '' OR a.review_file_path IS NOT NULL)
  AND NOT EXISTS (SELECT 1 FROM public.review_feedback_versions v WHERE v.assignment_id=a.id);

CREATE OR REPLACE FUNCTION public.capture_review_feedback() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.review_submitted_at IS NOT NULL AND
     (TG_OP = 'INSERT' OR NEW.review_submitted_at IS DISTINCT FROM OLD.review_submitted_at
       OR NEW.review_comments IS DISTINCT FROM OLD.review_comments
       OR NEW.review_file_path IS DISTINCT FROM OLD.review_file_path) AND
     (btrim(coalesce(NEW.review_comments,'')) <> '' OR NEW.review_file_path IS NOT NULL) THEN
    INSERT INTO public.review_feedback_versions (assignment_id,submission_id,comments,file_path,file_name,submitted_at)
    VALUES (NEW.id,NEW.submission_id,coalesce(NEW.review_comments,''),NEW.review_file_path,NEW.review_file_name,NEW.review_submitted_at);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS capture_review_feedback ON public.review_assignments;
CREATE TRIGGER capture_review_feedback AFTER INSERT OR UPDATE ON public.review_assignments
FOR EACH ROW EXECUTE FUNCTION public.capture_review_feedback();

-- Preserve tracking-only legacy records as full manuscripts so their revision
-- windows get the same reminders and history. Existing title/email matches win.
ALTER TABLE public.manuscript_submissions ADD COLUMN IF NOT EXISTS legacy_tracking_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS manuscript_submissions_legacy_tracking_idx
  ON public.manuscript_submissions (legacy_tracking_id) WHERE legacy_tracking_id IS NOT NULL;
INSERT INTO public.manuscript_submissions
  (submitter_email,title,status,decision,created_at,updated_at,legacy_tracking_id,comments)
SELECT s.student_email,s.manuscript_name,s.status,s.decision,s.created_at,s.updated_at,s.id,
  'Imported from legacy submission tracking; no manuscript file was stored in that record.'
FROM public.submissions s WHERE NOT EXISTS (
  SELECT 1 FROM public.manuscript_submissions m WHERE m.legacy_tracking_id=s.id OR
  (lower(trim(m.submitter_email))=lower(trim(s.student_email)) AND lower(trim(m.title))=lower(trim(s.manuscript_name)))
);

-- Backfill open revision windows, retaining known dates and prior reminders.
UPDATE public.manuscript_submissions m SET
  revision_requested_at = coalesce(m.revision_requested_at,
    (SELECT max(a.edits_sent_at) FROM public.review_assignments a WHERE a.submission_id=m.id),
    m.updated_at,m.created_at,now()),
  resubmit_token = coalesce(m.resubmit_token,replace(gen_random_uuid()::text || gen_random_uuid()::text,'-',''))
WHERE m.status='waiting for edits' AND m.decision <> 'declined' AND m.deleted_at IS NULL;
INSERT INTO public.revision_reminder_log (submission_id,revision_requested_at,reminder_number,recipient,status,attempted_at,sent_at)
SELECT id,revision_requested_at,1,submitter_email,'sent',revision_reminder_sent_at,revision_reminder_sent_at
FROM public.manuscript_submissions
WHERE revision_requested_at IS NOT NULL AND revision_reminder_sent_at IS NOT NULL
ON CONFLICT DO NOTHING;

-- All entry points (staff status change, editorial edits, peer feedback) use
-- the same round. Re-emailing feedback must not restart a round or its cap.
CREATE OR REPLACE FUNCTION public.manage_revision_round() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status='waiting for edits' AND NEW.decision <> 'declined' AND NEW.deleted_at IS NULL THEN
    IF OLD.status IS DISTINCT FROM 'waiting for edits' OR OLD.revision_requested_at IS NULL THEN
      NEW.revision_requested_at := now();
      NEW.revision_reminder_sent_at := NULL;
      NEW.revision_staff_alert_sent_at := NULL;
      NEW.revision_reminders_paused := false;
    ELSE
      NEW.revision_requested_at := OLD.revision_requested_at;
      NEW.revision_reminder_sent_at := OLD.revision_reminder_sent_at;
      NEW.revision_staff_alert_sent_at := OLD.revision_staff_alert_sent_at;
    END IF;
    NEW.resubmit_token := coalesce(NEW.resubmit_token,replace(gen_random_uuid()::text || gen_random_uuid()::text,'-',''));
  ELSE
    NEW.resubmit_token := NULL;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS manage_revision_round ON public.manuscript_submissions;
CREATE TRIGGER manage_revision_round BEFORE UPDATE ON public.manuscript_submissions
FOR EACH ROW EXECUTE FUNCTION public.manage_revision_round();

-- Reopen each prior reviewer when an author actually uploads a new revision.
CREATE OR REPLACE FUNCTION public.reopen_reviews_after_resubmission() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.status='waiting for edits' AND NEW.status='secondary review'
     AND NEW.current_version IS DISTINCT FROM OLD.current_version THEN
    UPDATE public.review_assignments SET status='accepted',due_at=now()+interval '15 days'
    WHERE submission_id=NEW.id AND status='sent_to_author';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS reopen_reviews_after_resubmission ON public.manuscript_submissions;
CREATE TRIGGER reopen_reviews_after_resubmission AFTER UPDATE ON public.manuscript_submissions
FOR EACH ROW EXECUTE FUNCTION public.reopen_reviews_after_resubmission();

-- Existing second-round papers also need their reviewers reopened.
UPDATE public.review_assignments a SET status='accepted',due_at=now()+interval '15 days'
FROM public.manuscript_submissions m
WHERE a.submission_id=m.id AND a.status='sent_to_author' AND m.status='secondary review'
  AND m.current_version>1 AND m.decision <> 'declined' AND m.deleted_at IS NULL;

-- Atomically reserve the next reminder. Row locks prevent overlapping cron runs.
CREATE OR REPLACE FUNCTION public.claim_revision_reminder(p_submission_id uuid) RETURNS jsonb
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE m public.manuscript_submissions; n integer; last_sent timestamptz; log_id uuid;
BEGIN
  SELECT * INTO m FROM public.manuscript_submissions WHERE id=p_submission_id FOR UPDATE;
  IF NOT FOUND OR m.status <> 'waiting for edits' OR m.decision='declined' OR m.deleted_at IS NOT NULL
    OR m.revision_reminders_paused OR m.resubmit_token IS NULL OR m.revision_requested_at IS NULL THEN RETURN NULL; END IF;
  -- An ambiguous in-flight delivery is never retried automatically: staff can
  -- inspect SendGrid and the log before resolving it, avoiding duplicate mail.
  IF EXISTS (SELECT 1 FROM public.revision_reminder_log WHERE submission_id=m.id
    AND revision_requested_at=m.revision_requested_at AND status='sending') THEN RETURN NULL; END IF;
  SELECT coalesce(max(reminder_number) FILTER (WHERE status='sent'),0)+1,max(coalesce(sent_at,attempted_at)) INTO n,last_sent
    FROM public.revision_reminder_log WHERE submission_id=m.id AND revision_requested_at=m.revision_requested_at;
  IF n>5 OR coalesce(last_sent,m.revision_requested_at)>now()-interval '3 days' THEN RETURN NULL; END IF;
  INSERT INTO public.revision_reminder_log (submission_id,revision_requested_at,reminder_number,recipient)
    VALUES (m.id,m.revision_requested_at,n,m.submitter_email)
    ON CONFLICT (submission_id,revision_requested_at,reminder_number) DO UPDATE
      SET status='sending',attempted_at=now(),error=NULL
      WHERE revision_reminder_log.status IN ('failed','cancelled')
    RETURNING id INTO log_id;
  IF log_id IS NULL THEN RETURN NULL; END IF;
  RETURN jsonb_build_object('id',log_id,'number',n,'title',m.title,'email',m.submitter_email,
    'token',m.resubmit_token,'requestedAt',m.revision_requested_at);
END $$;
REVOKE ALL ON FUNCTION public.capture_review_feedback(), public.manage_revision_round(), public.reopen_reviews_after_resubmission(), public.claim_revision_reminder(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_revision_reminder(uuid) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
