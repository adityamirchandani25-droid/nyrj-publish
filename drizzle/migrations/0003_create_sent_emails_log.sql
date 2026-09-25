CREATE TABLE public.sent_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  template text NOT NULL,
  to_email text NOT NULL,
  subject text NOT NULL,
  html text,
  text_body text,
  reply_to text,
  status text NOT NULL DEFAULT 'sent',
  error text
);

CREATE INDEX sent_emails_created_at_idx ON public.sent_emails (created_at DESC);
CREATE INDEX sent_emails_to_email_idx ON public.sent_emails (lower(to_email));

GRANT ALL ON public.sent_emails TO service_role;

ALTER TABLE public.sent_emails ENABLE ROW LEVEL SECURITY;