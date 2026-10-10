-- Actual transaction and owner/foreign RLS; synthetic fixtures are rolled back.
-- Compact portion fixtures test storage/ACL. Full composition is validated by Node and live UI tests.
BEGIN;
INSERT INTO auth.users(id,aud,role,email,raw_user_meta_data,created_at,updated_at) VALUES
 ('e63b0000-0000-4000-8000-000000000001','authenticated','authenticated','meal-sql-owner@example.invalid','{}',now(),now()),
 ('e63b0000-0000-4000-8000-000000000002','authenticated','authenticated','meal-sql-other@example.invalid','{}',now(),now());
INSERT INTO public.fgi_ai_profiles(user_id,data,consent_version) VALUES('e63b0000-0000-4000-8000-000000000001',$fgi_test${"age":28,"height_cm":180,"weight_kg":80,"activity":"light","goal":"Похудение","allergies":[],"restrictions":"","days_per_week":3,"nutrition_preferences":{"meals_per_day":4}}$fgi_test$::jsonb,'2026-10-03');
INSERT INTO public.fgi_ai_conversations(id,user_id) VALUES('e63b1000-0000-4000-8000-000000000001','e63b0000-0000-4000-8000-000000000001');
INSERT INTO fgi_private.ai_friend_grants(user_id,modules,reason) VALUES('e63b0000-0000-4000-8000-000000000001',ARRAY['nutrition'],'Rollback meal acceptance');
INSERT INTO fgi_private.ai_requests(id,user_id,request_hash)
SELECT ('e63b2000-0000-4000-8000-00000000000'||n)::uuid,'e63b0000-0000-4000-8000-000000000001','meal-test' FROM generate_series(1,8) n;
SET LOCAL ROLE service_role;
DO $$ DECLARE
 u uuid:='e63b0000-0000-4000-8000-000000000001';
 c uuid:='e63b1000-0000-4000-8000-000000000001';
 v1 uuid:='e63b3000-0000-4000-8000-000000000001';
 v2 uuid:='e63b3000-0000-4000-8000-000000000002';
 req uuid[];
 doc1 jsonb:=$fgi_test${"schema_version":3,"title":"Твой базовый рацион на день","calories":2102,"protein_g":128.3,"fat_g":69.9,"carbs_g":239.9,"meals":[{"id":"meal-1","name":"Завтрак","items":[{"id":"meal-1-food-1","food_id":"oats","quantity_g":75,"protein_g":9.8,"fat_g":5.3,"carbs_g":45},{"id":"meal-1-food-2","food_id":"egg","quantity_g":150,"protein_g":19.5,"fat_g":15,"carbs_g":1.5},{"id":"meal-1-food-3","food_id":"banana","quantity_g":120,"protein_g":1.2,"fat_g":0.4,"carbs_g":27.6}]},{"id":"meal-2","name":"Обед","items":[{"id":"meal-2-food-1","food_id":"rice","quantity_g":95,"protein_g":6.7,"fat_g":1,"carbs_g":74.1},{"id":"meal-2-food-2","food_id":"chicken","quantity_g":140,"protein_g":32.2,"fat_g":2.8,"carbs_g":0},{"id":"meal-2-food-3","food_id":"vegetables","quantity_g":150,"protein_g":2.3,"fat_g":0.5,"carbs_g":7.5},{"id":"meal-2-food-4","food_id":"olive_oil","quantity_g":11,"protein_g":0,"fat_g":11,"carbs_g":0}]},{"id":"meal-3","name":"Ужин","items":[{"id":"meal-3-food-1","food_id":"potato","quantity_g":250,"protein_g":5,"fat_g":0.5,"carbs_g":42.5},{"id":"meal-3-food-2","food_id":"white_fish","quantity_g":150,"protein_g":27,"fat_g":1.5,"carbs_g":0},{"id":"meal-3-food-3","food_id":"vegetables","quantity_g":150,"protein_g":2.3,"fat_g":0.5,"carbs_g":7.5},{"id":"meal-3-food-4","food_id":"olive_oil","quantity_g":10,"protein_g":0,"fat_g":10,"carbs_g":0}]},{"id":"meal-4","name":"Перекус","items":[{"id":"meal-4-food-1","food_id":"apple","quantity_g":160,"protein_g":0.5,"fat_g":0.3,"carbs_g":22.4},{"id":"meal-4-food-2","food_id":"yogurt","quantity_g":180,"protein_g":14.4,"fat_g":3.6,"carbs_g":7.2},{"id":"meal-4-food-3","food_id":"almonds","quantity_g":35,"protein_g":7.4,"fat_g":17.5,"carbs_g":4.6}]}]}$fgi_test$::jsonb; doc2 jsonb:=jsonb_set(doc1,'{meals,1,items,1}',$fgi_test${"id":"meal-2-food-2","food_id":"turkey","quantity_g":130,"protein_g":31.2,"fat_g":2.6,"carbs_g":0}$fgi_test$::jsonb)||$fgi_test${"calories":2096,"protein_g":127.3,"fat_g":69.7,"carbs_g":239.9}$fgi_test$::jsonb; facts jsonb:=$fgi_test${"age":28,"height_cm":180,"weight_kg":80,"activity":"light","goal":"Похудение","days_per_week":3,"diet":"","preferences":{"meals_per_day":4},"allergies":[],"restrictions":"","needs_professional":false}$fgi_test$::jsonb; stamp timestamptz; original jsonb; old_data jsonb; BEGIN
 SELECT array_agg(id ORDER BY id) INTO req FROM fgi_private.ai_requests WHERE user_id=u;
 SELECT updated_at INTO stamp FROM public.fgi_ai_profiles WHERE user_id=u;
 PERFORM public.fgi_ai_complete(u,req[1],c,stamp,'synthetic meal test','verified result','[]',NULL,NULL,jsonb_build_object('module','nutrition','livemode',true,'nutrition_plan_pending',jsonb_build_object('id',v1,'mode','proposal','base_plan_id',NULL,'profile_snapshot',facts,'document',doc1,'changes',$fgi_test$[]$fgi_test$::jsonb)));
 IF EXISTS(SELECT 1 FROM public.fgi_ai_plans WHERE user_id=u) OR (SELECT data->'nutrition_plan_pending'->>'id' FROM public.fgi_ai_profiles WHERE user_id=u)<>v1::text THEN RAISE EXCEPTION 'proposal became an accepted plan'; END IF;
 SELECT updated_at INTO stamp FROM public.fgi_ai_profiles WHERE user_id=u;
 BEGIN
 PERFORM public.fgi_ai_complete(u,req[2],c,stamp,'synthetic meal test','verified result','[]','nutrition',doc1,jsonb_build_object('module','nutrition','livemode',true,'plan_id',v1));
 RAISE EXCEPTION 'unconfirmed plan accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'invalid_nutrition_plan' THEN RAISE; END IF; END;
 IF EXISTS(SELECT 1 FROM public.fgi_ai_messages WHERE request_id=req[2]) THEN RAISE EXCEPTION 'failed confirmation left messages'; END IF;
 PERFORM public.fgi_ai_complete(u,req[2],c,stamp,'synthetic meal test','verified result','[]','nutrition',doc1,jsonb_build_object('module','nutrition','livemode',true,'plan_id',v1,'nutrition_saved',true,'nutrition_previous_id',NULL,'profile_snapshot',facts,'nutrition_plan_pending',NULL));
 IF (SELECT count(*) FROM public.fgi_ai_plans WHERE user_id=u AND status='active')<>1 OR (SELECT revision FROM public.fgi_ai_plans WHERE id=v1)<>1 OR (SELECT data->'nutrition_plan_pending' FROM public.fgi_ai_profiles WHERE user_id=u)<>'null'::jsonb THEN RAISE EXCEPTION 'acceptance or draft cleanup failed'; END IF;
 SELECT document INTO original FROM public.fgi_ai_plans WHERE id=v1;
 SELECT updated_at INTO stamp FROM public.fgi_ai_profiles WHERE user_id=u;
 BEGIN
 PERFORM public.fgi_ai_complete(u,req[2],c,stamp,'synthetic meal test','verified result','[]','nutrition',doc1,jsonb_build_object('module','nutrition','livemode',true,'plan_id',v1,'nutrition_saved',true,'nutrition_previous_id',NULL,'profile_snapshot',facts,'nutrition_plan_pending',NULL));
 RAISE EXCEPTION 'completion replay accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'request_missing' THEN RAISE; END IF; END;
 PERFORM public.fgi_ai_complete(u,req[3],c,stamp,'synthetic meal test','verified result','[]',NULL,NULL,jsonb_build_object('module','nutrition','livemode',true,'nutrition_plan_pending',jsonb_build_object('id',v2,'mode','proposal','base_plan_id',v1,'profile_snapshot',facts,'document',doc2,'changes',$fgi_test$[]$fgi_test$::jsonb)));
 IF (SELECT document FROM public.fgi_ai_plans WHERE id=v1) IS DISTINCT FROM original THEN RAISE EXCEPTION 'replacement modified accepted document'; END IF;
 SELECT updated_at INTO stamp FROM public.fgi_ai_profiles WHERE user_id=u;
 BEGIN
 PERFORM public.fgi_ai_complete(u,req[4],c,stamp,'synthetic meal test','verified result','[]','nutrition',doc1,jsonb_build_object('module','nutrition','livemode',true,'plan_id',v2,'nutrition_saved',true,'nutrition_previous_id',v1,'profile_snapshot',facts,'nutrition_plan_pending',NULL));
 RAISE EXCEPTION 'different document accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'invalid_nutrition_plan' THEN RAISE; END IF; END;
 PERFORM public.fgi_ai_complete(u,req[4],c,stamp,'synthetic meal test','verified result','[]','nutrition',doc2,jsonb_build_object('module','nutrition','livemode',true,'plan_id',v2,'nutrition_saved',true,'nutrition_previous_id',v1,'profile_snapshot',facts,'nutrition_plan_pending',NULL));
 IF (SELECT count(*) FROM public.fgi_ai_plans WHERE user_id=u)<>2 OR (SELECT count(*) FROM public.fgi_ai_plans WHERE user_id=u AND status='active')<>1 OR (SELECT revision FROM public.fgi_ai_plans WHERE id=v2)<>2 OR (SELECT supersedes_id FROM public.fgi_ai_plans WHERE id=v2)<>v1 OR (SELECT document FROM public.fgi_ai_plans WHERE id=v1) IS DISTINCT FROM original THEN RAISE EXCEPTION 'version archive or exact old document failed'; END IF;
 SELECT data,updated_at INTO old_data,stamp FROM public.fgi_ai_profiles WHERE user_id=u;
 BEGIN
 PERFORM public.fgi_ai_complete(u,req[5],c,stamp,'synthetic meal test','verified result','[]',NULL,NULL,jsonb_build_object('module','nutrition','livemode',true,'nutrition_plan_pending',jsonb_build_object('id','e63b3000-0000-4000-8000-000000000003','mode','proposal','base_plan_id',NULL,'profile_snapshot',facts,'document',doc1,'changes',$fgi_test$[]$fgi_test$::jsonb)));
 RAISE EXCEPTION 'stale base accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'nutrition_plan_changed' THEN RAISE; END IF; END;
 BEGIN
 PERFORM public.fgi_ai_complete(u,req[6],c,stamp,'synthetic meal test','verified result','[]',NULL,NULL,jsonb_build_object('module','nutrition','livemode',true,'nutrition_plan_pending',jsonb_build_object('id','e63b3000-0000-4000-8000-000000000003','base_plan_id',v2)));
 RAISE EXCEPTION 'missing mode accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'invalid_nutrition_state' THEN RAISE; END IF; END;
 stamp:=stamp-interval '1 second';
 BEGIN
 PERFORM public.fgi_ai_complete(u,req[7],c,stamp,'synthetic meal test','verified result','[]',NULL,NULL,jsonb_build_object('module','nutrition','livemode',true,'nutrition_plan_pending',NULL));
 RAISE EXCEPTION 'stale profile accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'consent_changed' THEN RAISE; END IF; END;
 IF (SELECT data FROM public.fgi_ai_profiles WHERE user_id=u) IS DISTINCT FROM old_data OR EXISTS(SELECT 1 FROM public.fgi_ai_messages WHERE request_id IN (req[5],req[6],req[7])) THEN RAISE EXCEPTION 'failure left profile changes or messages'; END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','e63b0000-0000-4000-8000-000000000001',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.fgi_ai_plans WHERE user_id='e63b0000-0000-4000-8000-000000000001' AND status='active' AND id='e63b3000-0000-4000-8000-000000000002' AND document->'meals'->1->'items'->1->>'food_id'='turkey') THEN RAISE EXCEPTION 'owner cannot reload current menu'; END IF;
 IF has_function_privilege(current_user,'public.fgi_ai_complete(uuid,uuid,uuid,timestamptz,text,text,jsonb,text,jsonb,jsonb)','execute') OR has_table_privilege(current_user,'public.fgi_ai_plans','INSERT') OR has_table_privilege(current_user,'public.fgi_ai_plans','UPDATE') THEN RAISE EXCEPTION 'browser can bypass confirmation backend'; END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','e63b0000-0000-4000-8000-000000000002',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE changed integer; BEGIN
 IF EXISTS(SELECT 1 FROM public.fgi_ai_plans WHERE user_id='e63b0000-0000-4000-8000-000000000001') OR EXISTS(SELECT 1 FROM public.fgi_ai_profiles WHERE user_id='e63b0000-0000-4000-8000-000000000001') THEN RAISE EXCEPTION 'foreign menu or draft readable'; END IF;
 UPDATE public.fgi_ai_profiles SET data='{}' WHERE user_id='e63b0000-0000-4000-8000-000000000001';GET DIAGNOSTICS changed=ROW_COUNT;
 IF changed<>0 THEN RAISE EXCEPTION 'foreign draft editable'; END IF;
END $$;
RESET ROLE;
SELECT 'meal proposal, confirmation, archive, nonce, stale profile/base, rollback and owner/foreign RLS passed' AS result;
ROLLBACK;
