-- Additive migration generated with Supabase CLI at the saved checkpoint.
SET lock_timeout='5s';
SET statement_timeout='30s';

CREATE TABLE fgi_private.ai_customers (
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 livemode boolean NOT NULL,
 customer_id text NOT NULL CHECK(customer_id LIKE 'cus_%'),
 PRIMARY KEY(user_id,livemode), UNIQUE(customer_id,livemode)
);
CREATE TABLE fgi_private.ai_subscriptions (
 subscription_id text PRIMARY KEY CHECK(subscription_id LIKE 'sub_%'),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 customer_id text NOT NULL,
 livemode boolean NOT NULL,
 plan text CHECK(plan IN ('training','nutrition','bundle')),
 status text NOT NULL,
 paid_until timestamptz,
 period_end timestamptz,
 cancel_at_period_end boolean NOT NULL DEFAULT false,
 last_event_created bigint NOT NULL DEFAULT 0,
 FOREIGN KEY(customer_id,livemode) REFERENCES fgi_private.ai_customers(customer_id,livemode)
);
CREATE INDEX ai_subscriptions_user ON fgi_private.ai_subscriptions(user_id,livemode);
CREATE INDEX ai_subscriptions_customer ON fgi_private.ai_subscriptions(customer_id,livemode);
CREATE TABLE fgi_private.ai_friend_grants (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 modules text[] NOT NULL CHECK(modules<@ARRAY['training','nutrition']::text[] AND cardinality(modules)>0),
 expires_at timestamptz,
 reason text NOT NULL CHECK(length(reason) BETWEEN 1 AND 400)
);
CREATE TABLE fgi_private.ai_billing_events (
 event_id text NOT NULL,
 livemode boolean NOT NULL,
 processed_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(event_id,livemode)
);
CREATE TABLE fgi_private.ai_checkout_sessions (
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 livemode boolean NOT NULL,
 request_id uuid NOT NULL,
 plan text NOT NULL CHECK(plan IN ('training','nutrition','bundle')),
 url text,
 expires_at timestamptz NOT NULL,
 PRIMARY KEY(user_id,livemode)
);
CREATE TABLE fgi_private.ai_billing_risks (
 risk_id text NOT NULL,
 subscription_id text NOT NULL REFERENCES fgi_private.ai_subscriptions(subscription_id) ON DELETE CASCADE,
 active boolean NOT NULL,
 reason text NOT NULL,
 last_event_created bigint NOT NULL,
 PRIMARY KEY(risk_id,subscription_id)
);
CREATE INDEX ai_billing_risks_subscription ON fgi_private.ai_billing_risks(subscription_id) WHERE active;
CREATE TABLE fgi_private.ai_cost_ledger (
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 request_id uuid NOT NULL,
 livemode boolean NOT NULL,
 month date NOT NULL,
 reserved_usd numeric(12,6) NOT NULL CHECK(reserved_usd BETWEEN 0 AND 3),
 actual_usd numeric(12,6),
 input_tokens integer NOT NULL DEFAULT 0,
 output_tokens integer NOT NULL DEFAULT 0,
 PRIMARY KEY(user_id,request_id)
);
CREATE INDEX ai_cost_month ON fgi_private.ai_cost_ledger(month,livemode,user_id);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['ai_customers','ai_subscriptions','ai_friend_grants','ai_billing_events','ai_checkout_sessions','ai_billing_risks','ai_cost_ledger'] LOOP
  EXECUTE format('ALTER TABLE fgi_private.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON fgi_private.%I FROM PUBLIC,anon,authenticated',t);
  EXECUTE format('GRANT ALL ON fgi_private.%I TO service_role',t);
 END LOOP;
END $$;

