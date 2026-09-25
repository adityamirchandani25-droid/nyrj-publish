-- Revoke any client privileges on event_ideas. All access goes through
-- server functions using the service role (which bypasses RLS).
REVOKE ALL ON public.event_ideas FROM anon, authenticated, PUBLIC;
GRANT ALL ON public.event_ideas TO service_role;

-- Add an explicit restrictive deny-all policy for client roles so that even
-- if a permissive policy is added later, client roles still cannot read or
-- write student email addresses without first dropping this restriction.
DROP POLICY IF EXISTS "Deny all client access to event_ideas" ON public.event_ideas;
CREATE POLICY "Deny all client access to event_ideas"
  ON public.event_ideas
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

COMMENT ON TABLE public.event_ideas IS
  'Server-only table. Inserted exclusively via the eventIdeaSubmit server function using the service role. Client roles are denied by RLS and lack table privileges.';
