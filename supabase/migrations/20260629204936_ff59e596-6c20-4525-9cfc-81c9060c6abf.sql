
-- Allow authenticated users to create submissions; staff (service role) handles updates
CREATE POLICY "Authenticated users can insert their own submission"
ON public.manuscript_submissions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can view their own submissions"
ON public.manuscript_submissions
FOR SELECT
TO authenticated
USING (submitter_email = (auth.jwt() ->> 'email'));

-- Storage policies for submissions bucket (private). Users may upload/read inside a folder named with their user id.
CREATE POLICY "Authenticated users can upload to own submissions folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'submissions'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can read their own submission files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'submissions'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
