DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "event_posters_deny_select" ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS "event_posters_deny_insert" ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS "event_posters_deny_update" ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS "event_posters_deny_delete" ON storage.objects';
END $$;

DROP POLICY IF EXISTS "library_deny_all_select" ON storage.objects;
DROP POLICY IF EXISTS "library_deny_all_insert" ON storage.objects;
DROP POLICY IF EXISTS "library_deny_all_update" ON storage.objects;
DROP POLICY IF EXISTS "library_deny_all_delete" ON storage.objects;