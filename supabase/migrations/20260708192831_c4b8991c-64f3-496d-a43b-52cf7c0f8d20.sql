
-- Slugify helper: lowercase, strip accents, non-alphanum to hyphen, collapse hyphens.
CREATE OR REPLACE FUNCTION public.slugify(_input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT trim(both '-' from
    regexp_replace(
      regexp_replace(lower(coalesce(_input, '')), '[^a-z0-9]+', '-', 'g'),
      '-{2,}', '-', 'g'
    )
  );
$$;

-- Assign both nyrj_id (SP-#####) and a systematic slug (sp-#####-title-slug)
CREATE OR REPLACE FUNCTION public.assign_library_identifiers()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  base_slug text;
  short_title text;
BEGIN
  IF NEW.nyrj_id IS NULL THEN
    NEW.nyrj_id := 'SP-' || lpad(nextval('public.nyrj_id_seq')::text, 5, '0');
  END IF;

  IF NEW.slug IS NULL OR length(NEW.slug) = 0 THEN
    short_title := public.slugify(NEW.title);
    -- cap at ~60 chars for readability
    IF length(short_title) > 60 THEN
      short_title := substring(short_title from 1 for 60);
      short_title := trim(both '-' from short_title);
    END IF;
    base_slug := lower(NEW.nyrj_id) || CASE WHEN length(short_title) > 0 THEN '-' || short_title ELSE '' END;
    NEW.slug := base_slug;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_library_identifiers ON public.library_entries;
CREATE TRIGGER trg_assign_library_identifiers
  BEFORE INSERT ON public.library_entries
  FOR EACH ROW EXECUTE FUNCTION public.assign_library_identifiers();

-- Ensure slug uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS library_entries_slug_key ON public.library_entries (slug);

-- Backfill any pre-existing rows missing identifiers
UPDATE public.library_entries
SET nyrj_id = 'SP-' || lpad(nextval('public.nyrj_id_seq')::text, 5, '0')
WHERE nyrj_id IS NULL;

UPDATE public.library_entries
SET slug = lower(nyrj_id) || CASE
  WHEN length(public.slugify(title)) > 0
    THEN '-' || substring(public.slugify(title) from 1 for 60)
  ELSE ''
END
WHERE slug IS NULL OR length(slug) = 0;
