ALTER TABLE public.chapters
  ADD COLUMN IF NOT EXISTS chapter_lead_email text,
  ADD COLUMN IF NOT EXISTS about text,
  ADD COLUMN IF NOT EXISTS lead_photo_path text,
  ADD COLUMN IF NOT EXISTS slug text;

CREATE OR REPLACE FUNCTION public.assign_chapter_slug()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  base text;
BEGIN
  base := 'chapter-' || NEW.chapter_number || '-' || public.slugify(NEW.school_name);
  IF NEW.slug IS NULL OR length(NEW.slug) = 0 THEN
    NEW.slug := base;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS chapters_assign_slug ON public.chapters;
CREATE TRIGGER chapters_assign_slug
BEFORE INSERT OR UPDATE ON public.chapters
FOR EACH ROW EXECUTE FUNCTION public.assign_chapter_slug();

UPDATE public.chapters
SET slug = 'chapter-' || chapter_number || '-' || public.slugify(school_name)
WHERE slug IS NULL OR length(slug) = 0;

CREATE UNIQUE INDEX IF NOT EXISTS chapters_slug_key ON public.chapters (slug);