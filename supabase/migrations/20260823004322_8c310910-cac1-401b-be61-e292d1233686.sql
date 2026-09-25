-- Chapter lead email addresses are personal contact data. Remove the blanket
-- public read of the chapters table; all public reads go through a server
-- function that strips contact fields.
DROP POLICY IF EXISTS "Chapters are publicly readable" ON public.chapters;

REVOKE ALL ON public.chapters FROM anon;
REVOKE ALL ON public.chapters FROM authenticated;
GRANT ALL ON public.chapters TO service_role;

ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;