-- Run with candidate 3B–3E migrations inside a single BEGIN/ROLLBACK.
INSERT INTO auth.users(id,aud,role,email,raw_user_meta_data,created_at,updated_at) VALUES
 ('e63e0000-0000-4000-8000-000000000001','authenticated','authenticated','analysis-owner@example.invalid','{}',now(),now()),
 ('e63e0000-0000-4000-8000-000000000002','authenticated','authenticated','analysis-other@example.invalid','{}',now(),now());
INSERT INTO public.fgi_ai_profiles(user_id,data,consent_version) VALUES
 ('e63e0000-0000-4000-8000-000000000001','{"goal":"Сила","experience":"intermediate","days_per_week":1,"minutes":40,"setting":"gym","equipment":"Штанга, скамья","restrictions":"","memory_confirmed_fields":["restrictions"],"weekdays":[1]}','2026-10-03'),
 ('e63e0000-0000-4000-8000-000000000002','{}','2026-10-03');
INSERT INTO public.fgi_ai_conversations(id,user_id) VALUES('e63e4000-0000-4000-8000-000000000001','e63e0000-0000-4000-8000-000000000001');
INSERT INTO fgi_private.ai_friend_grants(user_id,modules,reason) VALUES('e63e0000-0000-4000-8000-000000000001',ARRAY['training','nutrition'],'Rollback 3E acceptance');
INSERT INTO fgi_private.ai_requests(id,user_id,request_hash) SELECT ('e63e3000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'e63e0000-0000-4000-8000-000000000001','analysis-test' FROM generate_series(1,12) n;
INSERT INTO public.fgi_ai_progress(user_id,recorded_on,weight_kg,timezone,source) VALUES
 ('e63e0000-0000-4000-8000-000000000001',CURRENT_DATE-27,85.6,'UTC','form'),
 ('e63e0000-0000-4000-8000-000000000001',CURRENT_DATE-13,84.3,'UTC','form'),
 ('e63e0000-0000-4000-8000-000000000001',CURRENT_DATE,83.5,'UTC','form'),
 ('e63e0000-0000-4000-8000-000000000001',CURRENT_DATE,83.4,'UTC','form');
INSERT INTO public.fgi_ai_plans(id,user_id,kind,title,status,created_at,profile_snapshot,document) VALUES
 ('e63e1000-0000-4000-8000-000000000001','e63e0000-0000-4000-8000-000000000001','training','Real original program','active',now()-interval '40 days','{"goal":"Сила"}',
 '{"schema_version":2,"title":"Real original program","summary":"Existing program","progression":"Gradual","schedule":{"mode":"weekdays","weekdays":[1],"timezone":"UTC"},"workouts":[{"id":"w1","number":1,"day":1,"title":"Workout A","objective":"Strength","minutes":40,"warmup":"Five minutes","cooldown":"Three minutes","exercises":[{"id":"e1","name":"Жим штанги лёжа","sets":3,"reps":"10","rest_seconds":90,"minutes":6,"technique":"Control","alternative":"Отжимания от стены","required_equipment":"Штанга, скамья","alternative_equipment":"Без оборудования"}]}]}'),
 ('e63e1000-0000-4000-8000-000000000099','e63e0000-0000-4000-8000-000000000001','nutrition','Planned menu','active',now()-interval '30 days','{}','{"schema_version":3,"title":"Planned menu","meals":[]}');
INSERT INTO public.fgi_ai_workouts(id,user_id,plan_id,started_at,completed_at,data)
SELECT ('e63e5000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'e63e0000-0000-4000-8000-000000000001','e63e1000-0000-4000-8000-000000000001',
 (CURRENT_DATE-(((extract(dow FROM CURRENT_DATE)::integer+5)%7)+1)-7*(n-1))::timestamp+interval '9 hours',
 (CURRENT_DATE-(((extract(dow FROM CURRENT_DATE)::integer+5)%7)+1)-7*(n-1))::timestamp+interval '10 hours',
 jsonb_build_object('status','completed','difficulty',9,'workout',jsonb_build_object('id','w1','title','Workout A'),'sets',(SELECT jsonb_agg(jsonb_build_object('exercise_id','e1','exercise_index',s*0,'exercise','Жим штанги лёжа','reps',10,'weight_kg',CASE n WHEN 1 THEN 80 WHEN 2 THEN 78 ELSE 75 END)) FROM generate_series(1,3) s)) FROM generate_series(1,3) n;
INSERT INTO public.fgi_ai_food(user_id,recorded_on,name,calories_low,calories_high,protein_g,fat_g,carbs_g,source) VALUES
 ('e63e0000-0000-4000-8000-000000000001',CURRENT_DATE-1,'Real food A',800,1000,40,30,70,'manual'),
 ('e63e0000-0000-4000-8000-000000000001',CURRENT_DATE-1,'Real food B',800,1000,40,30,70,'confirmed_photo'),
 ('e63e0000-0000-4000-8000-000000000001',CURRENT_DATE-2,'Real food C',800,1000,40,20,100,'manual');
SET LOCAL ROLE service_role;
DO $$ DECLARE u uuid:='e63e0000-0000-4000-8000-000000000001'; c uuid:='e63e4000-0000-4000-8000-000000000001'; p uuid:='e63e1000-0000-4000-8000-000000000001'; h jsonb; h2 jsonb; expected integer; proposal jsonb; stamp timestamptz; old_document jsonb; next_document jsonb; r jsonb; before_count integer; BEGIN
 h:=public.fgi_ai_progress_analysis(u,'UTC',28,true,true);
 IF jsonb_array_length(h->'measurements')<>3 OR (h->'measurements'->2->>'weight_kg')::numeric<>83.4 OR (h->'measurements'->0->>'recorded_on')::date<>CURRENT_DATE-27 OR h->'workouts'->>'completed_count'<>'3' THEN RAISE EXCEPTION 'Actual weight dates or completed count wrong: %',h; END IF;
 SELECT count(*) INTO expected FROM generate_series(1,27) d WHERE extract(dow FROM CURRENT_DATE-d)=1;
 IF (h->'schedule'->>'planned')::integer<>expected OR h->'schedule'->>'matched'<>'3' OR h->'schedule'->>'known_days'<>'27' THEN RAISE EXCEPTION 'Dated calendar ratio wrong: %',h->'schedule'; END IF;
 IF h->'food'->>'entries'<>'3' OR h->'food'->>'days'<>'2' OR (h->'food'->>'calories_low')::numeric<>2400 OR h->'food'->>'has_saved_menu'<>'true' THEN RAISE EXCEPTION 'Planned menu was conflated with actual food'; END IF;
 IF (h->'exercise_trends'->0->'sessions'->0->>'min_weight')::numeric<>80 OR (h->'exercise_trends'->0->'sessions'->1->>'min_weight')::numeric<>78 THEN RAISE EXCEPTION 'Actual exercise trend missing'; END IF;
 h2:=public.fgi_ai_progress_analysis(u,'UTC',28,false,false);
 IF h2->'workouts'<>'null'::jsonb OR h2->'food'<>'null'::jsonb OR h2->'exercise_trends'<>'[]'::jsonb THEN RAISE EXCEPTION 'Data module gates ignored'; END IF;
 h2:=public.fgi_ai_progress_analysis('e63e0000-0000-4000-8000-000000000002','UTC',28,true,true);
 IF h2->'measurements'<>'[]'::jsonb OR h2->'workouts'->>'completed_count'<>'0' OR h2->'food'->>'entries'<>'0' OR h2->'schedule'->>'planned'<>'0' THEN RAISE EXCEPTION 'Another owner inherited results'; END IF;
 BEGIN PERFORM public.fgi_ai_progress_analysis(u,'Invalid/Zone',28,true,true);RAISE EXCEPTION 'Invalid timezone accepted';EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'invalid_analysis' THEN RAISE;END IF;END;
 SELECT document INTO old_document FROM public.fgi_ai_plans WHERE id=p;
 proposal:=jsonb_build_object('mode','proposal','kind','progress_analysis','id','e63e6000-0000-4000-8000-000000000001','program_id',p,'conversation_id',c,'created_at',now(),'days',28,'start_on',CURRENT_DATE-27,'timezone','UTC','profile_snapshot',jsonb_build_object('goal','Сила'),'operation','reduce_volume','changes',jsonb_build_array(jsonb_build_object('workout_id','w1','exercise_id','e1','field','sets','before',3,'after',2)),'evidence',(SELECT jsonb_agg(jsonb_build_object('id',id,'revision',revision) ORDER BY completed_at DESC,id DESC) FROM public.fgi_ai_workouts WHERE user_id=u));
 SELECT updated_at INTO stamp FROM public.fgi_ai_profiles WHERE user_id=u;
 PERFORM public.fgi_ai_complete(u,'e63e3000-0000-4000-8000-000000000001',c,stamp,'analyze','offer','[]',NULL,NULL,jsonb_build_object('module','training','livemode',true,'program_edit_pending',proposal));
 IF (SELECT count(*) FROM public.fgi_ai_plans WHERE user_id=u AND kind='training')<>1 OR (SELECT document FROM public.fgi_ai_plans WHERE id=p)<>old_document THEN RAISE EXCEPTION 'Proposal automatically rewrote program'; END IF;
 SELECT updated_at INTO stamp FROM public.fgi_ai_profiles WHERE user_id=u;
 PERFORM public.fgi_ai_progress_complete(u,'e63e3000-0000-4000-8000-000000000002',c,stamp,'Не меняй программу','cancelled','[]',NULL,NULL,jsonb_build_object('module','training','livemode',true,'program_edit_pending','null'::jsonb,'analysis_change',jsonb_build_object('operation','cancel','draft_id',proposal->>'id')));
 IF (SELECT data->'program_edit_pending' FROM public.fgi_ai_profiles WHERE user_id=u)<>'null'::jsonb OR (SELECT document FROM public.fgi_ai_plans WHERE id=p)<>old_document THEN RAISE EXCEPTION 'Refusal changed accepted plan'; END IF;
 proposal:=jsonb_set(proposal,'{id}','"e63e6000-0000-4000-8000-000000000002"');
 SELECT updated_at INTO stamp FROM public.fgi_ai_profiles WHERE user_id=u;
 PERFORM public.fgi_ai_complete(u,'e63e3000-0000-4000-8000-000000000003',c,stamp,'analyze again','offer again','[]',NULL,NULL,jsonb_build_object('module','training','livemode',true,'program_edit_pending',proposal));
 next_document:=jsonb_set(old_document,'{workouts,0,exercises,0,sets}','2');
 r:=jsonb_build_object('module','training','livemode',true,'program_saved',true,'program_previous_id',p,'plan_id','e63e1000-0000-4000-8000-000000000002','profile_snapshot',proposal->'profile_snapshot','program_edit_pending','null'::jsonb,'analysis_change',jsonb_build_object('operation','confirm','draft_id',proposal->>'id'));
 SELECT updated_at INTO stamp FROM public.fgi_ai_profiles WHERE user_id=u;SELECT count(*) INTO before_count FROM public.fgi_ai_messages WHERE user_id=u;
 BEGIN PERFORM public.fgi_ai_progress_complete(u,'e63e3000-0000-4000-8000-000000000004',c,stamp-interval '1 second','confirm','should fail','[]','training',next_document,r);RAISE EXCEPTION 'Stale profile saved';EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'progress_proposal_changed' THEN RAISE;END IF;END;
 BEGIN PERFORM public.fgi_ai_progress_complete(u,'e63e3000-0000-4000-8000-000000000004',c,stamp,'confirm','should fail','[]','training',next_document,jsonb_set(r,'{analysis_change,draft_id}','"e63e6000-0000-4000-8000-000000000001"'));RAISE EXCEPTION 'Replaced proposal saved';EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'progress_proposal_changed' THEN RAISE;END IF;END;
 BEGIN
  INSERT INTO public.fgi_ai_workouts(user_id,plan_id,data) VALUES(u,p,'{"status":"active","workout":{"id":"w1"},"sets":[]}');
  PERFORM public.fgi_ai_progress_complete(u,'e63e3000-0000-4000-8000-000000000004',c,stamp,'confirm','should fail','[]','training',next_document,r);RAISE EXCEPTION 'Active workout accepted adaptation';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'progress_proposal_changed' THEN RAISE;END IF;END;
 BEGIN
  INSERT INTO public.fgi_ai_workouts(user_id,plan_id,started_at,completed_at,data) VALUES(u,p,now()-interval '1 hour',now(),' {"status":"stopped","stopped_for_pain":true,"sets":[]}');
  PERFORM public.fgi_ai_progress_complete(u,'e63e3000-0000-4000-8000-000000000004',c,stamp,'confirm','should fail','[]','training',next_document,r);RAISE EXCEPTION 'New pain accepted adaptation';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'progress_proposal_changed' THEN RAISE;END IF;END;
 BEGIN
  INSERT INTO public.fgi_ai_workouts(user_id,plan_id,started_at,completed_at,data) VALUES(u,p,now()-interval '1 hour',now(),' {"status":"completed","difficulty":2,"workout":{"id":"w1"},"sets":[]}');
  PERFORM public.fgi_ai_progress_complete(u,'e63e3000-0000-4000-8000-000000000004',c,stamp,'confirm','should fail','[]','training',next_document,r);RAISE EXCEPTION 'Changed evidence accepted adaptation';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'progress_proposal_changed' THEN RAISE;END IF;END;
 IF (SELECT count(*) FROM public.fgi_ai_messages WHERE user_id=u)<>before_count THEN RAISE EXCEPTION 'Failed save acknowledged success'; END IF;
 PERFORM public.fgi_ai_progress_complete(u,'e63e3000-0000-4000-8000-000000000005',c,stamp,'Сохрани адаптацию','saved','[]','training',next_document,r);
 IF (SELECT status FROM public.fgi_ai_plans WHERE id=p)<>'archived' OR (SELECT document FROM public.fgi_ai_plans WHERE id=p)<>old_document OR NOT EXISTS(SELECT 1 FROM public.fgi_ai_plans WHERE id='e63e1000-0000-4000-8000-000000000002' AND status='active' AND revision=2 AND supersedes_id=p AND document=next_document) THEN RAISE EXCEPTION 'Existing program version history not preserved'; END IF;
 h2:=public.fgi_ai_claim(u,'e63e3000-0000-4000-8000-000000000005','analysis-test',false);
 IF NOT(h2 ? 'cached') OR h2->'cached' ? 'analysis_change' OR (SELECT count(*) FROM public.fgi_ai_plans WHERE user_id=u AND kind='training')<>2 THEN RAISE EXCEPTION 'Confirmation replay duplicates version or exposes internal command'; END IF;
 IF (SELECT data->'sets'->0->>'weight_kg' FROM public.fgi_ai_workouts WHERE id='e63e5000-0000-4000-8000-000000000001')<>'80' OR (SELECT status FROM public.fgi_ai_plans WHERE id='e63e1000-0000-4000-8000-000000000099')<>'active' THEN RAISE EXCEPTION 'Adaptation changed actual results or nutrition'; END IF;
 h2:=public.fgi_ai_progress_analysis(u,'UTC',28,true,true);
 IF h2->'schedule'->>'planned'<>h->'schedule'->>'planned' THEN RAISE EXCEPTION 'Today new version rewrote previous calendar'; END IF;
 INSERT INTO public.fgi_ai_workouts(user_id,started_at,completed_at,data) SELECT u,now()-interval '20 days 1 hour',now()-interval '20 days','{"status":"completed","sets":[]}' FROM generate_series(1,230);
 h2:=public.fgi_ai_progress_analysis(u,'UTC',28,true,true);
 IF h2->'workouts'->>'completed_count'<>'233' OR jsonb_array_length(h2->'workouts'->'recent')<>12 OR h2->'schedule'->>'unlinked_count'<>'230' THEN RAISE EXCEPTION 'Aggregate was capped or unlinked results incorrectly matched'; END IF;
 -- Unknown timezone/sequence is not extrapolated from workouts/week.
 UPDATE public.fgi_ai_plans SET document=jsonb_set(document,'{schedule,mode}','"sequence"') WHERE id=p;
 h2:=public.fgi_ai_progress_analysis(u,'UTC',28,true,true);
 IF h2->'schedule'->>'planned'<>'0' OR h2->'schedule'->>'known_days'<>'0' THEN RAISE EXCEPTION 'Sequence invented historical schedule'; END IF;
END; $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"e63e0000-0000-4000-8000-000000000002","role":"authenticated"}',true);
SELECT set_config('request.jwt.claim.sub','e63e0000-0000-4000-8000-000000000002',true);
DO $$ DECLARE n integer; BEGIN
 SELECT (SELECT count(*) FROM public.fgi_ai_progress WHERE user_id='e63e0000-0000-4000-8000-000000000001')+(SELECT count(*) FROM public.fgi_ai_workouts WHERE user_id='e63e0000-0000-4000-8000-000000000001')+(SELECT count(*) FROM public.fgi_ai_food WHERE user_id='e63e0000-0000-4000-8000-000000000001')+(SELECT count(*) FROM public.fgi_ai_plans WHERE user_id='e63e0000-0000-4000-8000-000000000001') INTO n;
 IF n<>0 THEN RAISE EXCEPTION 'RLS exposed another owner journals'; END IF;
 UPDATE public.fgi_ai_food SET name='foreign edit' WHERE user_id='e63e0000-0000-4000-8000-000000000001';GET DIAGNOSTICS n=ROW_COUNT;IF n<>0 THEN RAISE EXCEPTION 'Foreign food update allowed'; END IF;
 UPDATE public.fgi_ai_workouts SET data='{}' WHERE user_id='e63e0000-0000-4000-8000-000000000001';GET DIAGNOSTICS n=ROW_COUNT;IF n<>0 THEN RAISE EXCEPTION 'Foreign workout update allowed'; END IF;
 BEGIN PERFORM public.fgi_ai_progress_analysis('e63e0000-0000-4000-8000-000000000001','UTC',28,true,true);RAISE EXCEPTION 'Browser service analysis RPC allowed';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN PERFORM public.fgi_ai_progress_complete('e63e0000-0000-4000-8000-000000000001',gen_random_uuid(),gen_random_uuid(),now(),'forged','forged','[]',NULL,NULL,'{}');RAISE EXCEPTION 'Browser service confirmation RPC allowed';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END; $$;
RESET ROLE;
SET LOCAL ROLE anon;
DO $$ BEGIN
 BEGIN PERFORM public.fgi_ai_progress_analysis('e63e0000-0000-4000-8000-000000000001','UTC',28,true,true);RAISE EXCEPTION 'Anon analysis RPC allowed';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END; $$;
RESET ROLE;
