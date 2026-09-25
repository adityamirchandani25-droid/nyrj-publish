
DROP POLICY IF EXISTS "library_deny_all_select" ON storage.objects;
DROP POLICY IF EXISTS "library_deny_all_insert" ON storage.objects;
DROP POLICY IF EXISTS "library_deny_all_update" ON storage.objects;
DROP POLICY IF EXISTS "library_deny_all_delete" ON storage.objects;

CREATE POLICY "library_deny_all_select" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id <> 'library');

CREATE POLICY "library_deny_all_insert" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id <> 'library');

CREATE POLICY "library_deny_all_update" ON storage.objects
  FOR UPDATE TO anon, authenticated
  USING (bucket_id <> 'library')
  WITH CHECK (bucket_id <> 'library');

CREATE POLICY "library_deny_all_delete" ON storage.objects
  FOR DELETE TO anon, authenticated
  USING (bucket_id <> 'library');
