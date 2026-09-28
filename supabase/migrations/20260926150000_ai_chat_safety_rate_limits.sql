-- Durable, atomic quotas for the public AI assistant. The browser cannot read
-- or write these counters; only the server-side service role can consume them.
create table if not exists public.ai_chat_rate_limits (
  bucket text primary key,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now()
);

create index if not exists ai_chat_rate_limits_updated_at_idx
  on public.ai_chat_rate_limits (updated_at);

alter table public.ai_chat_rate_limits enable row level security;
revoke all on table public.ai_chat_rate_limits from anon, authenticated;
grant select, insert, update, delete on table public.ai_chat_rate_limits to service_role;

create or replace function public.consume_ai_chat_quota(p_identity_hash text)
returns table(allowed boolean, retry_after_seconds integer, remaining integer)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_count integer;
  v_started timestamptz;
begin
  if p_identity_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid identity hash';
  end if;

  -- One caller per hashed identity at a time, including across Vercel instances.
  perform pg_advisory_xact_lock(hashtextextended('ai-chat:' || p_identity_hash, 0));

  insert into public.ai_chat_rate_limits as limits
    (bucket, window_started_at, request_count, updated_at)
  values ('ip:10m:' || p_identity_hash, v_now, 1, v_now)
  on conflict (bucket) do update set
    request_count = case
      when limits.window_started_at <= v_now - interval '10 minutes' then 1
      else limits.request_count + 1
    end,
    window_started_at = case
      when limits.window_started_at <= v_now - interval '10 minutes' then v_now
      else limits.window_started_at
    end,
    updated_at = v_now
  returning request_count, window_started_at into v_count, v_started;
  if v_count > 6 then
    return query select false,
      greatest(1, ceil(extract(epoch from (v_started + interval '10 minutes' - v_now)))::integer),
      0;
    return;
  end if;

  insert into public.ai_chat_rate_limits as limits
    (bucket, window_started_at, request_count, updated_at)
  values ('ip:day:' || p_identity_hash, v_now, 1, v_now)
  on conflict (bucket) do update set
    request_count = case
      when limits.window_started_at <= v_now - interval '1 day' then 1
      else limits.request_count + 1
    end,
    window_started_at = case
      when limits.window_started_at <= v_now - interval '1 day' then v_now
      else limits.window_started_at
    end,
    updated_at = v_now
  returning request_count, window_started_at into v_count, v_started;
  if v_count > 30 then
    return query select false,
      greatest(1, ceil(extract(epoch from (v_started + interval '1 day' - v_now)))::integer),
      0;
    return;
  end if;

  -- Serialize the two global counters independently of visitor identity.
  perform pg_advisory_xact_lock(hashtextextended('ai-chat:global', 0));

  insert into public.ai_chat_rate_limits as limits
    (bucket, window_started_at, request_count, updated_at)
  values ('global:hour', v_now, 1, v_now)
  on conflict (bucket) do update set
    request_count = case
      when limits.window_started_at <= v_now - interval '1 hour' then 1
      else limits.request_count + 1
    end,
    window_started_at = case
      when limits.window_started_at <= v_now - interval '1 hour' then v_now
      else limits.window_started_at
    end,
    updated_at = v_now
  returning request_count, window_started_at into v_count, v_started;
  if v_count > 120 then
    return query select false,
      greatest(1, ceil(extract(epoch from (v_started + interval '1 hour' - v_now)))::integer),
      0;
    return;
  end if;

  insert into public.ai_chat_rate_limits as limits
    (bucket, window_started_at, request_count, updated_at)
  values ('global:day', v_now, 1, v_now)
  on conflict (bucket) do update set
    request_count = case
      when limits.window_started_at <= v_now - interval '1 day' then 1
      else limits.request_count + 1
    end,
    window_started_at = case
      when limits.window_started_at <= v_now - interval '1 day' then v_now
      else limits.window_started_at
    end,
    updated_at = v_now
  returning request_count, window_started_at into v_count, v_started;
  if v_count > 500 then
    return query select false,
      greatest(1, ceil(extract(epoch from (v_started + interval '1 day' - v_now)))::integer),
      0;
    return;
  end if;

  -- Keep only recently active identity buckets.
  delete from public.ai_chat_rate_limits
  where updated_at < v_now - interval '2 days';

  return query select true, 0, least(6 - (
    select request_count from public.ai_chat_rate_limits
    where bucket = 'ip:10m:' || p_identity_hash
  ), 30 - (
    select request_count from public.ai_chat_rate_limits
    where bucket = 'ip:day:' || p_identity_hash
  ));
end;
$$;

revoke all on function public.consume_ai_chat_quota(text) from public, anon, authenticated;
grant execute on function public.consume_ai_chat_quota(text) to service_role;
