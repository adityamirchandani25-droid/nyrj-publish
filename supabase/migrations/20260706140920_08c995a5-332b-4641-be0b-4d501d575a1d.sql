REVOKE EXECUTE ON FUNCTION public.increment_citation_count(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_citation_count(uuid) TO service_role;