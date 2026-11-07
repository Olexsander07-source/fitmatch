-- FitGoIn AI: 7-day one-million-token trial and Pro/Premium subscriptions.
-- Source migration only; do not run on production until Checkout and AI bundle pass integration tests.
BEGIN;

ALTER TABLE fgi_private.ai_subscriptions
  ADD COLUMN IF NOT EXISTS trial_start timestamptz,
  ADD COLUMN IF NOT EXISTS trial_end timestamptz;

ALTER TABLE fgi_private.ai_cost_ledger
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS reserved_tokens bigint NOT NULL DEFAULT 0;

ALTER TABLE fgi_private.ai_subscriptions DROP CONSTRAINT IF EXISTS ai_subscriptions_plan_check;
ALTER TABLE fgi_private.ai_subscriptions
 ADD CONSTRAINT ai_subscriptions_plan_check CHECK(plan IS NULL OR plan IN ('training','nutrition','bundle','pro','premium'));
ALTER TABLE fgi_private.ai_checkout_sessions DROP CONSTRAINT IF EXISTS ai_checkout_sessions_plan_check;
ALTER TABLE fgi_private.ai_checkout_sessions
 ADD CONSTRAINT ai_checkout_sessions_plan_check CHECK(plan IN ('training','nutrition','bundle','pro','premium'));
-- Count monthly web research independently of the 24-hour idempotency cache.
CREATE TABLE IF NOT EXISTS fgi_private.ai_search_usage (
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 request_id uuid NOT NULL,
 livemode boolean NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,request_id)
);
CREATE INDEX IF NOT EXISTS ai_search_usage_month_idx
 ON fgi_private.ai_search_usage(user_id,livemode,created_at);
CREATE INDEX IF NOT EXISTS ai_cost_ledger_trial_window_idx
 ON fgi_private.ai_cost_ledger(user_id,livemode,created_at);

CREATE OR REPLACE FUNCTION public.fgi_ai_trial_eligible(p_user uuid,p_live boolean)
RETURNS jsonb LANGUAGE sql STABLE SET search_path TO '' AS $$
 SELECT jsonb_build_object('eligible',
  NOT EXISTS(SELECT 1 FROM fgi_private.ai_subscriptions s
      WHERE s.user_id=p_user AND s.livemode=p_live AND s.trial_end IS NOT NULL));
$$;

-- Server-owned access based on signed Stripe webhooks, never editable user metadata.
CREATE OR REPLACE FUNCTION public.fgi_ai_access(p_user uuid,p_live boolean)
RETURNS jsonb LANGUAGE sql STABLE SET search_path TO '' AS $$
WITH friends AS (
 SELECT modules FROM fgi_private.ai_friend_grants
 WHERE user_id=p_user AND (expires_at IS NULL OR expires_at>now())
),
valid_sub AS (
 SELECT s.* FROM fgi_private.ai_subscriptions s
 WHERE s.user_id=p_user AND s.livemode=p_live
   AND s.plan IN ('pro','premium')
   AND (
     (s.status='active' AND s.paid_until>now())
     OR (s.status='trialing' AND s.trial_start<=now() AND s.trial_end>now())
   )
   AND NOT EXISTS(SELECT 1 FROM fgi_private.ai_billing_risks r
       WHERE r.subscription_id=s.subscription_id AND r.active)
),
tier AS (
 SELECT CASE
   WHEN EXISTS(SELECT 1 FROM valid_sub WHERE status='active' AND plan='premium') THEN 'premium'
   WHEN EXISTS(SELECT 1 FROM valid_sub WHERE status='active' AND plan='pro') THEN 'pro'
   WHEN EXISTS(SELECT 1 FROM valid_sub WHERE status='trialing') THEN 'trial'
   WHEN EXISTS(SELECT 1 FROM friends) THEN 'friend'
   ELSE 'none' END AS name
),
active_trial AS (
 SELECT trial_start,trial_end FROM valid_sub WHERE status='trialing'
 ORDER BY trial_end DESC LIMIT 1
),
spent AS (
 SELECT COALESCE(sum(CASE WHEN l.actual_usd IS NULL THEN l.reserved_tokens ELSE l.input_tokens::bigint+l.output_tokens::bigint END),0)::bigint AS tokens
 FROM fgi_private.ai_cost_ledger l CROSS JOIN active_trial t
 WHERE l.user_id=p_user AND l.livemode=p_live
   AND l.created_at>=t.trial_start AND l.created_at<t.trial_end
),
modules AS (
 SELECT unnest(modules) AS module FROM friends
 UNION SELECT unnest(ARRAY['training','nutrition']) FROM tier WHERE name IN ('trial','pro','premium')
)
SELECT jsonb_build_object(
 'tier',(SELECT name FROM tier),
 'trial',(SELECT name='trial' FROM tier),
 'premium',(SELECT name IN ('premium','friend') FROM tier),
 'friend',EXISTS(SELECT 1 FROM friends),
 'modules',COALESCE((SELECT jsonb_agg(module ORDER BY module) FROM modules),'[]'::jsonb),
 'trial_end',(SELECT trial_end FROM active_trial),
 'trial_tokens_remaining',CASE WHEN (SELECT name FROM tier)='trial'
   THEN GREATEST(0,1000000-(SELECT tokens FROM spent)) ELSE NULL END,
 'search_limit',CASE (SELECT name FROM tier) WHEN 'premium' THEN 100 WHEN 'pro' THEN 30 ELSE 0 END,
 'subscriptions',COALESCE((SELECT jsonb_agg(jsonb_build_object(
   'plan',plan,'status',status,'paid_until',paid_until,'period_end',period_end,
   'trial_end',trial_end,'cancel_at_period_end',cancel_at_period_end))
  FROM fgi_private.ai_subscriptions WHERE user_id=p_user AND livemode=p_live),'[]'::jsonb));
