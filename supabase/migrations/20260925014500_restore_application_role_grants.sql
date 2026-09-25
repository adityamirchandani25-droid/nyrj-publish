-- A database dump can restore tables, rows, RLS policies, and ownership without
-- restoring the API-role grants that PostgREST requires.  Reapply the minimum
-- privileges used by this application.  This migration does not change rows,
-- disable RLS, or make private content public.

GRANT USAGE ON SCHEMA public TO service_role, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.library_entries,
  public.submissions,
  public.manuscript_submissions,
  public.profiles,
  public.chapters,
  public.site_settings,
  public.editorial_team,
  public.advisors,
  public.events,
  public.event_ideas,
  public.guidance_videos,
  public.sponsors,
  public.team_members,
  public.peer_reviewers,
  public.review_assignments,
  public.review_audit_log,
  public.initial_reviewers,
  public.editor_accounts,
  public.editor_recommendations,
  public.manuscript_versions,
  public.sent_emails
TO service_role;

GRANT USAGE, SELECT ON SEQUENCE public.nyrj_id_seq TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_citation_count(uuid) TO service_role;

-- These are the only tables queried directly by signed-in student clients.
-- Existing RLS policies continue to restrict every row to its owner.
GRANT SELECT, INSERT, UPDATE ON TABLE public.profiles TO authenticated;
GRANT SELECT ON TABLE public.submissions TO authenticated;
GRANT SELECT, INSERT ON TABLE public.manuscript_submissions TO authenticated;
