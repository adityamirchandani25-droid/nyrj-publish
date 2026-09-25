
DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "event_posters_deny_select" ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS "event_posters_deny_insert" ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS "event_posters_deny_update" ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS "event_posters_deny_delete" ON storage.objects';
END $$;

CREATE POLICY "event_posters_deny_select" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id <> 'event-posters');
CREATE POLICY "event_posters_deny_insert" ON storage.objects FOR INSERT TO anon, authenticated WITH CHECK (bucket_id <> 'event-posters');
CREATE POLICY "event_posters_deny_update" ON storage.objects FOR UPDATE TO anon, authenticated USING (bucket_id <> 'event-posters');
CREATE POLICY "event_posters_deny_delete" ON storage.objects FOR DELETE TO anon, authenticated USING (bucket_id <> 'event-posters');