$$;

-- Trial status is taken only from Stripe and synchronized under the same transaction as paid access.
CREATE OR REPLACE FUNCTION public.fgi_ai_billing_sync_v2(
 p_event text,p_created bigint,p_live boolean,p_user uuid,p_customer text,
 p_subscription text,p_plan text,p_status text,p_paid_until timestamptz,
 p_period_end timestamptz,p_trial_start timestamptz,p_trial_end timestamptz,
 p_cancel boolean,p_risk text,p_risk_id text)
RETURNS void LANGUAGE plpgsql SET search_path TO '' AS $$
BEGIN
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_subscription,631004));
 IF EXISTS(SELECT 1 FROM fgi_private.ai_billing_events WHERE event_id=p_event AND livemode=p_live) THEN RETURN; END IF;
 IF NOT EXISTS(SELECT 1 FROM fgi_private.ai_customers
   WHERE user_id=p_user AND customer_id=p_customer AND livemode=p_live) THEN
  RAISE EXCEPTION 'billing_owner_mismatch';
 END IF;
 IF p_status='trialing' AND (p_trial_start IS NULL OR p_trial_end IS NULL
     OR p_trial_end<=p_trial_start OR p_trial_end>p_trial_start+interval '8 days') THEN
  RAISE EXCEPTION 'invalid_trial_period';
 END IF;
 INSERT INTO fgi_private.ai_subscriptions
 (subscription_id,user_id,customer_id,livemode,plan,status,paid_until,period_end,
  trial_start,trial_end,cancel_at_period_end,last_event_created)
 VALUES(p_subscription,p_user,p_customer,p_live,p_plan,p_status,p_paid_until,p_period_end,
  p_trial_start,p_trial_end,p_cancel,p_created)
 ON CONFLICT(subscription_id) DO UPDATE SET plan=EXCLUDED.plan,status=EXCLUDED.status,
  paid_until=CASE WHEN fgi_private.ai_subscriptions.plan IS DISTINCT FROM EXCLUDED.plan
    THEN EXCLUDED.paid_until
    ELSE COALESCE(EXCLUDED.paid_until,fgi_private.ai_subscriptions.paid_until) END,
  period_end=EXCLUDED.period_end,
  trial_start=COALESCE(fgi_private.ai_subscriptions.trial_start,EXCLUDED.trial_start),
  trial_end=COALESCE(fgi_private.ai_subscriptions.trial_end,EXCLUDED.trial_end),
  cancel_at_period_end=EXCLUDED.cancel_at_period_end,
  last_event_created=EXCLUDED.last_event_created
 WHERE fgi_private.ai_subscriptions.last_event_created<=EXCLUDED.last_event_created
  AND fgi_private.ai_subscriptions.user_id=EXCLUDED.user_id
  AND fgi_private.ai_subscriptions.livemode=EXCLUDED.livemode;
 IF p_risk IS NOT NULL THEN
  INSERT INTO fgi_private.ai_billing_risks(risk_id,subscription_id,active,reason,last_event_created)
   VALUES(p_risk_id,p_subscription,p_risk<>'resolved',p_risk,p_created)
  ON CONFLICT(risk_id,subscription_id) DO UPDATE SET active=EXCLUDED.active,
   reason=EXCLUDED.reason,last_event_created=EXCLUDED.last_event_created
  WHERE fgi_private.ai_billing_risks.last_event_created<=EXCLUDED.last_event_created;
 END IF;
 INSERT INTO fgi_private.ai_billing_events(event_id,livemode) VALUES(p_event,p_live);
