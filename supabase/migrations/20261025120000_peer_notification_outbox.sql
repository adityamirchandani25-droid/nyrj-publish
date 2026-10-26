BEGIN;

CREATE TABLE IF NOT EXISTS public.peer_notification_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key text NOT NULL UNIQUE,
  submission_id uuid REFERENCES public.manuscript_submissions(id) ON DELETE CASCADE,
  assignment_id uuid REFERENCES public.review_assignments(id) ON DELETE CASCADE,
  manuscript_version integer,
  event text NOT NULL,
  template text NOT NULL,
  recipient text NOT NULL,
  template_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  reply_to text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','provider_accepted','delivered','failed','retrying','cancelled')),
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz,
  provider_accepted_at timestamptz,
  delivered_at timestamptz,
  provider_message_id text,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS peer_notification_due_idx
  ON public.peer_notification_outbox (next_attempt_at, created_at)
  WHERE status IN ('pending','failed','retrying');
CREATE INDEX IF NOT EXISTS peer_notification_assignment_idx
  ON public.peer_notification_outbox (assignment_id, created_at DESC);
CREATE TABLE IF NOT EXISTS public.peer_notification_rollout (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  installed_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.peer_notification_rollout (id) VALUES (true) ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.peer_notification_rollout ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.peer_notification_rollout FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.peer_notification_rollout TO service_role;
ALTER TABLE public.peer_notification_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.peer_notification_outbox FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.peer_notification_outbox TO service_role;

-- Claim and increment in one transaction. An interrupted provider call remains
-- processing for staff inspection because its acceptance is unknowable.
CREATE OR REPLACE FUNCTION public.claim_peer_notification(p_id uuid)
RETURNS SETOF public.peer_notification_outbox
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY UPDATE public.peer_notification_outbox n
  SET status = 'processing', attempts = n.attempts + 1,
      claimed_at = now(), updated_at = now(), last_error = NULL
  WHERE n.id = p_id AND n.status IN ('pending','failed','retrying')
    AND n.next_attempt_at <= now()
  RETURNING n.*;
END $$;
REVOKE ALL ON FUNCTION public.claim_peer_notification(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_peer_notification(uuid) TO service_role;

COMMIT;
