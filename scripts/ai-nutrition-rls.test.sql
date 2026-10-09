-- Real owner isolation and atomic nutrition save; all fixtures roll back.
BEGIN;
INSERT INTO auth.users(id,aud,role,email,raw_user_meta_data,created_at,updated_at) VALUES
 ('e63a0000-0000-4000-8000-000000000001','authenticated','authenticated','nutrition-sql-owner@example.invalid','{}',now(),now()),
 ('e63a0000-0000-4000-8000-000000000002','authenticated','authenticated','nutrition-sql-other@example.invalid','{}',now(),now());
INSERT INTO public.fgi_ai_profiles(user_id,data,consent_version) VALUES
 ('e63a0000-0000-4000-8000-000000000001','{"weight_kg":80,"nutrition_preferences":{"excluded_foods":["рыба"]}}','2026-10-03');
INSERT INTO public.fgi_ai_conversations(id,user_id) VALUES('e63a1000-0000-4000-8000-000000000001','e63a0000-0000-4000-8000-000000000001');
INSERT INTO fgi_private.ai_friend_grants(user_id,modules,reason) VALUES('e63a0000-0000-4000-8000-000000000001',ARRAY['nutrition'],'Rollback nutrition acceptance');
INSERT INTO fgi_private.ai_requests(id,user_id,request_hash) VALUES
 ('e63a2000-0000-4000-8000-000000000001','e63a0000-0000-4000-8000-000000000001','nutrition-test'),
 ('e63a2000-0000-4000-8000-000000000002','e63a0000-0000-4000-8000-000000000001','nutrition-test'),
 ('e63a2000-0000-4000-8000-000000000003','e63a0000-0000-4000-8000-000000000001','nutrition-test');
SET LOCAL ROLE service_role;
DO $$ DECLARE stamp timestamptz; old_data jsonb; result jsonb; BEGIN
 SELECT updated_at INTO stamp FROM public.fgi_ai_profiles WHERE user_id='e63a0000-0000-4000-8000-000000000001';
 result:='{"module":"nutrition","livemode":true,"memory_patch":{"activity":"light","diet":"растительная пища","nutrition_pending":false,"nutrition_preferences":{"excluded_foods":["рыба","свинина"],"meals_per_day":4,"goal":"maintain"}}}';
 PERFORM public.fgi_ai_complete('e63a0000-0000-4000-8000-000000000001','e63a2000-0000-4000-8000-000000000001','e63a1000-0000-4000-8000-000000000001',stamp,'preferences','saved','[]',NULL,NULL,result);
 SELECT data,updated_at INTO old_data,stamp FROM public.fgi_ai_profiles WHERE user_id='e63a0000-0000-4000-8000-000000000001';
 IF old_data->'nutrition_preferences'->>'goal'<>'maintain' OR old_data->>'diet'<>'растительная пища' OR old_data->>'weight_kg'<>'80' OR (SELECT count(*) FROM public.fgi_ai_messages WHERE request_id='e63a2000-0000-4000-8000-000000000001')<>2 THEN RAISE EXCEPTION 'Nutrition was not saved atomically'; END IF;
 IF (SELECT q.result FROM fgi_private.ai_requests q WHERE q.id='e63a2000-0000-4000-8000-000000000001') ? 'memory_patch' THEN RAISE EXCEPTION 'Private patch duplicated in retry cache'; END IF;
 result:=jsonb_set(result,'{memory_patch,nutrition_preferences,meals_per_day}','0');
 BEGIN
  PERFORM public.fgi_ai_complete('e63a0000-0000-4000-8000-000000000001','e63a2000-0000-4000-8000-000000000002','e63a1000-0000-4000-8000-000000000001',stamp,'bad count','saved','[]',NULL,NULL,result);
  RAISE EXCEPTION 'Invalid meals accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'invalid_nutrition_meals' THEN RAISE; END IF; END;
 IF (SELECT data FROM public.fgi_ai_profiles WHERE user_id='e63a0000-0000-4000-8000-000000000001') IS DISTINCT FROM old_data OR EXISTS(SELECT 1 FROM public.fgi_ai_messages WHERE request_id='e63a2000-0000-4000-8000-000000000002') THEN RAISE EXCEPTION 'Failed validation left a save or messages'; END IF;
 result:='{"module":"nutrition","livemode":true,"memory_patch":{"nutrition_preferences":{"goal":"loss"}}}';
 BEGIN
  PERFORM public.fgi_ai_complete('e63a0000-0000-4000-8000-000000000001','e63a2000-0000-4000-8000-000000000003','e63a1000-0000-4000-8000-000000000001',stamp-interval '1 second','stale','saved','[]',NULL,NULL,result);
  RAISE EXCEPTION 'Stale profile accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'consent_changed' THEN RAISE; END IF; END;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','e63a0000-0000-4000-8000-000000000001',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF (SELECT data->'nutrition_preferences'->>'goal' FROM public.fgi_ai_profiles WHERE user_id='e63a0000-0000-4000-8000-000000000001')<>'maintain' THEN RAISE EXCEPTION 'Owner cannot reload preferences'; END IF;
 IF has_function_privilege(current_user,'public.fgi_ai_complete(uuid,uuid,uuid,timestamptz,text,text,jsonb,text,jsonb,jsonb)','execute') THEN RAISE EXCEPTION 'Browser can bypass controlled backend'; END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','e63a0000-0000-4000-8000-000000000002',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE changed integer; BEGIN
 IF EXISTS(SELECT 1 FROM public.fgi_ai_profiles WHERE user_id='e63a0000-0000-4000-8000-000000000001') OR EXISTS(SELECT 1 FROM public.fgi_ai_messages WHERE user_id='e63a0000-0000-4000-8000-000000000001') THEN RAISE EXCEPTION 'Foreign nutrition readable'; END IF;
 UPDATE public.fgi_ai_profiles SET data='{}' WHERE user_id='e63a0000-0000-4000-8000-000000000001';GET DIAGNOSTICS changed=ROW_COUNT;
 IF changed<>0 THEN RAISE EXCEPTION 'Foreign nutrition editable'; END IF;
END $$;
RESET ROLE;
SELECT 'nutrition memory save, reload, bounds, conflict, cache and owner/foreign RLS passed' AS result;
ROLLBACK;
