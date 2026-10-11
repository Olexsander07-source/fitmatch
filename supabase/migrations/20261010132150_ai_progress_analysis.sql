-- 3E reads the existing journals. There is no analytics table or second plan.
SET lock_timeout='5s';
SET statement_timeout='30s';
CREATE FUNCTION public.fgi_ai_progress_analysis(p_user uuid,p_timezone text DEFAULT 'UTC',p_days integer DEFAULT 28,p_food boolean DEFAULT false,p_training boolean DEFAULT true) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE today date; start_on date; report jsonb;
BEGIN
 IF p_user IS NULL OR p_days IS NULL OR p_days NOT BETWEEN 7 AND 56 OR NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=p_timezone) THEN RAISE EXCEPTION 'invalid_analysis'; END IF;
 today:=(now() AT TIME ZONE p_timezone)::date;start_on:=today-(p_days-1);
 WITH RECURSIVE versions AS (
  SELECT id,document,created_at,supersedes_id,ARRAY[id] AS path FROM public.fgi_ai_plans WHERE user_id=p_user AND kind='training' AND status='active' AND p_training
  UNION ALL
  SELECT p.id,p.document,p.created_at,p.supersedes_id,v.path||p.id FROM versions v JOIN public.fgi_ai_plans p ON p.id=v.supersedes_id AND p.user_id=p_user AND p.kind='training' WHERE NOT(p.id=ANY(v.path)) AND cardinality(v.path)<512
 ), days AS (
  SELECT start_on+n AS day FROM generate_series(0,p_days-2) n
 ), calendar AS (
  SELECT d.day,v.id,v.document,
   COALESCE(v.document->>'schema_version'='2' AND v.document->'schedule'->>'mode'='weekdays' AND v.document->'schedule'->>'timezone'=p_timezone AND jsonb_typeof(v.document->'workouts')='array'
    AND NOT EXISTS(SELECT 1 FROM versions x WHERE x.created_at>(d.day::timestamp AT TIME ZONE p_timezone) AND x.created_at<((d.day+1)::timestamp AT TIME ZONE p_timezone)),false) AS known
  FROM days d LEFT JOIN LATERAL (SELECT x.* FROM versions x WHERE x.created_at<=(d.day::timestamp AT TIME ZONE p_timezone) ORDER BY x.created_at DESC,x.id DESC LIMIT 1) v ON true
 ), slots AS (
  SELECT c.day,c.id AS plan_id,w.value->>'id' AS workout_id,
   EXISTS(SELECT 1 FROM public.fgi_ai_workouts a WHERE a.user_id=p_user AND a.plan_id=c.id AND a.data->'workout'->>'id'=w.value->>'id' AND a.data->>'status'='completed' AND a.completed_at<=now() AND a.started_at>=(c.day::timestamp AT TIME ZONE p_timezone) AND a.started_at<((c.day+1)::timestamp AT TIME ZONE p_timezone)) AS matched
  FROM calendar c CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN c.known THEN c.document->'workouts' ELSE '[]'::jsonb END) w
  WHERE c.known AND w.value->>'day'=extract(dow FROM c.day)::integer::text
 ), completed AS (
  SELECT a.* FROM public.fgi_ai_workouts a WHERE a.user_id=p_user AND p_training AND a.data->>'status'='completed' AND a.completed_at>=(start_on::timestamp AT TIME ZONE p_timezone) AND a.completed_at<=now()
 ), recent AS (
  SELECT c.* FROM completed c ORDER BY completed_at DESC,id DESC LIMIT 12
 ), weights AS (
  SELECT DISTINCT ON(recorded_on) id,recorded_on,weight_kg,notes,recorded_at FROM public.fgi_ai_progress WHERE user_id=p_user AND weight_kg IS NOT NULL AND recorded_on BETWEEN start_on AND today ORDER BY recorded_on,recorded_at DESC NULLS LAST,id DESC
 ), food AS (
  SELECT count(*) AS entries,count(DISTINCT recorded_on) AS days,COALESCE(sum(calories_low),0) AS calories_low,COALESCE(sum(calories_high),0) AS calories_high,COALESCE(sum(protein_g),0) AS protein_g,COALESCE(sum(fat_g),0) AS fat_g,COALESCE(sum(carbs_g),0) AS carbs_g
  FROM public.fgi_ai_food WHERE user_id=p_user AND p_food AND recorded_on BETWEEN start_on AND today
 ), exercise_sets AS (
  SELECT c.id,c.completed_at,s.value->>'exercise' AS name,COALESCE(NULLIF(s.value->>'exercise_id',''),lower(s.value->>'exercise')) AS exercise_id,
   CASE WHEN s.value->>'reps' ~ '^[0-9]{1,3}$' THEN (s.value->>'reps')::integer END AS reps,
   CASE WHEN s.value->>'weight_kg' ~ '^[0-9]{1,3}([.][0-9]{1,2})?$' THEN (s.value->>'weight_kg')::numeric END AS weight
  FROM completed c CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(c.data->'sets')='array' THEN c.data->'sets' ELSE '[]'::jsonb END) s WHERE length(s.value->>'exercise') BETWEEN 1 AND 120
 ), exercise_sessions AS (
  SELECT id,completed_at,name,exercise_id,count(*) AS sets_count,count(reps) AS known_reps,count(weight) AS known_weights,min(reps) AS min_reps,max(reps) AS max_reps,min(weight) AS min_weight,max(weight) AS max_weight
  FROM exercise_sets GROUP BY id,completed_at,name,exercise_id
 ), ranked_exercises AS (
  SELECT e.*,row_number() OVER(PARTITION BY exercise_id,lower(name) ORDER BY completed_at DESC,id DESC) AS rank FROM exercise_sessions e
 ), trends AS (
  SELECT name,exercise_id,max(completed_at) AS latest,jsonb_agg(jsonb_build_object('recorded_on',(completed_at AT TIME ZONE p_timezone)::date,'sets_count',sets_count,'known_reps',known_reps,'known_weights',known_weights,'min_reps',min_reps,'max_reps',max_reps,'min_weight',min_weight,'max_weight',max_weight) ORDER BY completed_at DESC,id DESC) AS sessions
  FROM ranked_exercises WHERE rank<=2 GROUP BY name,exercise_id
 ) SELECT jsonb_build_object(
  'today',today,'start_on',start_on,'days',p_days,'timezone',p_timezone,
  'measurements',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',id,'recorded_on',recorded_on,'weight_kg',weight_kg,'notes',left(notes,500)) ORDER BY recorded_on) FROM weights),'[]'::jsonb),
  'workouts',CASE WHEN p_training THEN jsonb_build_object(
   'completed_count',(SELECT count(*) FROM completed),
   'active_count',(SELECT count(*) FROM public.fgi_ai_workouts WHERE user_id=p_user AND completed_at IS NULL AND data->>'status'='active'),
   'pain_stops',EXISTS(SELECT 1 FROM public.fgi_ai_workouts WHERE user_id=p_user AND data->'stopped_for_pain'='true'::jsonb AND (COALESCE(completed_at,started_at) AT TIME ZONE p_timezone)::date BETWEEN start_on AND today),
   'recent',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',id,'revision',revision,'plan_id',plan_id,'completed_at',completed_at,'data',jsonb_build_object('status',data->'status','workout',jsonb_build_object('id',data->'workout'->'id','title',data->'workout'->'title'),'difficulty',data->'difficulty','comment',left(data->>'comment',500),'sets',COALESCE(data->'sets','[]'::jsonb))) ORDER BY completed_at DESC,id DESC) FROM recent),'[]'::jsonb)) ELSE NULL END,
  'schedule',CASE WHEN p_training THEN jsonb_build_object('known_days',(SELECT count(*) FROM calendar WHERE known),'unknown_days',(SELECT count(*) FROM calendar WHERE NOT known),'planned',(SELECT count(*) FROM slots),'matched',(SELECT count(*) FROM slots WHERE matched),'unlinked_count',(SELECT count(*) FROM completed a WHERE NOT EXISTS(SELECT 1 FROM slots s WHERE s.plan_id=a.plan_id AND s.workout_id=a.data->'workout'->>'id' AND s.day=(a.started_at AT TIME ZONE p_timezone)::date)),'today_excluded',true) ELSE NULL END,
  'exercise_trends',COALESCE((SELECT jsonb_agg(jsonb_build_object('name',t.name,'sessions',t.sessions)) FROM (SELECT * FROM trends ORDER BY latest DESC,exercise_id LIMIT 10) t),'[]'::jsonb),
  'food',CASE WHEN p_food THEN (SELECT to_jsonb(f)||jsonb_build_object('has_saved_menu',EXISTS(SELECT 1 FROM public.fgi_ai_plans WHERE user_id=p_user AND kind='nutrition' AND status='active')) FROM food f) ELSE NULL END
 ) INTO report;
 RETURN report;
END; $$;
REVOKE ALL ON FUNCTION public.fgi_ai_progress_analysis(uuid,text,integer,boolean,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fgi_ai_progress_analysis(uuid,text,integer,boolean,boolean) TO service_role;

-- Additional confirmation checks share the profile lock with the existing 2C
-- version/archive mechanism, workout completion and safety-stop transaction.
CREATE FUNCTION public.fgi_ai_progress_complete(p_user uuid,p_id uuid,p_conversation uuid,p_consent timestamptz,p_input text,p_output text,p_citations jsonb,p_kind text,p_document jsonb,p_result jsonb) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE profile public.fgi_ai_profiles; pending jsonb; change jsonb; item jsonb; current_evidence jsonb;
BEGIN
 SELECT * INTO profile FROM public.fgi_ai_profiles WHERE user_id=p_user FOR UPDATE;
 IF NOT FOUND OR profile.updated_at IS DISTINCT FROM p_consent THEN RAISE EXCEPTION 'progress_proposal_changed'; END IF;
 pending:=profile.data->'program_edit_pending';change:=p_result->'analysis_change';
 IF jsonb_typeof(change) IS DISTINCT FROM 'object' OR pending->>'kind' IS DISTINCT FROM 'progress_analysis' OR pending->>'mode' IS DISTINCT FROM 'proposal' OR pending->>'id' IS DISTINCT FROM change->>'draft_id' OR pending->>'conversation_id' IS DISTINCT FROM p_conversation::text OR change->>'operation' IS NULL OR change->>'operation' NOT IN ('confirm','cancel') THEN RAISE EXCEPTION 'progress_proposal_changed'; END IF;
 IF change->>'operation'='confirm' THEN
  IF p_kind IS DISTINCT FROM 'training' OR p_result->'program_saved' IS DISTINCT FROM 'true'::jsonb OR p_result->>'program_previous_id' IS DISTINCT FROM pending->>'program_id' OR p_result->'profile_snapshot' IS DISTINCT FROM pending->'profile_snapshot' OR pending->>'created_at' IS NULL OR (pending->>'created_at')::timestamptz<now()-interval '24 hours' OR (pending->>'created_at')::timestamptz>now()+interval '1 minute' THEN RAISE EXCEPTION 'progress_proposal_changed'; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=pending->>'timezone') OR pending->>'start_on' IS NULL THEN RAISE EXCEPTION 'progress_proposal_changed'; END IF;
  IF profile.data->'needs_professional'='true'::jsonb OR length(btrim(COALESCE(profile.data->>'restrictions','')))>0 OR COALESCE((profile.data->>'age')::numeric,18)<18 OR (jsonb_typeof(profile.data->'current_workout')='object' AND NOT(profile.data->'current_workout' ? 'session_id')) OR EXISTS(SELECT 1 FROM public.fgi_ai_workouts WHERE user_id=p_user AND completed_at IS NULL AND data->>'status'='active') OR EXISTS(SELECT 1 FROM public.fgi_ai_workouts WHERE user_id=p_user AND data->'stopped_for_pain'='true'::jsonb AND (COALESCE(completed_at,started_at) AT TIME ZONE (pending->>'timezone'))::date>=(pending->>'start_on')::date) THEN RAISE EXCEPTION 'progress_proposal_changed'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.fgi_ai_plans WHERE user_id=p_user AND id=(pending->>'program_id')::uuid AND kind='training' AND status='active') OR jsonb_typeof(pending->'evidence') IS DISTINCT FROM 'array' OR jsonb_array_length(pending->'evidence') NOT BETWEEN 2 AND 3 THEN RAISE EXCEPTION 'progress_proposal_changed'; END IF;
  IF pending->>'operation'='reduce_volume' THEN
   SELECT jsonb_agg(jsonb_build_object('id',a.id,'revision',a.revision) ORDER BY a.completed_at DESC,a.id DESC) INTO current_evidence FROM (SELECT id,revision,completed_at FROM public.fgi_ai_workouts WHERE user_id=p_user AND data->>'status'='completed' AND completed_at<=now() ORDER BY completed_at DESC,id DESC LIMIT 3) a;
  ELSIF pending->>'operation'='increase_reps' THEN
   SELECT jsonb_agg(jsonb_build_object('id',a.id,'revision',a.revision) ORDER BY a.completed_at DESC,a.id DESC) INTO current_evidence FROM (SELECT id,revision,completed_at FROM public.fgi_ai_workouts WHERE user_id=p_user AND data->>'status'='completed' AND completed_at<=now() AND data->'workout'->>'id'=pending->'changes'->0->>'workout_id' ORDER BY completed_at DESC,id DESC LIMIT 2) a;
  ELSE RAISE EXCEPTION 'progress_proposal_changed'; END IF;
  IF current_evidence IS DISTINCT FROM pending->'evidence' THEN RAISE EXCEPTION 'progress_proposal_changed'; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(pending->'evidence') LOOP
   PERFORM 1 FROM public.fgi_ai_workouts WHERE user_id=p_user AND id=(item->>'id')::uuid AND plan_id=(pending->>'program_id')::uuid AND revision=(item->>'revision')::integer AND data->>'status'='completed' AND completed_at<=now();
   IF NOT FOUND THEN RAISE EXCEPTION 'progress_proposal_changed'; END IF;
  END LOOP;
 ELSIF p_kind IS NOT NULL OR p_result->'program_edit_pending' IS DISTINCT FROM 'null'::jsonb THEN RAISE EXCEPTION 'progress_proposal_changed'; END IF;
 PERFORM public.fgi_ai_complete(p_user,p_id,p_conversation,p_consent,p_input,p_output,p_citations,p_kind,p_document,p_result-'analysis_change');
END; $$;
REVOKE ALL ON FUNCTION public.fgi_ai_progress_complete(uuid,uuid,uuid,timestamptz,text,text,jsonb,text,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fgi_ai_progress_complete(uuid,uuid,uuid,timestamptz,text,text,jsonb,text,jsonb,jsonb) TO service_role;
