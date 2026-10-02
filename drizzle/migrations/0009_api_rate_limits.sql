-- Durable rate limits shared by every serverless instance. Callers only send
-- keyed hashes, never raw IP addresses, emails, tokens, or user IDs.
CREATE TABLE IF NOT EXISTS public.api_rate_limits (
  bucket text PRIMARY KEY,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  request_count integer NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS api_rate_limits_updated_at_idx
  ON public.api_rate_limits (updated_at);

ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.api_rate_limits FROM public, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.api_rate_limits TO service_role;

CREATE OR REPLACE FUNCTION public.consume_api_rate_limit(
  p_scope text,
  p_identity_hash text,
  p_limit integer,
  p_window_seconds integer
)
RETURNS TABLE(allowed boolean, retry_after_seconds integer, remaining integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_count integer;
  v_started timestamptz;
  v_bucket text;
BEGIN
  IF p_scope !~ '^[a-z0-9:_-]{1,80}$' THEN
    RAISE EXCEPTION 'invalid rate-limit scope';
  END IF;
  IF p_identity_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'invalid identity hash';
  END IF;
  IF p_limit < 1 OR p_limit > 10000 THEN
    RAISE EXCEPTION 'invalid rate limit';
  END IF;
  IF p_window_seconds < 1 OR p_window_seconds > 604800 THEN
    RAISE EXCEPTION 'invalid rate-limit window';
  END IF;

  v_bucket := p_scope || ':' || p_window_seconds::text || ':' || p_identity_hash;
  PERFORM pg_advisory_xact_lock(hashtextextended('api-rate:' || v_bucket, 0));

  INSERT INTO public.api_rate_limits AS limits
    (bucket, window_started_at, request_count, updated_at)
  VALUES (v_bucket, v_now, 1, v_now)
  ON CONFLICT (bucket) DO UPDATE SET
    request_count = CASE
      WHEN limits.window_started_at <= v_now - make_interval(secs => p_window_seconds) THEN 1
      ELSE limits.request_count + 1
    END,
    window_started_at = CASE
      WHEN limits.window_started_at <= v_now - make_interval(secs => p_window_seconds) THEN v_now
      ELSE limits.window_started_at
    END,
    updated_at = v_now
  RETURNING request_count, window_started_at INTO v_count, v_started;

  -- Opportunistic cleanup keeps the table bounded without another cron.
  DELETE FROM public.api_rate_limits
  WHERE updated_at < v_now - interval '8 days';

  RETURN QUERY SELECT
    v_count <= p_limit,
    CASE
      WHEN v_count <= p_limit THEN 0
      ELSE greatest(
        1,
        ceil(extract(epoch FROM (
          v_started + make_interval(secs => p_window_seconds) - v_now
        )))::integer
      )
    END,
    greatest(0, p_limit - v_count);
END;
$$;

REVOKE ALL ON FUNCTION public.consume_api_rate_limit(text, text, integer, integer)
  FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_api_rate_limit(text, text, integer, integer)
  TO service_role;

-- Submission uploads now require a short-lived URL issued by the authenticated,
-- rate-limited server function. Authenticated users retain read access to their
-- own folder, but cannot bypass the application and upload arbitrary objects.
DROP POLICY IF EXISTS "Authenticated users can upload to own submissions folder"
  ON storage.objects;
