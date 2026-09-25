-- Deny all client access to private storage buckets (server admin bypasses RLS)
DROP POLICY IF EXISTS "Deny all client access to library bucket" ON storage.objects;
DROP POLICY IF EXISTS "Deny all client access to event-posters bucket" ON storage.objects;

CREATE POLICY "Deny all client access to library bucket"
  ON storage.objects
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (bucket_id <> 'library')
  WITH CHECK (bucket_id <> 'library');

CREATE POLICY "Deny all client access to event-posters bucket"
  ON storage.objects
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (bucket_id <> 'event-posters')
  WITH CHECK (bucket_id <> 'event-posters');

-- Prevent users from changing their profile email to someone else's address
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id AND email = (auth.jwt() ->> 'email'));