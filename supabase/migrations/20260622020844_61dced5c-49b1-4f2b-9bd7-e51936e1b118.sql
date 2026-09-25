
ALTER TABLE public.library_entries
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS abstract text,
  ADD COLUMN IF NOT EXISTS keywords text[],
  ADD COLUMN IF NOT EXISTS references_text text,
  ADD COLUMN IF NOT EXISTS publication_date date,
  ADD COLUMN IF NOT EXISTS orcids text[];

-- Backfill slugs from titles
WITH base AS (
  SELECT id, title,
    regexp_replace(
      regexp_replace(lower(title), '[^a-z0-9]+', '-', 'g'),
      '(^-+|-+$)', '', 'g'
    ) AS base_slug
  FROM public.library_entries
  WHERE slug IS NULL OR slug = ''
),
numbered AS (
  SELECT id,
    CASE WHEN base_slug = '' THEN 'article' ELSE base_slug END
      || CASE WHEN row_number() OVER (PARTITION BY base_slug ORDER BY id) = 1
              THEN '' ELSE '-' || row_number() OVER (PARTITION BY base_slug ORDER BY id)::text END
      AS new_slug
  FROM base
)
UPDATE public.library_entries le
SET slug = numbered.new_slug
FROM numbered
WHERE le.id = numbered.id;

CREATE UNIQUE INDEX IF NOT EXISTS library_entries_slug_key ON public.library_entries(slug);

-- Allow anonymous reads so article pages are crawlable
GRANT SELECT ON public.library_entries TO anon;

DROP POLICY IF EXISTS "Public can read library entries" ON public.library_entries;
CREATE POLICY "Public can read library entries"
ON public.library_entries
FOR SELECT
TO anon, authenticated
USING (true);
