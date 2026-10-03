-- Run as a database administrator. All fixtures and writes roll back.
BEGIN;
INSERT INTO auth.users(id,aud,role,email,raw_user_meta_data,created_at,updated_at) VALUES
 ('10000000-0000-4000-8000-000000000001','authenticated','authenticated','ai-owner-fixture@example.invalid','{}',now(),now()),
 ('10000000-0000-4000-8000-000000000002','authenticated','authenticated','ai-other-fixture@example.invalid','{}',now(),now()),
 ('10000000-0000-4000-8000-000000000003','authenticated','authenticated','ai-coach-fixture@example.invalid','{}',now(),now());
INSERT INTO public.fgi_coaches(id,name,sport,published) VALUES('10000000-0000-4000-8000-000000000003','AI test fixture','fitness',true);
INSERT INTO public.fgi_ai_profiles(user_id,data,consent_version) VALUES
 ('10000000-0000-4000-8000-000000000001','{"goal":"private owner goal"}','2026-10-03'),
 ('10000000-0000-4000-8000-000000000002','{}','2026-10-03');
INSERT INTO public.fgi_ai_conversations(id,user_id) VALUES('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001');
INSERT INTO public.fgi_ai_messages(user_id,conversation_id,request_id,role,body) VALUES
 ('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','assistant','private owner message');
INSERT INTO public.fgi_ai_plans(id,user_id,kind,title,document) VALUES('40000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','training','private plan','{}');
INSERT INTO public.fgi_ai_workouts(user_id,plan_id,data) VALUES('10000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','{}');
INSERT INTO public.fgi_ai_progress(user_id,weight_kg) VALUES('10000000-0000-4000-8000-000000000001',80);
INSERT INTO public.fgi_ai_shares(user_id,coach_id,summary) VALUES('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000003','only the consented snapshot');

SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF (SELECT count(*) FROM public.fgi_ai_messages)<>1 OR (SELECT count(*) FROM public.fgi_ai_profiles)<>1 THEN RAISE EXCEPTION 'Owner read failed'; END IF;
 IF has_function_privilege(current_user,'public.fgi_ai_claim(uuid,uuid,text,boolean)','execute') THEN RAISE EXCEPTION 'Browser can allocate budgets'; END IF;
 BEGIN
  INSERT INTO public.fgi_ai_messages(user_id,conversation_id,request_id,role,body) VALUES('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',gen_random_uuid(),'assistant','forged');
  RAISE EXCEPTION 'Browser forged an assistant message';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  INSERT INTO public.fgi_ai_plans(user_id,kind,title,document) VALUES('10000000-0000-4000-8000-000000000001','training','forged','{}');
  RAISE EXCEPTION 'Browser forged a plan';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 UPDATE public.fgi_ai_profiles SET data='{"goal":"edited"}' WHERE user_id='10000000-0000-4000-8000-000000000001';
 INSERT INTO storage.objects(bucket_id,name,owner_id) VALUES('fgi-ai','10000000-0000-4000-8000-000000000001/60000000-0000-4000-8000-000000000001.jpg','10000000-0000-4000-8000-000000000001');
 UPDATE public.fgi_ai_progress SET photo_path='10000000-0000-4000-8000-000000000001/60000000-0000-4000-8000-000000000001.jpg' WHERE user_id='10000000-0000-4000-8000-000000000001';
 IF (SELECT count(*) FROM storage.objects WHERE bucket_id='fgi-ai' AND name LIKE '10000000-0000-4000-8000-000000000001/%')<>1 THEN RAISE EXCEPTION 'Owner cannot read photo metadata'; END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF (SELECT count(*) FROM public.fgi_ai_messages)<>0 OR (SELECT count(*) FROM public.fgi_ai_plans)<>0 OR (SELECT count(*) FROM public.fgi_ai_workouts)<>0 OR (SELECT count(*) FROM public.fgi_ai_progress)<>0 OR (SELECT count(*) FROM public.fgi_ai_shares)<>0 THEN RAISE EXCEPTION 'Another account can read private data'; END IF;
 IF EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='fgi-ai' AND name LIKE '10000000-0000-4000-8000-000000000001/%') THEN RAISE EXCEPTION 'Another account can read private photos'; END IF;
 BEGIN
  INSERT INTO storage.objects(bucket_id,name,owner_id) VALUES('fgi-ai','10000000-0000-4000-8000-000000000001/60000000-0000-4000-8000-000000000002.jpg','10000000-0000-4000-8000-000000000002');
  RAISE EXCEPTION 'Another account can upload to owner folder';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  INSERT INTO public.fgi_ai_progress(user_id,weight_kg) VALUES('10000000-0000-4000-8000-000000000001',65);
  RAISE EXCEPTION 'Another account can write owner data';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF (SELECT count(*) FROM public.fgi_ai_shares)<>1 THEN RAISE EXCEPTION 'Consented coach cannot read snapshot'; END IF;
 IF (SELECT count(*) FROM public.fgi_ai_messages)<>0 OR (SELECT count(*) FROM public.fgi_ai_progress)<>0 OR (SELECT count(*) FROM public.fgi_ai_profiles)<>0 THEN RAISE EXCEPTION 'Coach can read source data'; END IF;
