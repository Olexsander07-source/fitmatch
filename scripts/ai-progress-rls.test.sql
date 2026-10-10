-- Apply the candidate migrations plus this suite inside BEGIN / ROLLBACK only.
INSERT INTO auth.users(id,aud,role,email,raw_user_meta_data,created_at,updated_at) VALUES
 ('e63d0000-0000-4000-8000-000000000001','authenticated','authenticated','progress-owner@example.invalid','{}',now(),now()),
 ('e63d0000-0000-4000-8000-000000000002','authenticated','authenticated','progress-other@example.invalid','{}',now(),now());
INSERT INTO public.fgi_ai_profiles(user_id,data,consent_version) VALUES
 ('e63d0000-0000-4000-8000-000000000001','{"goal":"Сила","nutrition_preferences":{"meals_per_day":4}}','2026-10-03'),
 ('e63d0000-0000-4000-8000-000000000002','{}','2026-10-03');
INSERT INTO public.fgi_ai_conversations(id,user_id) VALUES('e63d4000-0000-4000-8000-000000000001','e63d0000-0000-4000-8000-000000000001');
INSERT INTO fgi_private.ai_friend_grants(user_id,modules,reason) VALUES('e63d0000-0000-4000-8000-000000000001',ARRAY['training'],'Rollback 3D acceptance');
INSERT INTO fgi_private.ai_requests(id,user_id,request_hash) SELECT ('e63d3000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'e63d0000-0000-4000-8000-000000000001','progress-test' FROM generate_series(1,5) n;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"e63d0000-0000-4000-8000-000000000001","role":"authenticated"}',true);
SELECT set_config('request.jwt.claim.sub','e63d0000-0000-4000-8000-000000000001',true);
DO $$ DECLARE u uuid:='e63d0000-0000-4000-8000-000000000001'; p jsonb; n integer; BEGIN
 INSERT INTO public.fgi_ai_progress(id,user_id,recorded_on,weight_kg,notes) VALUES('e63d2000-0000-4000-8000-000000000001',u,CURRENT_DATE-9,85,'First measurement');
 INSERT INTO public.fgi_ai_progress(id,user_id,recorded_on,weight_kg,notes) VALUES('e63d2000-0000-4000-8000-000000000002',u,CURRENT_DATE-2,84,'Recent measurement');
 INSERT INTO public.fgi_ai_progress(id,user_id,recorded_on,weight_kg,notes) VALUES('e63d2000-0000-4000-8000-000000000003',u,CURRENT_DATE-6,84.5,'Backdated measurement');
 SELECT data INTO p FROM public.fgi_ai_profiles WHERE user_id=u;
 IF (p->>'weight_kg')::numeric<>84 OR p->>'weight_recorded_on'<>(CURRENT_DATE-2)::text THEN RAISE EXCEPTION 'Backdated row overwrote current profile weight'; END IF;
 INSERT INTO public.fgi_ai_progress(id,user_id,recorded_on,weight_kg,notes) VALUES('e63d2000-0000-4000-8000-000000000004',u,CURRENT_DATE-2,83.5,'Another measurement, same date');
 IF (SELECT count(*) FROM public.fgi_ai_progress WHERE user_id=u)<>4 OR (SELECT (data->>'weight_kg')::numeric FROM public.fgi_ai_profiles WHERE user_id=u)<>83.5 THEN RAISE EXCEPTION 'Same-day history lost or profile inconsistent'; END IF;
 INSERT INTO public.fgi_ai_progress(id,user_id,recorded_on,weight_kg,notes) VALUES('e63d2000-0000-4000-8000-000000000004',u,CURRENT_DATE-2,83.5,'Another measurement, same date') ON CONFLICT(id) DO NOTHING;
 IF (SELECT count(*) FROM public.fgi_ai_progress WHERE user_id=u)<>4 THEN RAISE EXCEPTION 'Form retry duplicated measurement'; END IF;
 BEGIN UPDATE public.fgi_ai_progress SET weight_kg=90 WHERE id='e63d2000-0000-4000-8000-000000000001';RAISE EXCEPTION 'Measurement overwritten'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'progress_immutable' THEN RAISE; END IF; END;
 UPDATE public.fgi_ai_profiles SET data=data||'{"weight_kg":null}' WHERE user_id=u;
 IF (SELECT (data->>'weight_kg')::numeric FROM public.fgi_ai_profiles WHERE user_id=u)<>83.5 THEN RAISE EXCEPTION 'Profile clearing contradicted history'; END IF;
 UPDATE public.fgi_ai_progress SET photo_path=u::text||'/e63d2000-0000-4000-8000-000000000001.jpg' WHERE id='e63d2000-0000-4000-8000-000000000001';
 -- Photo deletion remains allowed without altering the actual measurement.
 UPDATE public.fgi_ai_progress SET photo_path=NULL WHERE id='e63d2000-0000-4000-8000-000000000001';
 BEGIN INSERT INTO public.fgi_ai_progress(user_id,recorded_on,weight_kg) VALUES(u,CURRENT_DATE+1,80);RAISE EXCEPTION 'Future date accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'invalid_progress' THEN RAISE; END IF; END;
 UPDATE public.fgi_ai_profiles SET data=data||'{"weight_kg":83,"progress_timezone":"UTC"}' WHERE user_id=u;
 IF (SELECT count(*) FROM public.fgi_ai_progress WHERE user_id=u)<>5 OR NOT EXISTS(SELECT 1 FROM public.fgi_ai_progress WHERE user_id=u AND source='profile' AND recorded_on=CURRENT_DATE AND weight_kg=83) THEN RAISE EXCEPTION 'Profile edit did not retain dated history'; END IF;
 SELECT data INTO p FROM public.fgi_ai_profiles WHERE user_id=u;
 IF p->'nutrition_preferences'->>'meals_per_day'<>'4' THEN RAISE EXCEPTION 'Nutrition preferences changed'; END IF;