END;
$$;

-- New names avoid ambiguous PostgREST RPC overloads with the previous production API.
CREATE OR REPLACE FUNCTION public.fgi_ai_claim_v2(
 p_user uuid,p_id uuid,p_hash text,p_search boolean,p_live boolean)
RETURNS jsonb LANGUAGE plpgsql SET search_path TO '' AS $$
DECLARE r fgi_private.ai_requests; daily integer; searches integer; global_count integer;
 tier text; search_limit integer;
BEGIN
 PERFORM pg_catalog.pg_advisory_xact_lock(630031);
 DELETE FROM fgi_private.ai_requests WHERE created_at<now()-interval '24 hours';
 SELECT * INTO r FROM fgi_private.ai_requests WHERE user_id=p_user AND id=p_id;
 IF FOUND THEN
  IF r.request_hash<>p_hash THEN RETURN jsonb_build_object('error','request_conflict'); END IF;
  IF r.status='completed' THEN RETURN jsonb_build_object('cached',r.result); END IF;
  RETURN jsonb_build_object('error',CASE WHEN r.status='pending' THEN 'request_pending' ELSE 'request_failed' END);
 END IF;
 tier:=public.fgi_ai_access(p_user,p_live)->>'tier';
 IF tier='none' THEN RETURN jsonb_build_object('error','subscription_required'); END IF;
 search_limit:=CASE tier WHEN 'premium' THEN 100 WHEN 'pro' THEN 30 WHEN 'friend' THEN 100 ELSE 0 END;
 IF p_search AND search_limit=0 THEN RETURN jsonb_build_object('error','search_requires_pro'); END IF;
 SELECT count(*) INTO daily FROM fgi_private.ai_requests
 WHERE user_id=p_user AND created_at>=date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
 SELECT count(*) INTO searches FROM fgi_private.ai_search_usage
 WHERE user_id=p_user AND livemode=p_live AND created_at>=date_trunc('month',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
 SELECT count(*) INTO global_count FROM fgi_private.ai_requests
 WHERE created_at>=date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
 IF daily >= 120 OR global_count>=5000 OR (p_search AND searches>=search_limit)
  THEN RETURN jsonb_build_object('error','daily_limit'); END IF;
 IF (SELECT count(*) FROM fgi_private.ai_requests WHERE user_id=p_user AND created_at>now()-interval '1 minute')>=5
  THEN RETURN jsonb_build_object('error','rate_limit'); END IF;
 INSERT INTO fgi_private.ai_requests(id,user_id,request_hash,search) VALUES(p_id,p_user,p_hash,p_search);
 IF p_search THEN
  INSERT INTO fgi_private.ai_search_usage(user_id,request_id,livemode) VALUES(p_user,p_id,p_live);
 END IF;
 RETURN jsonb_build_object('remaining',119-daily,
   'search_remaining',GREATEST(0,search_limit-searches-CASE WHEN p_search THEN 1 ELSE 0 END));
END;
$$;

-- Search upgrades an existing pending chat request atomically; monthly counts are plan-aware.
CREATE OR REPLACE FUNCTION public.fgi_ai_claim_search_v2(p_user uuid,p_id uuid,p_live boolean)
RETURNS jsonb LANGUAGE plpgsql SET search_path TO '' AS $$
DECLARE searches integer; tier text; lim integer; old_search boolean;
BEGIN
 PERFORM pg_catalog.pg_advisory_xact_lock(630031);
 SELECT search INTO old_search FROM fgi_private.ai_requests
 WHERE user_id=p_user AND id=p_id AND status='pending' FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('error','request_missing'); END IF;
 tier:=public.fgi_ai_access(p_user,p_live)->>'tier';
 lim:=CASE tier WHEN 'premium' THEN 100 WHEN 'pro' THEN 30 WHEN 'friend' THEN 100 ELSE 0 END;
 IF lim=0 THEN RETURN jsonb_build_object('error','search_requires_pro'); END IF;
 SELECT count(*) INTO searches FROM fgi_private.ai_search_usage
 WHERE user_id=p_user AND livemode=p_live AND created_at>=date_trunc('month',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
 IF searches>=lim AND NOT old_search THEN RETURN jsonb_build_object('error','search_limit'); END IF;
 UPDATE fgi_private.ai_requests SET search=true WHERE user_id=p_user AND id=p_id;
 INSERT INTO fgi_private.ai_search_usage(user_id,request_id,livemode)
 VALUES(p_user,p_id,p_live) ON CONFLICT(user_id,request_id) DO NOTHING;
 RETURN jsonb_build_object('search_remaining',GREATEST(0,lim-searches-CASE WHEN old_search THEN 0 ELSE 1 END));
END;
$$;

CREATE OR REPLACE FUNCTION public.fgi_ai_reserve_v2(
 p_user uuid,p_id uuid,p_live boolean,p_module text,p_amount numeric,
 p_estimated_tokens bigint,p_site_cap numeric)
RETURNS jsonb LANGUAGE plpgsql SET search_path TO '' AS $$
DECLARE m date:=(date_trunc('month',now() AT TIME ZONE 'UTC'))::date;
 user_total numeric; site_total numeric; weekly_tokens bigint; available bigint;
 tier text; access_data jsonb; cap numeric; tstart timestamptz; tend timestamptz;
BEGIN
 PERFORM pg_catalog.pg_advisory_xact_lock(631005);
 access_data:=public.fgi_ai_access(p_user,p_live);tier:=access_data->>'tier';
 IF NOT (access_data->'modules') ? p_module THEN RETURN jsonb_build_object('error','subscription_required'); END IF;
 cap:=CASE tier WHEN 'trial' THEN 1 WHEN 'pro' THEN 6 WHEN 'premium' THEN 10 WHEN 'friend' THEN 5 ELSE 0 END;
 IF p_amount<=0 OR p_amount>3 OR p_site_cap<=0 OR cap=0 OR p_estimated_tokens<=0 OR p_estimated_tokens>200000
  THEN RETURN jsonb_build_object('error','budget_unavailable'); END IF;
 IF EXISTS(SELECT 1 FROM fgi_private.ai_cost_ledger WHERE user_id=p_user AND request_id=p_id)
  THEN RETURN jsonb_build_object('error','request_conflict'); END IF;
 IF tier='trial' THEN
  SELECT trial_start,trial_end INTO tstart,tend FROM fgi_private.ai_subscriptions
  WHERE user_id=p_user AND livemode=p_live AND status='trialing' AND trial_start<=now() AND trial_end>now()
  ORDER BY trial_end DESC LIMIT 1;
  IF tstart IS NULL THEN RETURN jsonb_build_object('error','subscription_required'); END IF;
  SELECT COALESCE(sum(CASE WHEN actual_usd IS NULL THEN reserved_tokens
                          ELSE input_tokens::bigint+output_tokens::bigint END),0)::bigint
    INTO weekly_tokens FROM fgi_private.ai_cost_ledger
    WHERE user_id=p_user AND livemode=p_live AND created_at>=tstart AND created_at<tend;
  available:=GREATEST(0,1000000-weekly_tokens);
  IF p_estimated_tokens>available THEN RETURN jsonb_build_object('error','trial_token_limit'); END IF;
 END IF;
 SELECT COALESCE(sum(COALESCE(actual_usd,reserved_usd)),0),
  COALESCE(sum(COALESCE(actual_usd,reserved_usd)) FILTER(WHERE user_id=p_user),0)
  INTO site_total,user_total FROM fgi_private.ai_cost_ledger WHERE month=m AND livemode=p_live;
 IF tier='trial' THEN
  SELECT COALESCE(sum(COALESCE(actual_usd,reserved_usd)),0) INTO user_total
  FROM fgi_private.ai_cost_ledger WHERE user_id=p_user AND livemode=p_live
    AND created_at>=tstart AND created_at<tend;
 END IF;
 IF user_total+p_amount>cap OR site_total+p_amount>p_site_cap
  THEN RETURN jsonb_build_object('error','monthly_limit'); END IF;
 INSERT INTO fgi_private.ai_cost_ledger(user_id,request_id,livemode,month,reserved_usd,reserved_tokens)
 VALUES(p_user,p_id,p_live,m,p_amount,p_estimated_tokens);
 RETURN jsonb_build_object('reserved',true);
END;
$$;

COMMIT;
