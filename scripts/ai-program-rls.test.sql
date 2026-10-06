-- Real transactional RLS and replacement tests. Every fixture rolls back.
BEGIN;
INSERT INTO auth.users(id,aud,role,email,raw_user_meta_data,created_at,updated_at) VALUES
 ('e62b2000-0000-4000-8000-000000000001','authenticated','authenticated','program-sql-owner@example.invalid','{}',now(),now()),
 ('e62b2000-0000-4000-8000-000000000002','authenticated','authenticated','program-sql-other@example.invalid','{}',now(),now());
INSERT INTO public.fgi_ai_profiles(user_id,data,consent_version) VALUES
 ('e62b2000-0000-4000-8000-000000000001','{"goal":"Сила","experience":"beginner","days_per_week":1,"minutes":25,"setting":"home","equipment":"Без оборудования","restrictions":"","memory_confirmed_fields":["restrictions"]}','2026-10-03');
INSERT INTO public.fgi_ai_conversations(id,user_id) VALUES('e62b2100-0000-4000-8000-000000000001','e62b2000-0000-4000-8000-000000000001');
INSERT INTO fgi_private.ai_friend_grants(user_id,modules,reason) VALUES('e62b2000-0000-4000-8000-000000000001',ARRAY['training'],'Rollback program test');
INSERT INTO public.fgi_ai_plans(id,user_id,kind,title,document,status) VALUES('e62b2200-0000-4000-8000-000000000001','e62b2000-0000-4000-8000-000000000001','training','Previous working program','{}','active');
INSERT INTO fgi_private.ai_requests(id,user_id,request_hash) VALUES
 ('e62b2300-0000-4000-8000-000000000001','e62b2000-0000-4000-8000-000000000001','test'),
 ('e62b2300-0000-4000-8000-000000000002','e62b2000-0000-4000-8000-000000000001','test');
SET LOCAL ROLE service_role;
DO $$ DECLARE doc jsonb; result jsonb; stamp timestamptz; BEGIN
 doc:='{"schema_version":2,"title":"New program","workouts":[{"number":1}]}';
 SELECT updated_at INTO stamp FROM public.fgi_ai_profiles WHERE user_id='e62b2000-0000-4000-8000-000000000001';
 result:='{"module":"training","livemode":true,"program_saved":true,"program_pending":false,"program_previous_id":"e62b2200-0000-4000-8000-000000000001","plan_id":"e62b2200-0000-4000-8000-000000000001","profile_snapshot":{}}';
 BEGIN
  PERFORM public.fgi_ai_complete('e62b2000-0000-4000-8000-000000000001','e62b2300-0000-4000-8000-000000000001','e62b2100-0000-4000-8000-000000000001',stamp,'question','saved','[]','training',doc,result);
  RAISE EXCEPTION 'duplicate ID should fail';
 EXCEPTION WHEN unique_violation THEN NULL; END;
 IF (SELECT status FROM public.fgi_ai_plans WHERE id='e62b2200-0000-4000-8000-000000000001')<>'active' OR EXISTS(SELECT 1 FROM public.fgi_ai_messages WHERE user_id='e62b2000-0000-4000-8000-000000000001') THEN RAISE EXCEPTION 'Failed insert did not roll back archive and save claim'; END IF;
 result:=jsonb_set(result,'{plan_id}','"e62b2200-0000-4000-8000-000000000002"');
 PERFORM public.fgi_ai_complete('e62b2000-0000-4000-8000-000000000001','e62b2300-0000-4000-8000-000000000001','e62b2100-0000-4000-8000-000000000001',stamp,'question','saved','[]','training',doc,result);
 IF (SELECT count(*) FROM public.fgi_ai_plans WHERE user_id='e62b2000-0000-4000-8000-000000000001' AND status='active')<>1 OR (SELECT status FROM public.fgi_ai_plans WHERE id='e62b2200-0000-4000-8000-000000000001')<>'archived' OR (SELECT revision FROM public.fgi_ai_plans WHERE id='e62b2200-0000-4000-8000-000000000002')<>2 THEN RAISE EXCEPTION 'Version replacement failed'; END IF;
 result:=jsonb_set(result,'{plan_id}','"e62b2200-0000-4000-8000-000000000003"');
 BEGIN
  PERFORM public.fgi_ai_complete('e62b2000-0000-4000-8000-000000000001','e62b2300-0000-4000-8000-000000000002','e62b2100-0000-4000-8000-000000000001',stamp,'question','saved','[]','training',doc,result);
  RAISE EXCEPTION 'Stale replacement was accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'program_changed' THEN RAISE; END IF; END;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','e62b2000-0000-4000-8000-000000000001',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF (SELECT count(*) FROM public.fgi_ai_plans WHERE user_id='e62b2000-0000-4000-8000-000000000001')<>2 THEN RAISE EXCEPTION 'Owner cannot read own versions'; END IF;
 IF has_table_privilege(current_user,'public.fgi_ai_plans','insert') OR has_table_privilege(current_user,'public.fgi_ai_plans','update') OR has_function_privilege(current_user,'public.fgi_ai_complete(uuid,uuid,uuid,timestamptz,text,text,jsonb,text,jsonb,jsonb)','execute') THEN RAISE EXCEPTION 'Browser can bypass validated save'; END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','e62b2000-0000-4000-8000-000000000002',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE removed integer; BEGIN
 IF EXISTS(SELECT 1 FROM public.fgi_ai_plans WHERE user_id='e62b2000-0000-4000-8000-000000000001') THEN RAISE EXCEPTION 'Foreign program readable'; END IF;
 BEGIN UPDATE public.fgi_ai_plans SET title='forged' WHERE user_id='e62b2000-0000-4000-8000-000000000001'; RAISE EXCEPTION 'Foreign program editable'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 DELETE FROM public.fgi_ai_plans WHERE user_id='e62b2000-0000-4000-8000-000000000001'; GET DIAGNOSTICS removed=ROW_COUNT;
 IF removed<>0 THEN RAISE EXCEPTION 'Foreign program deletable'; END IF;
END $$;
RESET ROLE;
DO $$ BEGIN IF (SELECT count(*) FROM public.fgi_ai_plans WHERE user_id='e62b2000-0000-4000-8000-000000000001')<>2 THEN RAISE EXCEPTION 'Foreign attempts changed source'; END IF; END $$;
ROLLBACK;