CREATE TABLE public.fgi_ai_food (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 recorded_on date NOT NULL DEFAULT CURRENT_DATE,
 name text NOT NULL CHECK(length(name) BETWEEN 1 AND 160),
 calories_low numeric(7,2) NOT NULL CHECK(calories_low BETWEEN 0 AND 5000),
 calories_high numeric(7,2) NOT NULL CHECK(calories_high BETWEEN calories_low AND 5000),
 protein_g numeric(6,2) NOT NULL CHECK(protein_g BETWEEN 0 AND 600),
 fat_g numeric(6,2) NOT NULL CHECK(fat_g BETWEEN 0 AND 600),
 carbs_g numeric(6,2) NOT NULL CHECK(carbs_g BETWEEN 0 AND 600),
 source text NOT NULL CHECK(source IN ('manual','confirmed_photo')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX fgi_ai_food_user ON public.fgi_ai_food(user_id,recorded_on DESC);
ALTER TABLE public.fgi_ai_messages ADD CONSTRAINT fgi_ai_message_owner_unique UNIQUE(id,user_id);
ALTER TABLE public.fgi_ai_messages ADD COLUMN module text NOT NULL DEFAULT 'training' CHECK(module IN ('training','nutrition'));
CREATE TABLE public.fgi_ai_feedback (
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 message_id uuid NOT NULL,
 useful boolean NOT NULL,
 note text NOT NULL DEFAULT '' CHECK(length(note)<=500),
 PRIMARY KEY(user_id,message_id),
 FOREIGN KEY(message_id,user_id) REFERENCES public.fgi_ai_messages(id,user_id) ON DELETE CASCADE
);
CREATE INDEX fgi_ai_feedback_message ON public.fgi_ai_feedback(message_id,user_id);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['fgi_ai_food','fgi_ai_feedback'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM anon,authenticated',t);
  EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO authenticated',t);
  EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
  EXECUTE format('CREATE POLICY ai_owner ON public.%I FOR ALL TO authenticated USING(user_id=(select auth.uid())) WITH CHECK(user_id=(select auth.uid()) AND EXISTS(SELECT 1 FROM public.fgi_ai_profiles WHERE user_id=(select auth.uid())))',t);
 END LOOP;
END $$;

CREATE FUNCTION public.fgi_ai_access(p_user uuid,p_live boolean) RETURNS jsonb
 LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 WITH friends AS (SELECT modules FROM fgi_private.ai_friend_grants WHERE user_id=p_user AND (expires_at IS NULL OR expires_at>now())),
 paid AS (SELECT plan FROM fgi_private.ai_subscriptions s WHERE s.user_id=p_user AND s.livemode=p_live AND s.status='active' AND s.paid_until>now() AND s.plan IS NOT NULL AND NOT EXISTS(SELECT 1 FROM fgi_private.ai_billing_risks r WHERE r.subscription_id=s.subscription_id AND r.active)),
 modules AS (SELECT unnest(modules) AS module FROM friends UNION SELECT unnest(CASE plan WHEN 'bundle' THEN ARRAY['training','nutrition'] ELSE ARRAY[plan] END) FROM paid)
 SELECT jsonb_build_object('modules',COALESCE((SELECT jsonb_agg(module ORDER BY module) FROM modules),'[]'::jsonb),'friend',EXISTS(SELECT 1 FROM friends),'subscriptions',COALESCE((SELECT jsonb_agg(jsonb_build_object('plan',plan,'status',status,'paid_until',paid_until,'period_end',period_end,'cancel_at_period_end',cancel_at_period_end)) FROM fgi_private.ai_subscriptions WHERE user_id=p_user AND livemode=p_live),'[]'::jsonb));
$$;
CREATE FUNCTION public.fgi_ai_customer_get(p_user uuid,p_live boolean) RETURNS jsonb
 LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT jsonb_build_object('customer_id',customer_id) FROM fgi_private.ai_customers WHERE user_id=p_user AND livemode=p_live; $$;
CREATE FUNCTION public.fgi_ai_customer_owner(p_customer text,p_live boolean) RETURNS jsonb
 LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT jsonb_build_object('user_id',user_id) FROM fgi_private.ai_customers WHERE customer_id=p_customer AND livemode=p_live; $$;
CREATE FUNCTION public.fgi_ai_customer_save(p_user uuid,p_live boolean,p_customer text) RETURNS jsonb
 LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$ BEGIN
 INSERT INTO fgi_private.ai_customers(user_id,livemode,customer_id) VALUES(p_user,p_live,p_customer) ON CONFLICT(user_id,livemode) DO NOTHING;
 RETURN public.fgi_ai_customer_get(p_user,p_live);
END $$;
CREATE FUNCTION public.fgi_ai_checkout_claim(p_user uuid,p_live boolean,p_id uuid,p_plan text) RETURNS jsonb
 LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$ DECLARE r fgi_private.ai_checkout_sessions; BEGIN
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user::text,631006));
 SELECT * INTO r FROM fgi_private.ai_checkout_sessions WHERE user_id=p_user AND livemode=p_live FOR UPDATE;
 IF FOUND AND r.expires_at>now() THEN
  IF r.plan<>p_plan THEN RETURN jsonb_build_object('error','checkout_pending'); END IF;
  RETURN jsonb_build_object('request_id',r.request_id,'url',r.url,'expires',extract(epoch FROM r.expires_at)::bigint);
 END IF;
 -- Stripe permits an expiry at least 30 minutes in the future. A one-hour
 -- creation record also permits a safe idempotent retry after network failure.
 INSERT INTO fgi_private.ai_checkout_sessions(user_id,livemode,request_id,plan,expires_at) VALUES(p_user,p_live,p_id,p_plan,date_trunc('second',now())+interval '1 hour')
 ON CONFLICT(user_id,livemode) DO UPDATE SET request_id=EXCLUDED.request_id,plan=EXCLUDED.plan,url=NULL,expires_at=EXCLUDED.expires_at RETURNING * INTO r;
 RETURN jsonb_build_object('request_id',r.request_id,'url',NULL,'expires',extract(epoch FROM r.expires_at)::bigint);
END $$;
CREATE FUNCTION public.fgi_ai_checkout_save(p_user uuid,p_live boolean,p_id uuid,p_url text) RETURNS void
 LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 UPDATE fgi_private.ai_checkout_sessions SET url=p_url WHERE user_id=p_user AND livemode=p_live AND request_id=p_id;
$$;
CREATE FUNCTION public.fgi_ai_billing_sync(p_event text,p_created bigint,p_live boolean,p_user uuid,p_customer text,p_subscription text,p_plan text,p_status text,p_paid_until timestamptz,p_period_end timestamptz,p_cancel boolean,p_risk text,p_risk_id text) RETURNS void
 LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$ BEGIN
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_subscription,631004));
 IF EXISTS(SELECT 1 FROM fgi_private.ai_billing_events WHERE event_id=p_event AND livemode=p_live) THEN RETURN; END IF;
 IF NOT EXISTS(SELECT 1 FROM fgi_private.ai_customers WHERE user_id=p_user AND customer_id=p_customer AND livemode=p_live) THEN RAISE EXCEPTION 'billing_owner_mismatch'; END IF;
 INSERT INTO fgi_private.ai_subscriptions(subscription_id,user_id,customer_id,livemode,plan,status,paid_until,period_end,cancel_at_period_end,last_event_created)
 VALUES(p_subscription,p_user,p_customer,p_live,p_plan,p_status,p_paid_until,p_period_end,p_cancel,p_created)
 ON CONFLICT(subscription_id) DO UPDATE SET plan=EXCLUDED.plan,status=EXCLUDED.status,
 paid_until=CASE WHEN fgi_private.ai_subscriptions.plan IS DISTINCT FROM EXCLUDED.plan THEN EXCLUDED.paid_until ELSE COALESCE(EXCLUDED.paid_until,fgi_private.ai_subscriptions.paid_until) END,
 period_end=EXCLUDED.period_end,cancel_at_period_end=EXCLUDED.cancel_at_period_end,last_event_created=EXCLUDED.last_event_created
 WHERE fgi_private.ai_subscriptions.last_event_created<=EXCLUDED.last_event_created AND fgi_private.ai_subscriptions.user_id=EXCLUDED.user_id AND fgi_private.ai_subscriptions.livemode=EXCLUDED.livemode;
 IF p_risk IS NOT NULL THEN
  INSERT INTO fgi_private.ai_billing_risks(risk_id,subscription_id,active,reason,last_event_created) VALUES(p_risk_id,p_subscription,p_risk<>'resolved',p_risk,p_created)
  ON CONFLICT(risk_id,subscription_id) DO UPDATE SET active=EXCLUDED.active,reason=EXCLUDED.reason,last_event_created=EXCLUDED.last_event_created WHERE fgi_private.ai_billing_risks.last_event_created<=EXCLUDED.last_event_created;
 END IF;
 INSERT INTO fgi_private.ai_billing_events(event_id,livemode) VALUES(p_event,p_live);
