DROP POLICY IF EXISTS "Anyone can read editorial team" ON public.editorial_team;
CREATE POLICY "Authenticated users can read editorial team"
  ON public.editorial_team
  FOR SELECT
  TO authenticated
  USING (true);
REVOKE SELECT ON public.editorial_team FROM anon;