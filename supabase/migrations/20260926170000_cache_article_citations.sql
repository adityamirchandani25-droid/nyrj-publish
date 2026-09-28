ALTER TABLE public.library_entries
  ADD COLUMN IF NOT EXISTS citation_formats jsonb,
  ADD COLUMN IF NOT EXISTS citation_source_hash text,
  ADD COLUMN IF NOT EXISTS citation_generated_at timestamptz;

COMMENT ON COLUMN public.library_entries.citation_formats IS
  'Cached APA, MLA, Chicago, BibTeX, and RIS citation bundle.';
COMMENT ON COLUMN public.library_entries.citation_source_hash IS
  'SHA-256 of the source metadata used to generate citation_formats.';
COMMENT ON COLUMN public.library_entries.citation_generated_at IS
  'Time the cached citation bundle was generated.';