END $$;

CREATE FUNCTION public.fgi_ai_reserve(p_user uuid,p_id uuid,p_live boolean,p_module text,p_amount numeric,p_user_cap numeric,p_site_cap numeric) RETURNS jsonb
 LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE m date:=(date_trunc('month',now() AT TIME ZONE 'UTC'))::date; user_total numeric; site_total numeric;
BEGIN
 PERFORM pg_catalog.pg_advisory_xact_lock(631005);
 IF NOT (public.fgi_ai_access(p_user,p_live)->'modules') ? p_module THEN RETURN jsonb_build_object('error','subscription_required'); END IF;
 IF p_amount<=0 OR p_amount>3 OR p_user_cap<=0 OR p_site_cap<=0 THEN RETURN jsonb_build_object('error','budget_unavailable'); END IF;
 IF EXISTS(SELECT 1 FROM fgi_private.ai_cost_ledger WHERE user_id=p_user AND request_id=p_id) THEN RETURN jsonb_build_object('error','request_conflict'); END IF;
 SELECT COALESCE(sum(COALESCE(actual_usd,reserved_usd)),0),COALESCE(sum(COALESCE(actual_usd,reserved_usd)) FILTER(WHERE user_id=p_user),0) INTO site_total,user_total FROM fgi_private.ai_cost_ledger WHERE month=m AND livemode=p_live;
 IF user_total+p_amount>p_user_cap OR site_total+p_amount>p_site_cap THEN RETURN jsonb_build_object('error','monthly_limit'); END IF;
 INSERT INTO fgi_private.ai_cost_ledger(user_id,request_id,livemode,month,reserved_usd) VALUES(p_user,p_id,p_live,m,p_amount);
 RETURN jsonb_build_object('reserved',true);
