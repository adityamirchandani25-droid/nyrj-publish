CREATE POLICY "Public can read library files"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'library');