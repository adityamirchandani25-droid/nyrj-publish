-- Expose a service-role-only health check for the constraints required by the
-- author revision finalizer. Missing either unique index makes PostgREST reject
-- ON CONFLICT before a successfully uploaded file can be attached.
create or replace function public.revision_integrity_healthcheck()
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select jsonb_build_object(
    'version_unique_index', exists (
      select 1
      from pg_indexes
      where schemaname = 'public'
        and tablename = 'manuscript_versions'
        and indexname = 'manuscript_versions_submission_version_key'
        and indexdef like 'CREATE UNIQUE INDEX%'
    ),
    'token_unique_index', exists (
      select 1
      from pg_indexes
      where schemaname = 'public'
        and tablename = 'manuscript_submissions'
        and indexname = 'manuscript_submissions_resubmit_token_key'
        and indexdef like 'CREATE UNIQUE INDEX%'
    )
  );
$$;

revoke all on function public.revision_integrity_healthcheck()
  from public, anon, authenticated;
grant execute on function public.revision_integrity_healthcheck()
  to service_role;