END $$;
CREATE FUNCTION public.fgi_ai_meter(p_user uuid,p_id uuid,p_actual numeric,p_input integer,p_output integer) RETURNS void
 LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 UPDATE fgi_private.ai_cost_ledger SET actual_usd=GREATEST(0,p_actual),input_tokens=GREATEST(0,p_input),output_tokens=GREATEST(0,p_output) WHERE user_id=p_user AND request_id=p_id AND actual_usd IS NULL;
$$;

-- Completion also checks the entitlement, closing cancellation/response races.
CREATE OR REPLACE FUNCTION public.fgi_ai_complete(p_user uuid,p_id uuid,p_conversation uuid,p_consent timestamptz,p_input text,p_output text,p_citations jsonb,p_kind text,p_document jsonb,p_result jsonb)
 RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$ BEGIN
 PERFORM 1 FROM public.fgi_ai_profiles WHERE user_id=p_user AND updated_at=p_consent FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'consent_changed'; END IF;
 IF NOT COALESCE((public.fgi_ai_access(p_user,COALESCE((p_result->>'livemode')::boolean,true))->'modules') ? (p_result->>'module'),false) THEN RAISE EXCEPTION 'subscription_required'; END IF;
 PERFORM 1 FROM public.fgi_ai_conversations WHERE id=p_conversation AND user_id=p_user FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'conversation_missing'; END IF;
 PERFORM 1 FROM fgi_private.ai_requests WHERE user_id=p_user AND id=p_id AND status='pending' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'request_missing'; END IF;
 INSERT INTO public.fgi_ai_messages(user_id,conversation_id,request_id,role,body,citations,module) VALUES(p_user,p_conversation,p_id,'user',p_input,'[]',p_result->>'module'),(p_user,p_conversation,p_id,'assistant',p_output,p_citations,p_result->>'module');
 IF p_kind IS NOT NULL THEN INSERT INTO public.fgi_ai_plans(id,user_id,kind,title,document) VALUES((p_result->>'plan_id')::uuid,p_user,p_kind,p_document->>'title',p_document); END IF;
 UPDATE fgi_private.ai_requests SET status='completed',result=p_result WHERE user_id=p_user AND id=p_id;
END $$;
CREATE OR REPLACE FUNCTION public.fgi_ai_delete(p_user uuid)
 RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$ BEGIN
 PERFORM 1 FROM public.fgi_ai_profiles WHERE user_id=p_user FOR UPDATE;
 DELETE FROM public.fgi_ai_food WHERE user_id=p_user;
 DELETE FROM public.fgi_ai_feedback WHERE user_id=p_user;
 DELETE FROM public.fgi_ai_profiles WHERE user_id=p_user;
 DELETE FROM public.fgi_ai_conversations WHERE user_id=p_user;
 DELETE FROM public.fgi_ai_workouts WHERE user_id=p_user;
 DELETE FROM public.fgi_ai_plans WHERE user_id=p_user;
 DELETE FROM public.fgi_ai_progress WHERE user_id=p_user;
 DELETE FROM public.fgi_ai_shares WHERE user_id=p_user;
 UPDATE fgi_private.ai_requests SET result=NULL,request_hash='deleted',status='failed' WHERE user_id=p_user;
 -- Financial records have no prompt or media. Data deletion does not cancel billing.
END $$;
DO $$ DECLARE r record; BEGIN
 FOR r IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('fgi_ai_access','fgi_ai_customer_get','fgi_ai_customer_owner','fgi_ai_customer_save','fgi_ai_checkout_claim','fgi_ai_checkout_save','fgi_ai_billing_sync','fgi_ai_reserve','fgi_ai_meter') LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',r.signature);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',r.signature);
 END LOOP;
END $$;