END $$;
RESET ROLE;
UPDATE public.fgi_ai_shares SET expires_at=now()-interval '1 day',created_at=now()-interval '2 days' WHERE user_id='10000000-0000-4000-8000-000000000001';
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN IF (SELECT count(*) FROM public.fgi_ai_shares)<>0 THEN RAISE EXCEPTION 'Expired snapshot remains visible'; END IF; END $$;
RESET ROLE;
SET LOCAL ROLE anon;
DO $$ BEGIN
 IF has_table_privilege(current_user,'public.fgi_ai_profiles','select') OR has_table_privilege(current_user,'public.fgi_ai_messages','select') OR has_function_privilege(current_user,'public.fgi_ai_delete(uuid)','execute') THEN RAISE EXCEPTION 'Anonymous AI access granted'; END IF;
END $$;
RESET ROLE;
SET LOCAL ROLE service_role;
DO $$ DECLARE result jsonb; v integer; BEGIN
 FOR v IN 1..3 LOOP
  result=public.fgi_ai_claim('10000000-0000-4000-8000-000000000001',gen_random_uuid(),'fixture',true);
  IF result ? 'error' THEN RAISE EXCEPTION 'Unexpected search quota result %',result; END IF;
 END LOOP;
 result=public.fgi_ai_claim('10000000-0000-4000-8000-000000000001',gen_random_uuid(),'fixture',true);
 IF result->>'error'<>'daily_limit' THEN RAISE EXCEPTION 'Search quota not enforced'; END IF;
 INSERT INTO fgi_private.ai_requests(id,user_id,request_hash,created_at)
  SELECT gen_random_uuid(),'10000000-0000-4000-8000-000000000001','fixture',now()-interval '10 minutes' FROM generate_series(1,26);
 result=public.fgi_ai_claim('10000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','fixture',false);
 IF result->>'remaining'<>'0' THEN RAISE EXCEPTION 'Daily count wrong'; END IF;
 result=public.fgi_ai_claim('10000000-0000-4000-8000-000000000001',gen_random_uuid(),'fixture',false);
 IF result->>'error'<>'daily_limit' THEN RAISE EXCEPTION 'Daily quota not enforced'; END IF;
 PERFORM public.fgi_ai_complete('10000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',(SELECT updated_at FROM public.fgi_ai_profiles WHERE user_id='10000000-0000-4000-8000-000000000001'),'question','answer','[]',NULL,NULL,'{"answer":"cached"}');
 result=public.fgi_ai_claim('10000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','fixture',false);
 IF result->'cached'->>'answer'<>'cached' THEN RAISE EXCEPTION 'Idempotent answer unavailable'; END IF;
 result=public.fgi_ai_claim('10000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','different',false);
 IF result->>'error'<>'request_conflict' THEN RAISE EXCEPTION 'Request hash not enforced'; END IF;
 PERFORM public.fgi_ai_delete('10000000-0000-4000-8000-000000000001');
 IF EXISTS(SELECT 1 FROM public.fgi_ai_profiles WHERE user_id='10000000-0000-4000-8000-000000000001') OR EXISTS(SELECT 1 FROM public.fgi_ai_messages WHERE user_id='10000000-0000-4000-8000-000000000001') OR EXISTS(SELECT 1 FROM public.fgi_ai_plans WHERE user_id='10000000-0000-4000-8000-000000000001') OR EXISTS(SELECT 1 FROM public.fgi_ai_progress WHERE user_id='10000000-0000-4000-8000-000000000001') OR EXISTS(SELECT 1 FROM public.fgi_ai_shares WHERE user_id='10000000-0000-4000-8000-000000000001') THEN RAISE EXCEPTION 'AI deletion incomplete'; END IF;
 IF EXISTS(SELECT 1 FROM fgi_private.ai_requests r WHERE r.user_id='10000000-0000-4000-8000-000000000001' AND (r.result IS NOT NULL OR r.request_hash<>'deleted')) THEN RAISE EXCEPTION 'Deleted content retained'; END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
 IF (SELECT count(*) FROM public.profiles WHERE id='10000000-0000-4000-8000-000000000001')<>1 THEN RAISE EXCEPTION 'AI deletion changed main account'; END IF;
 IF (SELECT public FROM storage.buckets WHERE id='fgi-ai') THEN RAISE EXCEPTION 'AI photo bucket is public'; END IF;
END $$;
ROLLBACK;
SELECT 'AI owner isolation, coach consent/expiry, immutable outputs, quotas, idempotency and deletion passed; fixtures rolled back' AS verification;
