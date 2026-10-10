-- Run the candidate migration and this suite inside one BEGIN/ROLLBACK.
-- Synthetic users only; no live user data or permanent schema changes.
INSERT INTO auth.users(id,aud,role,email,raw_user_meta_data,created_at,updated_at) VALUES
 ('e63c0000-0000-4000-8000-000000000001','authenticated','authenticated','workout-sql-owner@example.invalid','{}',now(),now()),
 ('e63c0000-0000-4000-8000-000000000002','authenticated','authenticated','workout-sql-other@example.invalid','{}',now(),now());
INSERT INTO public.fgi_ai_profiles(user_id,data,consent_version) VALUES
 ('e63c0000-0000-4000-8000-000000000001','{"goal":"Сила","experience":"intermediate","days_per_week":1,"minutes":40,"setting":"gym","equipment":"Штанга, скамья","restrictions":"","nutrition_preferences":{"meals_per_day":4}}','2026-10-03'),
 ('e63c0000-0000-4000-8000-000000000002','{}','2026-10-03');
INSERT INTO public.fgi_ai_conversations(id,user_id) VALUES('e63c4000-0000-4000-8000-000000000001','e63c0000-0000-4000-8000-000000000001');
INSERT INTO fgi_private.ai_friend_grants(user_id,modules,reason) VALUES('e63c0000-0000-4000-8000-000000000001',ARRAY['training'],'Rollback workout acceptance');
INSERT INTO fgi_private.ai_requests(id,user_id,request_hash)
 SELECT ('e63c3000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'e63c0000-0000-4000-8000-000000000001','workout-test' FROM generate_series(1,12) n;
INSERT INTO public.fgi_ai_plans(id,user_id,kind,title,document,status) VALUES
 ('e63c1000-0000-4000-8000-000000000001','e63c0000-0000-4000-8000-000000000001','training','Test workout','{"schema_version":2,"title":"Test workout","workouts":[{"id":"w1","number":1,"title":"Workout A","warmup":"warmup","cooldown":"cooldown","exercises":[{"id":"e1","name":"Жим штанги лёжа","sets":4,"reps":"8","rest_seconds":90}]}]}','active');
SET LOCAL ROLE service_role;
DO $$ DECLARE
 u uuid:='e63c0000-0000-4000-8000-000000000001';
 c uuid:='e63c4000-0000-4000-8000-000000000001';
 s uuid:='e63c2000-0000-4000-8000-000000000001';
 stamp timestamptz; result jsonb; prior jsonb; prior_plan jsonb; done timestamptz; rev integer;
BEGIN
 SELECT document INTO prior_plan FROM public.fgi_ai_plans WHERE id='e63c1000-0000-4000-8000-000000000001';
 SELECT updated_at INTO stamp FROM public.fgi_ai_profiles WHERE user_id=u;
 result:='{"module":"training","livemode":true,"workout_changes":[{"operation":"start","session_id":"e63c2000-0000-4000-8000-000000000001","plan_id":"e63c1000-0000-4000-8000-000000000001","workout_id":"w1","from_cursor":false}],"current_workout":{"plan_id":"e63c1000-0000-4000-8000-000000000001","workout_id":"w1","session_id":"e63c2000-0000-4000-8000-000000000001","index":0,"started_at":"2026-10-10T08:00:00Z"}}';
 PERFORM public.fgi_ai_complete(u,'e63c3000-0000-4000-8000-000000000001',c,stamp,'start','started','[]',NULL,NULL,result);
 IF (SELECT count(*) FROM public.fgi_ai_workouts WHERE user_id=u)<>1 THEN RAISE EXCEPTION 'Start did not create exactly one session'; END IF;
 SELECT data,updated_at INTO prior,stamp FROM public.fgi_ai_profiles WHERE user_id=u;
 IF prior->'nutrition_preferences'->>'meals_per_day'<>'4' THEN RAISE EXCEPTION 'Nutrition changed'; END IF;
 result:='{"module":"training","livemode":true,"workout_changes":[{"operation":"record","session_id":"e63c2000-0000-4000-8000-000000000001","revision":0,"record_id":"e63c3000-0000-4000-8000-000000000002","exercise_id":"e1","source":"chat","sets":4,"reps":8,"weight_kg":80,"rpe":null,"comment":"controlled"}]}';
 PERFORM public.fgi_ai_complete(u,'e63c3000-0000-4000-8000-000000000002',c,stamp,'80 kg 4x8','recorded','[]',NULL,NULL,result);
 SELECT data,revision INTO prior,rev FROM public.fgi_ai_workouts WHERE id=s;
 IF jsonb_array_length(prior->'sets')<>4 OR prior->'sets'->0->>'exercise'<>'Жим штанги лёжа' OR prior->'sets'->0->>'weight_kg'<>'80' OR prior->'sets'->0->'rpe'<>'null'::jsonb OR rev<>1 THEN RAISE EXCEPTION 'Actual sets or optional values incorrect'; END IF;
 -- An unexpected DB error must roll back sets, messages and the save claim.
 SELECT updated_at INTO stamp FROM public.fgi_ai_profiles WHERE user_id=u;
 result:=jsonb_set(result,'{workout_changes,0,revision}','0');
 BEGIN
  PERFORM public.fgi_ai_complete(u,'e63c3000-0000-4000-8000-000000000003',c,stamp,'stale','must not save','[]',NULL,NULL,result);
  RAISE EXCEPTION 'Stale revision accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'workout_changed' THEN RAISE; END IF; END;
 IF EXISTS(SELECT 1 FROM public.fgi_ai_messages WHERE request_id='e63c3000-0000-4000-8000-000000000003') OR (SELECT status FROM fgi_private.ai_requests WHERE id='e63c3000-0000-4000-8000-000000000003' AND user_id=u)<>'pending' THEN RAISE EXCEPTION 'Failure was not atomic'; END IF;
 result:=jsonb_set(result,'{workout_changes,0,revision}','1');
 PERFORM public.fgi_ai_complete(u,'e63c3000-0000-4000-8000-000000000004',c,stamp,'same grouped result','already recorded','[]',NULL,NULL,result);
 IF (SELECT jsonb_array_length(data->'sets') FROM public.fgi_ai_workouts WHERE id=s)<>4 THEN RAISE EXCEPTION 'Grouped report duplicated'; END IF;
 SELECT updated_at INTO stamp FROM public.fgi_ai_profiles WHERE user_id=u;
 result:='{"module":"training","livemode":true,"workout_log_pending":{"id":"e63c5000-0000-4000-8000-000000000001","mode":"completion","session_id":"e63c2000-0000-4000-8000-000000000001","session_revision":1,"details":{"duration_minutes":null,"difficulty":null,"comment":""}}}';
 PERFORM public.fgi_ai_complete(u,'e63c3000-0000-4000-8000-000000000005',c,stamp,'finished','please confirm','[]',NULL,NULL,result);
 IF (SELECT completed_at FROM public.fgi_ai_workouts WHERE id=s) IS NOT NULL THEN RAISE EXCEPTION 'Proposal finished before confirmation'; END IF;
 SELECT updated_at INTO stamp FROM public.fgi_ai_profiles WHERE user_id=u;
 result:='{"module":"training","livemode":true,"workout_changes":[{"operation":"complete","session_id":"e63c2000-0000-4000-8000-000000000001","revision":1,"confirmed":true,"duration_minutes":null,"difficulty":null,"comment":"good"}],"current_workout":null,"workout_log_pending":null}';
 PERFORM public.fgi_ai_complete(u,'e63c3000-0000-4000-8000-000000000006',c,stamp,'confirm','completed','[]',NULL,NULL,result);
 SELECT completed_at,data,revision INTO done,prior,rev FROM public.fgi_ai_workouts WHERE id=s;
 IF done IS NULL OR prior->>'status'<>'completed' OR prior->'duration_minutes'<>'null'::jsonb OR prior->'difficulty'<>'null'::jsonb OR jsonb_array_length(prior->'sets')<>4 OR rev<>2 THEN RAISE EXCEPTION 'Completion not preserved correctly'; END IF;
 SELECT updated_at INTO stamp FROM public.fgi_ai_profiles WHERE user_id=u;
 PERFORM public.fgi_ai_complete(u,'e63c3000-0000-4000-8000-000000000007',c,stamp,'repeat finish','already completed','[]',NULL,NULL,result);
 IF (SELECT count(*) FROM public.fgi_ai_workouts WHERE user_id=u)<>1 OR (SELECT data FROM public.fgi_ai_workouts WHERE id=s)<>prior OR (SELECT completed_at FROM public.fgi_ai_workouts WHERE id=s)<>done OR (SELECT revision FROM public.fgi_ai_workouts WHERE id=s)<>rev THEN RAISE EXCEPTION 'Repeat completion changed history'; END IF;
 result:=public.fgi_ai_claim(u,'e63c3000-0000-4000-8000-000000000006','workout-test',false);
 IF NOT(result ? 'cached') OR result->'cached' ? 'workout_changes' THEN RAISE EXCEPTION 'Delivery replay did not return the safe cache'; END IF;
 IF (SELECT document FROM public.fgi_ai_plans WHERE id='e63c1000-0000-4000-8000-000000000001')<>prior_plan THEN RAISE EXCEPTION 'Training program changed'; END IF;
 IF EXISTS(SELECT 1 FROM fgi_private.ai_requests ar WHERE ar.user_id=u AND ar.status='completed' AND ar.result ? 'workout_changes') THEN RAISE EXCEPTION 'Internal changes leaked to retry cache'; END IF;
 -- Foreign actor, exercise and program cannot be substituted by the service command.
 BEGIN
  PERFORM fgi_private.ai_workout_change('e63c0000-0000-4000-8000-000000000002','{"operation":"complete","session_id":"e63c2000-0000-4000-8000-000000000001","revision":1,"confirmed":true,"duration_minutes":null,"difficulty":null,"comment":""}');
  RAISE EXCEPTION 'Foreign session accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'workout_missing' THEN RAISE; END IF; END;
 SELECT updated_at INTO stamp FROM public.fgi_ai_profiles WHERE user_id=u;
 result:='{"module":"training","livemode":true,"workout_changes":[{"operation":"start","session_id":"e63c2000-0000-4000-8000-000000000002","plan_id":"e63c1000-0000-4000-8000-000000000001","workout_id":"w1","from_cursor":false}]}';
 PERFORM public.fgi_ai_complete(u,'e63c3000-0000-4000-8000-000000000008',c,stamp,'new session','started','[]',NULL,NULL,result);
 BEGIN
  PERFORM fgi_private.ai_workout_change(u,'{"operation":"record","session_id":"e63c2000-0000-4000-8000-000000000002","revision":0,"record_id":"e63c3000-0000-4000-8000-000000000010","exercise_id":"foreign-exercise","source":"form","sets":1,"reps":8,"weight_kg":80,"rpe":null,"comment":""}');
  RAISE EXCEPTION 'Foreign exercise accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'workout_missing' THEN RAISE; END IF; END;
 result:='{"module":"training","livemode":true,"workout_changes":[{"operation":"complete","session_id":"e63c2000-0000-4000-8000-000000000002","revision":0,"confirmed":true,"duration_minutes":45,"difficulty":8,"comment":"actual known values"}]}';
 PERFORM public.fgi_ai_complete(u,'e63c3000-0000-4000-8000-000000000009',c,stamp,'confirm known duration','completed','[]',NULL,NULL,result);
 IF NOT EXISTS(SELECT 1 FROM public.fgi_ai_workouts WHERE id='e63c2000-0000-4000-8000-000000000002' AND data->>'duration_minutes'='45' AND data->>'difficulty'='8' AND data->>'comment'='actual known values') THEN RAISE EXCEPTION 'Explicit completion values lost'; END IF;
 -- A previously opened 2C cursor keeps its known start time when promoted.
 UPDATE public.fgi_ai_profiles SET data=jsonb_set(data,'{current_workout}',jsonb_build_object('plan_id','e63c1000-0000-4000-8000-000000000001','workout_id','w1','index',0,'started_at',now()-interval '10 minutes')) WHERE user_id=u;
 SELECT updated_at INTO stamp FROM public.fgi_ai_profiles WHERE user_id=u;
 result:='{"module":"training","livemode":true,"workout_changes":[{"operation":"start","session_id":"e63c2000-0000-4000-8000-000000000003","plan_id":"e63c1000-0000-4000-8000-000000000001","workout_id":"w1","from_cursor":true}]}';
 PERFORM public.fgi_ai_complete(u,'e63c3000-0000-4000-8000-000000000010',c,stamp,'legacy cursor','promoted','[]',NULL,NULL,result);
 IF NOT EXISTS(SELECT 1 FROM public.fgi_ai_workouts WHERE id='e63c2000-0000-4000-8000-000000000003' AND started_at=now()-interval '10 minutes' AND completed_at IS NULL AND jsonb_array_length(data->'sets')=0) THEN RAISE EXCEPTION 'Legacy cursor was not preserved'; END IF;
 UPDATE public.fgi_ai_workouts SET data=jsonb_set(data,'{workout,exercises,0}',(data#>'{workout,exercises,0}')-'id') WHERE id='e63c2000-0000-4000-8000-000000000003';
 PERFORM fgi_private.ai_workout_change(u,'{"operation":"record","session_id":"e63c2000-0000-4000-8000-000000000003","revision":1,"record_id":"e63c3000-0000-4000-8000-000000000011","exercise_id":"legacy-exercise-0","source":"form","sets":1,"reps":8,"weight_kg":80,"rpe":null,"comment":"legacy result"}');
 IF NOT EXISTS(SELECT 1 FROM public.fgi_ai_workouts WHERE id='e63c2000-0000-4000-8000-000000000003' AND data->'sets'->0->>'exercise_id'='legacy-exercise-0' AND NOT(data#>'{workout,exercises,0}' ? 'id')) THEN RAISE EXCEPTION 'Legacy exercise identity or snapshot changed'; END IF;
END; $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"e63c0000-0000-4000-8000-000000000001","role":"authenticated"}',true);
SELECT set_config('request.jwt.claim.sub','e63c0000-0000-4000-8000-000000000001',true);
DO $$ DECLARE n integer; BEGIN
 SELECT count(*) INTO n FROM public.fgi_ai_workouts WHERE id='e63c2000-0000-4000-8000-000000000001';
 IF n<>1 THEN RAISE EXCEPTION 'Owner cannot reload completed session'; END IF;
 BEGIN
  UPDATE public.fgi_ai_workouts SET data=jsonb_set(data,'{comment}','"changed"') WHERE id='e63c2000-0000-4000-8000-000000000001';
  RAISE EXCEPTION 'Completed result was rewritten';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'workout_changed' THEN RAISE; END IF; END;
 BEGIN
  PERFORM fgi_private.ai_workout_change('e63c0000-0000-4000-8000-000000000001','{}');
  RAISE EXCEPTION 'Browser invoked internal command';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END; $$;
SELECT set_config('request.jwt.claims','{"sub":"e63c0000-0000-4000-8000-000000000002","role":"authenticated"}',true);
SELECT set_config('request.jwt.claim.sub','e63c0000-0000-4000-8000-000000000002',true);
DO $$ DECLARE n integer; BEGIN
 IF EXISTS(SELECT 1 FROM public.fgi_ai_workouts WHERE user_id='e63c0000-0000-4000-8000-000000000001') THEN RAISE EXCEPTION 'Foreign workout visible'; END IF;
 UPDATE public.fgi_ai_workouts SET data='{}' WHERE id='e63c2000-0000-4000-8000-000000000001';GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>0 THEN RAISE EXCEPTION 'Foreign workout modified'; END IF;
 BEGIN
  INSERT INTO public.fgi_ai_workouts(user_id,data) VALUES('e63c0000-0000-4000-8000-000000000001','{}');
  RAISE EXCEPTION 'Foreign workout inserted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END; $$;
RESET ROLE;
SET LOCAL ROLE anon;
DO $$ BEGIN
 BEGIN
  PERFORM 1 FROM public.fgi_ai_workouts;
  RAISE EXCEPTION 'Anonymous journal visible';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END; $$;
RESET ROLE;