END; $$;
RESET ROLE;
SET LOCAL ROLE service_role;
DO $$ DECLARE u uuid:='e63d0000-0000-4000-8000-000000000001'; c uuid:='e63d4000-0000-4000-8000-000000000001'; stamp timestamptz; r jsonb; h jsonb; n integer; BEGIN
 SELECT updated_at INTO stamp FROM public.fgi_ai_profiles WHERE user_id=u;
 r:=jsonb_build_object('module','training','livemode',true,'progress_saved',true,'progress_record',jsonb_build_object('recorded_on',CURRENT_DATE,'weight_kg',82.9,'notes','Chat measurement','timezone','UTC','source','chat'));
 PERFORM public.fgi_ai_complete(u,'e63d3000-0000-4000-8000-000000000001',c,stamp,'Запиши мой вес 82,9 кг','saved','[]',NULL,NULL,r);
 IF (SELECT count(*) FROM public.fgi_ai_progress WHERE user_id=u)<>6 OR (SELECT (data->>'weight_kg')::numeric FROM public.fgi_ai_profiles WHERE user_id=u)<>82.9 THEN RAISE EXCEPTION 'Chat save was not consistent'; END IF;
 h:=public.fgi_ai_claim(u,'e63d3000-0000-4000-8000-000000000001','progress-test',false);
 IF NOT(h ? 'cached') OR h->'cached' ? 'progress_record' THEN RAISE EXCEPTION 'Replay missing or exposes internal record'; END IF;
 PERFORM fgi_private.ai_progress_change(u,'e63d3000-0000-4000-8000-000000000001',r->'progress_record');
 IF (SELECT count(*) FROM public.fgi_ai_progress WHERE user_id=u)<>6 THEN RAISE EXCEPTION 'Chat replay duplicated measurement'; END IF;
 -- Stale profile makes the entire save, message and nonce fail together.
 BEGIN PERFORM public.fgi_ai_complete(u,'e63d3000-0000-4000-8000-000000000002',c,stamp-interval '1 second','stale','must not save','[]',NULL,NULL,r);RAISE EXCEPTION 'Stale accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'consent_changed' THEN RAISE; END IF; END;
 IF EXISTS(SELECT 1 FROM public.fgi_ai_messages WHERE request_id='e63d3000-0000-4000-8000-000000000002') OR EXISTS(SELECT 1 FROM public.fgi_ai_progress WHERE id='e63d3000-0000-4000-8000-000000000002') THEN RAISE EXCEPTION 'Failure not atomic'; END IF;
 SELECT updated_at INTO stamp FROM public.fgi_ai_profiles WHERE user_id=u;
 PERFORM public.fgi_ai_complete(u,'e63d3000-0000-4000-8000-000000000003',c,stamp,'Мой вес 82 кг и цель Сила','saved','[]',NULL,NULL,'{"module":"training","livemode":true,"memory_patch":{"weight_kg":82},"measurement_timezone":"UTC"}');
 IF (SELECT count(*) FROM public.fgi_ai_progress WHERE user_id=u)<>7 OR (SELECT (data->>'weight_kg')::numeric FROM public.fgi_ai_profiles WHERE user_id=u)<>82 THEN RAISE EXCEPTION 'Existing sports memory lost weight history'; END IF;
 INSERT INTO public.fgi_ai_workouts(id,user_id,started_at,completed_at,data) VALUES
 ('e63d5000-0000-4000-8000-000000000001',u,now()-interval '2 days 1 hour',now()-interval '2 days','{"status":"completed","workout":{"title":"Real A"},"sets":[{"exercise":"Жим лёжа","weight_kg":80,"reps":8}]}'),
 ('e63d5000-0000-4000-8000-000000000002',u,now()-interval '1 day 1 hour',now()-interval '1 day','{"status":"stopped","workout":{"title":"Stopped"},"sets":[{"exercise":"Жим лёжа","weight_kg":100,"reps":8}]}'),
 ('e63d5000-0000-4000-8000-000000000003',u,now()-interval '10 days 1 hour',now()-interval '10 days','{"status":"completed","workout":{"title":"Old A"},"sets":[{"exercise":"Жим лёжа","weight_kg":75,"reps":8}]}'),
 ('e63d5000-0000-4000-8000-000000000004',u,now()-interval '1 hour',NULL,'{"status":"active","workout":{"title":"Active"},"sets":[]}');
 h:=public.fgi_ai_history(u,'Europe/Paris',ARRAY['жим','леж']);
 IF h->>'workout_count_week'<>'1' OR jsonb_array_length(h->'workouts')<>2 OR h->'exercise_workouts'->0->'data'->'sets'->0->>'weight_kg'<>'80' OR jsonb_array_length(h->'weights')<>7 OR (h->'latest_weight'->>'weight_kg')::numeric<>82 OR (h->'first_weight'->>'weight_kg')::numeric<>85 THEN RAISE EXCEPTION 'History invented, filtered or miscounted rows: %',h; END IF;
 INSERT INTO public.fgi_ai_workouts(user_id,started_at,completed_at,data) SELECT u,now()-interval '1 day 1 hour',now()-interval '1 day','{"status":"completed","sets":[]}' FROM generate_series(1,230);
 h:=public.fgi_ai_history(u,'UTC','{}');
 IF h->>'workout_count_week'<>'231' OR jsonb_array_length(h->'workouts')<>10 THEN RAISE EXCEPTION 'Week count incorrectly limited by display page'; END IF;
 h:=public.fgi_ai_history(u,'UTC',ARRAY['жим','леж']);
 IF h->'exercise_workouts'->0->'data'->'sets'->0->>'weight_kg'<>'80' THEN RAISE EXCEPTION 'Exercise history incorrectly limited by workout display page'; END IF;
 h:=public.fgi_ai_history('e63d0000-0000-4000-8000-000000000002','UTC','{}');
 IF h->>'workout_count_week'<>'0' OR h->'workouts'<>'[]'::jsonb OR h->'weights'<>'[]'::jsonb THEN RAISE EXCEPTION 'Empty other owner inherited history'; END IF;
