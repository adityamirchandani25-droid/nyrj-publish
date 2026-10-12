-- Messages imported from the journal Gmail mailbox. The Gmail message ID
-- prevents the daily sync from showing the same reply more than once.
CREATE TABLE IF NOT EXISTS public.peer_review_email_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gmail_message_id text NOT NULL UNIQUE,
  assignment_id uuid NOT NULL REFERENCES public.review_assignments(id) ON DELETE CASCADE,
  from_email text NOT NULL,
  subject text NOT NULL DEFAULT '',
  body_text text NOT NULL DEFAULT '',
  received_at timestamptz NOT NULL,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS peer_review_email_replies_assignment_idx
  ON public.peer_review_email_replies (assignment_id, received_at DESC);

GRANT ALL ON public.peer_review_email_replies TO service_role;
ALTER TABLE public.peer_review_email_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deny client access to peer review email replies"
  ON public.peer_review_email_replies AS RESTRICTIVE FOR ALL
  TO anon, authenticated USING (false) WITH CHECK (false);
