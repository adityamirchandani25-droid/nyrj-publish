-- Run inside a rollback-only transaction after the migration. No emails sent.
DO $$
DECLARE paper uuid := gen_random_uuid(); assignment uuid := gen_random_uuid(); claim jsonb; round_at timestamptz; v_count integer; i integer;
BEGIN
  INSERT INTO public.manuscript_submissions(id,title,submitter_email,status,decision,current_version,revision_requested_at,resubmit_token)
    VALUES(paper,'Workflow regression fixture','workflow-test@example.invalid','waiting for edits','pending',1,now()-interval '4 days','test-'||paper::text);
  INSERT INTO public.review_assignments(id,submission_id,reviewer_email,invite_token,status)
    VALUES(assignment,paper,'reviewer@example.invalid','test-invite-'||assignment::text,'accepted');
  UPDATE public.review_assignments SET review_comments='',review_file_path='test/round-one.pdf',review_file_name='round-one.pdf',review_submitted_at=now(),status='review_received' WHERE id=assignment;
  UPDATE public.review_assignments SET review_comments='Text only second round',review_file_path=NULL,review_file_name=NULL,review_submitted_at=now()+interval '1 second' WHERE id=assignment;
  SELECT count(*) INTO v_count FROM public.review_feedback_versions WHERE assignment_id=assignment;
  IF v_count<>2 THEN RAISE EXCEPTION 'Feedback rounds were not preserved'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.review_feedback_versions WHERE assignment_id=assignment AND file_path='test/round-one.pdf' AND comments='') THEN RAISE EXCEPTION 'Attachment-only feedback lost'; END IF;
  UPDATE public.review_assignments SET edits_sent_at=now(),status='sent_to_author' WHERE id=assignment;
  IF (SELECT count(*) FROM public.review_feedback_versions WHERE assignment_id=assignment)<>2 THEN RAISE EXCEPTION 'Unrelated update created a feedback version'; END IF;

  SELECT revision_requested_at INTO round_at FROM public.manuscript_submissions WHERE id=paper;
  UPDATE public.manuscript_submissions SET revision_requested_at=now(),revision_reminder_sent_at=NULL WHERE id=paper;
  IF (SELECT revision_requested_at FROM public.manuscript_submissions WHERE id=paper)<>round_at THEN RAISE EXCEPTION 'Re-email reset the revision round'; END IF;
  UPDATE public.manuscript_submissions SET revision_reminders_paused=true WHERE id=paper;
  IF public.claim_revision_reminder(paper) IS NOT NULL THEN RAISE EXCEPTION 'Paused paper received reminder'; END IF;
  UPDATE public.manuscript_submissions SET revision_reminders_paused=false WHERE id=paper;
  claim:=public.claim_revision_reminder(paper);
  IF claim IS NULL OR (claim->>'number')::int<>1 THEN RAISE EXCEPTION 'Due reminder not claimed'; END IF;
  IF public.claim_revision_reminder(paper) IS NOT NULL THEN RAISE EXCEPTION 'Concurrent claim was not excluded'; END IF;
  UPDATE public.revision_reminder_log SET status='sent',sent_at=now() WHERE id=(claim->>'id')::uuid;
  IF public.claim_revision_reminder(paper) IS NOT NULL THEN RAISE EXCEPTION 'Three-day interval not enforced'; END IF;
  FOR i IN 2..5 LOOP
    UPDATE public.revision_reminder_log SET attempted_at=now()-interval '4 days',sent_at=now()-interval '4 days' WHERE submission_id=paper;
    claim:=public.claim_revision_reminder(paper);
    IF claim IS NULL OR (claim->>'number')::int<>i THEN RAISE EXCEPTION 'Wrong reminder sequence at %',i; END IF;
    UPDATE public.revision_reminder_log SET status='sent',sent_at=now() WHERE id=(claim->>'id')::uuid;
  END LOOP;
  UPDATE public.revision_reminder_log SET attempted_at=now()-interval '4 days',sent_at=now()-interval '4 days' WHERE submission_id=paper;
  IF public.claim_revision_reminder(paper) IS NOT NULL THEN RAISE EXCEPTION 'Five-reminder cap not enforced'; END IF;
  UPDATE public.manuscript_submissions SET current_version=2,status='secondary review' WHERE id=paper;
  IF public.claim_revision_reminder(paper) IS NOT NULL THEN RAISE EXCEPTION 'Resubmitted paper received reminder'; END IF;
  IF (SELECT status FROM public.review_assignments WHERE id=assignment)<>'accepted' THEN RAISE EXCEPTION 'Reviewer not reopened for new revision'; END IF;
  IF (SELECT resubmit_token FROM public.manuscript_submissions WHERE id=paper) IS NOT NULL THEN RAISE EXCEPTION 'Resubmission token not revoked'; END IF;
  UPDATE public.manuscript_submissions SET status='waiting for edits' WHERE id=paper;
  IF (SELECT revision_requested_at FROM public.manuscript_submissions WHERE id=paper)=round_at THEN RAISE EXCEPTION 'New round reused old round'; END IF;
  IF public.claim_revision_reminder(paper) IS NOT NULL THEN RAISE EXCEPTION 'New round sent reminder immediately'; END IF;
  IF has_table_privilege('anon','public.review_feedback_versions','SELECT') OR has_table_privilege('authenticated','public.revision_reminder_log','SELECT') OR has_function_privilege('anon','public.claim_revision_reminder(uuid)','EXECUTE') THEN RAISE EXCEPTION 'Private workflow exposed to public roles'; END IF;
END $$;
SELECT 'feedback versions, file-only feedback, round preservation, pause, overlap exclusion, 3-day spacing, 5-reminder cap, resubmission stop, reviewer reopening, and private grants passed' AS workflow_regression;
