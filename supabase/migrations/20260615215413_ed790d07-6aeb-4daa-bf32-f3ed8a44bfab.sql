ALTER TABLE public.advisors ADD COLUMN photo_url text;

CREATE POLICY "Allow public read on advisor photos"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'advisor-photos');