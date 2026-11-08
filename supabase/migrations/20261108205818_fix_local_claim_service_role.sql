-- Preserve service-role-only access while accepting current PostgREST JWT claim settings.
CREATE OR REPLACE FUNCTION public.fgi_local_claim(p_user uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_today date := (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date;
  v_month date := date_trunc('month',CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date;
  v_count integer := 0;
  v_role text := coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'
  );
BEGIN
  IF v_role IS DISTINCT FROM 'service_role' OR p_user IS NULL THEN
    RETURN false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id=p_user) THEN RETURN false; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(62026, 1108);
  SELECT coalesce(sum(searches),0) INTO v_count
    FROM public.fgi_local_api_quota
    WHERE usage_date>=v_month AND usage_date < (v_month+INTERVAL '1 month')::date;
  IF v_count>=100 THEN RETURN false; END IF;
  INSERT INTO public.fgi_local_api_quota(user_id,usage_date,searches)
    VALUES (p_user,v_today,1)
    ON CONFLICT (user_id,usage_date) DO UPDATE
    SET searches=public.fgi_local_api_quota.searches+1
    WHERE public.fgi_local_api_quota.searches < 4;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count=1;
END;
$$;
REVOKE ALL ON FUNCTION public.fgi_local_claim(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fgi_local_claim(uuid) TO service_role;
