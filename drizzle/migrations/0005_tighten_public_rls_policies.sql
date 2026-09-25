-- All public site content is served through server functions using the service
-- role, so direct client-role read access to these tables is not required.
DROP POLICY IF EXISTS "public can read team members" ON public.team_members;
DROP POLICY IF EXISTS "Anyone can read advisors" ON public.advisors;
DROP POLICY IF EXISTS "Site settings are publicly readable" ON public.site_settings;
DROP POLICY IF EXISTS "Authenticated users can read editorial team" ON public.editorial_team;
DROP POLICY IF EXISTS "Anyone can read events" ON public.events;
DROP POLICY IF EXISTS "Anyone can read guidance videos" ON public.guidance_videos;
DROP POLICY IF EXISTS "Public can read library entries" ON public.library_entries;
DROP POLICY IF EXISTS "Sponsors are publicly readable" ON public.sponsors;

REVOKE SELECT ON public.team_members FROM anon, authenticated;
REVOKE SELECT ON public.advisors FROM anon, authenticated;
REVOKE SELECT ON public.site_settings FROM anon, authenticated;
REVOKE SELECT ON public.editorial_team FROM anon, authenticated;
REVOKE SELECT ON public.events FROM anon, authenticated;
REVOKE SELECT ON public.guidance_videos FROM anon, authenticated;
REVOKE SELECT ON public.library_entries FROM anon, authenticated;
REVOKE SELECT ON public.sponsors FROM anon, authenticated;

GRANT ALL ON public.team_members TO service_role;
GRANT ALL ON public.advisors TO service_role;
GRANT ALL ON public.site_settings TO service_role;
GRANT ALL ON public.editorial_team TO service_role;
GRANT ALL ON public.events TO service_role;
GRANT ALL ON public.guidance_videos TO service_role;
GRANT ALL ON public.library_entries TO service_role;
GRANT ALL ON public.sponsors TO service_role;

-- Submissions can only be inserted for the caller's own email address.
DROP POLICY IF EXISTS "Authenticated users can insert their own submission" ON public.manuscript_submissions;
CREATE POLICY "Users can insert their own submission"
ON public.manuscript_submissions
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND lower(submitter_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

-- Advisor photos live in a private bucket and are served as signed URLs.
DROP POLICY IF EXISTS "Allow public read on advisor photos" ON storage.objects;