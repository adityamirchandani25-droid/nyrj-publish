-- Durable rate limits shared by every serverless instance. Callers only send
-- keyed hashes, never raw IP addresses, emails, tokens, or user IDs.
create table if not exists public.api_rate_limits (
  bucket text primary key,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now()
);

create index if not exists api_rate_limits_updated_at_idx
  on public.api_rate_limits (updated_at);

alter table public.api_rate_limits enable row level security;
revoke all on table public.api_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on table public.api_rate_limits to service_role;

create or replace function public.consume_api_rate_limit(
  p_scope text,
  p_identity_hash text,
  p_limit integer,
  p_window_seconds integer
)
returns table(allowed boolean, retry_after_seconds integer, remaining integer)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_count integer;
  v_started timestamptz;
  v_bucket text;
begin
  if p_scope !~ '^[a-z0-9:_-]{1,80}$' then
    raise exception 'invalid rate-limit scope';
  end if;
  if p_identity_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid identity hash';
  end if;
  if p_limit < 1 or p_limit > 10000 then
    raise exception 'invalid rate limit';
  end if;
  if p_window_seconds < 1 or p_window_seconds > 604800 then
    raise exception 'invalid rate-limit window';
  end if;

  v_bucket := p_scope || ':' || p_window_seconds::text || ':' || p_identity_hash;
  perform pg_advisory_xact_lock(hashtextextended('api-rate:' || v_bucket, 0));

  insert into public.api_rate_limits as limits
    (bucket, window_started_at, request_count, updated_at)
  values (v_bucket, v_now, 1, v_now)
  on conflict (bucket) do update set
    request_count = case
      when limits.window_started_at <= v_now - make_interval(secs => p_window_seconds) then 1
      else limits.request_count + 1
    end,
    window_started_at = case
      when limits.window_started_at <= v_now - make_interval(secs => p_window_seconds) then v_now
      else limits.window_started_at
    end,
    updated_at = v_now
  returning request_count, window_started_at into v_count, v_started;

  delete from public.api_rate_limits
  where updated_at < v_now - interval '8 days';

  return query select
    v_count <= p_limit,
    case
      when v_count <= p_limit then 0
      else greatest(
        1,
        ceil(extract(epoch from (
          v_started + make_interval(secs => p_window_seconds) - v_now
        )))::integer
      )
    end,
    greatest(0, p_limit - v_count);
end;
$$;

revoke all on function public.consume_api_rate_limit(text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_api_rate_limit(text, text, integer, integer)
  to service_role;

-- Submission uploads now require a short-lived URL issued by the authenticated,
-- rate-limited server function. Authenticated users retain read access to their
-- own folder, but cannot bypass the application and upload arbitrary objects.
drop policy if exists "Authenticated users can upload to own submissions folder"
  on storage.objects;
