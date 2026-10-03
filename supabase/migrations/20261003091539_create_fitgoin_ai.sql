-- Additive FitGoIn AI storage. Existing accounts, coaches and chat are unchanged.
SET lock_timeout = '5s';
SET statement_timeout = '30s';

CREATE TABLE public.fgi_ai_profiles (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 data jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(data)='object' AND octet_length(data::text)<=16000),
 consent_version text NOT NULL CHECK(consent_version='2026-10-03'),
 consented_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER fgi_ai_profiles_updated BEFORE UPDATE ON public.fgi_ai_profiles
 FOR EACH ROW EXECUTE FUNCTION fgi_private.update_updated_at();

CREATE TABLE public.fgi_ai_conversations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 title text NOT NULL DEFAULT 'FitGoIn AI' CHECK(length(title)<=120),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,user_id)
);
CREATE INDEX fgi_ai_conversations_user ON public.fgi_ai_conversations(user_id,created_at DESC);
CREATE TABLE public.fgi_ai_messages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 conversation_id uuid NOT NULL,
 request_id uuid NOT NULL,
 role text NOT NULL CHECK(role IN ('user','assistant')),
 body text NOT NULL CHECK(length(body) BETWEEN 1 AND 12000),
 citations jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(citations)='array' AND octet_length(citations::text)<=12000),
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(conversation_id,user_id) REFERENCES public.fgi_ai_conversations(id,user_id) ON DELETE CASCADE,
 UNIQUE(user_id,request_id,role)
);
CREATE INDEX fgi_ai_messages_history ON public.fgi_ai_messages(conversation_id,created_at DESC);
CREATE TABLE public.fgi_ai_plans (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK(kind IN ('training','nutrition')),
 title text NOT NULL CHECK(length(title) BETWEEN 1 AND 120),
 document jsonb NOT NULL CHECK(jsonb_typeof(document)='object' AND octet_length(document::text)<=64000),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,user_id)
);
CREATE INDEX fgi_ai_plans_user ON public.fgi_ai_plans(user_id,created_at DESC);
CREATE TABLE public.fgi_ai_workouts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 plan_id uuid,
 data jsonb NOT NULL CHECK(jsonb_typeof(data)='object' AND octet_length(data::text)<=40000),
 started_at timestamptz NOT NULL DEFAULT now(),
 completed_at timestamptz,
 FOREIGN KEY(plan_id,user_id) REFERENCES public.fgi_ai_plans(id,user_id) ON DELETE SET NULL (plan_id),
 CHECK(completed_at IS NULL OR completed_at>=started_at)
);
CREATE INDEX fgi_ai_workouts_user ON public.fgi_ai_workouts(user_id,started_at DESC);
CREATE INDEX fgi_ai_workouts_plan ON public.fgi_ai_workouts(plan_id,user_id);
CREATE TABLE public.fgi_ai_progress (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 recorded_on date NOT NULL DEFAULT CURRENT_DATE,
 weight_kg numeric(5,2) CHECK(weight_kg BETWEEN 20 AND 300),
 waist_cm numeric(5,2) CHECK(waist_cm BETWEEN 20 AND 300),
 sleep_hours numeric(3,1) CHECK(sleep_hours BETWEEN 0 AND 24),
 energy smallint CHECK(energy BETWEEN 1 AND 5),
 notes text NOT NULL DEFAULT '' CHECK(length(notes)<=1500),
 photo_path text CHECK(photo_path IS NULL OR photo_path ~ ('^'||user_id::text||'/[0-9a-f-]{36}\.jpg$')),
 UNIQUE(user_id,recorded_on)
);
CREATE TABLE public.fgi_ai_shares (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 coach_id uuid NOT NULL REFERENCES public.fgi_coaches(id) ON DELETE CASCADE,
 summary text NOT NULL CHECK(length(summary) BETWEEN 1 AND 12000),
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL DEFAULT(now()+interval '14 days'),
 CHECK(user_id<>coach_id), CHECK(expires_at>created_at AND expires_at<=created_at+interval '30 days')
);
CREATE INDEX fgi_ai_shares_user ON public.fgi_ai_shares(user_id);
CREATE INDEX fgi_ai_shares_coach ON public.fgi_ai_shares(coach_id,expires_at);

DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['fgi_ai_profiles','fgi_ai_conversations','fgi_ai_workouts','fgi_ai_progress','fgi_ai_shares'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated',t);
  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated',t);
  EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
  IF t='fgi_ai_profiles' THEN
   EXECUTE format('CREATE POLICY ai_owner ON public.%I FOR ALL TO authenticated USING(user_id=(select auth.uid())) WITH CHECK(user_id=(select auth.uid()))',t);
  ELSE
   EXECUTE format('CREATE POLICY ai_owner ON public.%I FOR ALL TO authenticated USING(user_id=(select auth.uid())) WITH CHECK(user_id=(select auth.uid()) AND EXISTS(SELECT 1 FROM public.fgi_ai_profiles WHERE user_id=(select auth.uid())))',t);
  END IF;
 END LOOP;
 FOREACH t IN ARRAY ARRAY['fgi_ai_messages','fgi_ai_plans'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated',t);
  EXECUTE format('GRANT SELECT, DELETE ON public.%I TO authenticated',t);
  EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
  EXECUTE format('CREATE POLICY ai_owner_read ON public.%I FOR SELECT TO authenticated USING(user_id=(select auth.uid()))',t);
  EXECUTE format('CREATE POLICY ai_owner_delete ON public.%I FOR DELETE TO authenticated USING(user_id=(select auth.uid()))',t);
 END LOOP;
END $$;
CREATE POLICY ai_consented_coach_read ON public.fgi_ai_shares FOR SELECT TO authenticated
 USING(coach_id=(select auth.uid()) AND expires_at>now());

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 VALUES('fgi-ai','fgi-ai',false,4194304,ARRAY['image/jpeg']) ON CONFLICT(id) DO NOTHING;
CREATE POLICY ai_photo_owner_read ON storage.objects FOR SELECT TO authenticated
 USING(bucket_id='fgi-ai' AND (storage.foldername(name))[1]=(select auth.uid())::text);
CREATE POLICY ai_photo_owner_insert ON storage.objects FOR INSERT TO authenticated
 WITH CHECK(bucket_id='fgi-ai' AND (storage.foldername(name))[1]=(select auth.uid())::text AND name ~ ('^'||(select auth.uid())::text||'/[0-9a-f-]{36}\.jpg$') AND EXISTS(SELECT 1 FROM public.fgi_ai_profiles WHERE user_id=(select auth.uid())));
CREATE POLICY ai_photo_owner_delete ON storage.objects FOR DELETE TO authenticated
 USING(bucket_id='fgi-ai' AND (storage.foldername(name))[1]=(select auth.uid())::text);

CREATE TABLE fgi_private.ai_requests (
 id uuid NOT NULL,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 request_hash text NOT NULL,
 search boolean NOT NULL DEFAULT false,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','completed','failed')),
 result jsonb,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,id)
);
CREATE INDEX ai_requests_daily ON fgi_private.ai_requests(created_at,user_id);
REVOKE ALL ON fgi_private.ai_requests FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA fgi_private TO service_role;
GRANT ALL ON fgi_private.ai_requests TO service_role;

-- Atomic budget gate; browser roles cannot invoke it or change a quota.
CREATE FUNCTION public.fgi_ai_claim(p_user uuid,p_id uuid,p_hash text,p_search boolean)
 RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE r fgi_private.ai_requests; daily integer; searches integer; global_count integer;
BEGIN
 PERFORM pg_catalog.pg_advisory_xact_lock(630031);
 DELETE FROM fgi_private.ai_requests WHERE created_at<now()-interval '24 hours';
 SELECT * INTO r FROM fgi_private.ai_requests WHERE user_id=p_user AND id=p_id;
 IF FOUND THEN
  IF r.request_hash<>p_hash THEN RETURN jsonb_build_object('error','request_conflict'); END IF;
  IF r.status='completed' THEN RETURN jsonb_build_object('cached',r.result); END IF;
  RETURN jsonb_build_object('error',CASE WHEN r.status='pending' THEN 'request_pending' ELSE 'request_failed' END);
 END IF;
 SELECT count(*),count(*) FILTER(WHERE search) INTO daily,searches FROM fgi_private.ai_requests
  WHERE user_id=p_user AND created_at>=date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
 SELECT count(*) INTO global_count FROM fgi_private.ai_requests
  WHERE created_at>=date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
 IF daily>=30 OR (p_search AND searches>=3) OR global_count>=300 THEN RETURN jsonb_build_object('error','daily_limit'); END IF;
 IF (SELECT count(*) FROM fgi_private.ai_requests WHERE user_id=p_user AND created_at>now()-interval '1 minute')>=5 THEN RETURN jsonb_build_object('error','rate_limit'); END IF;
 INSERT INTO fgi_private.ai_requests(id,user_id,request_hash,search) VALUES(p_id,p_user,p_hash,p_search);
 RETURN jsonb_build_object('remaining',29-daily,'search_remaining',3-searches-CASE WHEN p_search THEN 1 ELSE 0 END);
END $$;

-- Commit an answer and its plan together, only while the original consent is valid.
CREATE FUNCTION public.fgi_ai_claim_search(p_user uuid,p_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE searches integer;
BEGIN
 PERFORM pg_catalog.pg_advisory_xact_lock(630031);
 IF NOT EXISTS(SELECT 1 FROM fgi_private.ai_requests WHERE user_id=p_user AND id=p_id AND status='pending') THEN RETURN jsonb_build_object('error','request_missing'); END IF;
 SELECT count(*) INTO searches FROM fgi_private.ai_requests WHERE user_id=p_user AND search
  AND created_at>=date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
 IF searches>=3 THEN RETURN jsonb_build_object('error','daily_limit'); END IF;
 UPDATE fgi_private.ai_requests SET search=true WHERE user_id=p_user AND id=p_id;
 RETURN jsonb_build_object('search_remaining',2-searches);
END $$;

CREATE FUNCTION public.fgi_ai_complete(p_user uuid,p_id uuid,p_conversation uuid,p_consent timestamptz,p_input text,p_output text,p_citations jsonb,p_kind text,p_document jsonb,p_result jsonb)
 RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 PERFORM 1 FROM public.fgi_ai_profiles WHERE user_id=p_user AND updated_at=p_consent FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'consent_changed'; END IF;
 PERFORM 1 FROM public.fgi_ai_conversations WHERE id=p_conversation AND user_id=p_user FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'conversation_missing'; END IF;
 PERFORM 1 FROM fgi_private.ai_requests WHERE user_id=p_user AND id=p_id AND status='pending' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'request_missing'; END IF;
 INSERT INTO public.fgi_ai_messages(user_id,conversation_id,request_id,role,body,citations)
 VALUES(p_user,p_conversation,p_id,'user',p_input,'[]'),(p_user,p_conversation,p_id,'assistant',p_output,p_citations);
 IF p_kind IS NOT NULL THEN
  INSERT INTO public.fgi_ai_plans(id,user_id,kind,title,document)
   VALUES((p_result->>'plan_id')::uuid,p_user,p_kind,p_document->>'title',p_document);
 END IF;
 UPDATE fgi_private.ai_requests SET status='completed',result=p_result WHERE user_id=p_user AND id=p_id;
END $$;
CREATE FUNCTION public.fgi_ai_fail(p_user uuid,p_id uuid)
 RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 UPDATE fgi_private.ai_requests SET status='failed' WHERE user_id=p_user AND id=p_id AND status='pending';
$$;
CREATE FUNCTION public.fgi_ai_delete(p_user uuid)
 RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 -- Profile lock serializes deletion with completion of an in-flight request.
 PERFORM 1 FROM public.fgi_ai_profiles WHERE user_id=p_user FOR UPDATE;
 DELETE FROM public.fgi_ai_profiles WHERE user_id=p_user;
 DELETE FROM public.fgi_ai_conversations WHERE user_id=p_user;
 DELETE FROM public.fgi_ai_workouts WHERE user_id=p_user;
 DELETE FROM public.fgi_ai_plans WHERE user_id=p_user;
 DELETE FROM public.fgi_ai_progress WHERE user_id=p_user;
 DELETE FROM public.fgi_ai_shares WHERE user_id=p_user;
 -- Retain only anonymous-free budget records for 24h to prevent delete/reset quota abuse.
 UPDATE fgi_private.ai_requests SET result=NULL,request_hash='deleted',status='failed' WHERE user_id=p_user;
END $$;
REVOKE ALL ON FUNCTION public.fgi_ai_claim(uuid,uuid,text,boolean),public.fgi_ai_complete(uuid,uuid,uuid,timestamptz,text,text,jsonb,text,jsonb,jsonb),public.fgi_ai_fail(uuid,uuid),public.fgi_ai_delete(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fgi_ai_claim(uuid,uuid,text,boolean),public.fgi_ai_complete(uuid,uuid,uuid,timestamptz,text,text,jsonb,text,jsonb,jsonb),public.fgi_ai_fail(uuid,uuid),public.fgi_ai_delete(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.fgi_ai_claim_search(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fgi_ai_claim_search(uuid,uuid) TO service_role;