END; $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"e63d0000-0000-4000-8000-000000000002","role":"authenticated"}',true);
SELECT set_config('request.jwt.claim.sub','e63d0000-0000-4000-8000-000000000002',true);
DO $$ DECLARE n integer; BEGIN
 SELECT count(*) INTO n FROM public.fgi_ai_progress WHERE user_id='e63d0000-0000-4000-8000-000000000001';IF n<>0 THEN RAISE EXCEPTION 'Foreign read allowed';END IF;
 UPDATE public.fgi_ai_progress SET photo_path=NULL WHERE user_id='e63d0000-0000-4000-8000-000000000001';GET DIAGNOSTICS n=ROW_COUNT;IF n<>0 THEN RAISE EXCEPTION 'Foreign update allowed';END IF;
 BEGIN INSERT INTO public.fgi_ai_progress(user_id,weight_kg) VALUES('e63d0000-0000-4000-8000-000000000001',80);RAISE EXCEPTION 'Foreign insert allowed';EXCEPTION WHEN insufficient_privilege OR raise_exception THEN IF SQLERRM='Foreign insert allowed' THEN RAISE;END IF; END;
 BEGIN PERFORM public.fgi_ai_history('e63d0000-0000-4000-8000-000000000001','UTC','{}');RAISE EXCEPTION 'Browser service RPC allowed';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 SELECT count(*) INTO n FROM public.fgi_ai_workouts WHERE user_id='e63d0000-0000-4000-8000-000000000001';IF n<>0 THEN RAISE EXCEPTION 'Foreign workout read allowed';END IF;
END; $$;
SELECT set_config('request.jwt.claims','{"sub":"e63d0000-0000-4000-8000-000000000001","role":"authenticated"}',true);
SELECT set_config('request.jwt.claim.sub','e63d0000-0000-4000-8000-000000000001',true);
DO $$ BEGIN IF (SELECT count(*) FROM public.fgi_ai_progress WHERE user_id='e63d0000-0000-4000-8000-000000000001')<>7 THEN RAISE EXCEPTION 'Owner history did not reload after re-login';END IF; END; $$;
RESET ROLE;
SET LOCAL ROLE anon;
DO $$ BEGIN BEGIN PERFORM 1 FROM public.fgi_ai_progress;RAISE EXCEPTION 'Anonymous history allowed';EXCEPTION WHEN insufficient_privilege THEN NULL;END;END; $$;
RESET ROLE;
