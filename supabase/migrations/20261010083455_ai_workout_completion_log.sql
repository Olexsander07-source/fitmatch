-- Stage 3C reuses the existing workout journal and owner RLS. No new table.
SET lock_timeout='5s';
SET statement_timeout='30s';
ALTER TABLE public.fgi_ai_workouts ADD COLUMN revision integer NOT NULL DEFAULT 0 CHECK(revision>=0);
CREATE FUNCTION fgi_private.ai_workout_revision() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 -- Retain the existing ON DELETE SET NULL plan FK and account-data deletion.
 IF OLD.completed_at IS NOT NULL AND (NEW.data IS DISTINCT FROM OLD.data OR NEW.completed_at IS DISTINCT FROM OLD.completed_at OR (NEW.plan_id IS DISTINCT FROM OLD.plan_id AND NEW.plan_id IS NOT NULL) OR NEW.started_at IS DISTINCT FROM OLD.started_at OR NEW.user_id IS DISTINCT FROM OLD.user_id) THEN RAISE EXCEPTION 'workout_changed'; END IF;
 IF NEW.user_id IS DISTINCT FROM OLD.user_id OR (NEW.plan_id IS DISTINCT FROM OLD.plan_id AND NEW.plan_id IS NOT NULL) OR NEW.started_at IS DISTINCT FROM OLD.started_at THEN RAISE EXCEPTION 'workout_changed'; END IF;
 NEW.revision:=OLD.revision+1;
 RETURN NEW;
END; $$;
CREATE TRIGGER ai_workout_revision BEFORE UPDATE ON public.fgi_ai_workouts FOR EACH ROW EXECUTE FUNCTION fgi_private.ai_workout_revision();
REVOKE ALL ON FUNCTION fgi_private.ai_workout_revision() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION fgi_private.ai_workout_revision() TO service_role;

-- Internal primitive: only the verified Edge handler can invoke it. The outer
-- fgi_ai_complete transaction already owns the profile/request locks.
CREATE FUNCTION fgi_private.ai_workout_change(p_user uuid,p_change jsonb) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE op text; row public.fgi_ai_workouts; doc jsonb; w jsonb; e jsonb; c jsonb; report jsonb; performed jsonb; n integer; idx integer; opened timestamptz; rev integer;
BEGIN
 IF jsonb_typeof(p_change) IS DISTINCT FROM 'object' OR octet_length(p_change::text)>5000 THEN RAISE EXCEPTION 'invalid_workout_result'; END IF;
 op:=p_change->>'operation';
 IF op IS NULL OR op NOT IN ('start','record','move','complete','stop') THEN RAISE EXCEPTION 'invalid_workout_result'; END IF;
 PERFORM 1 FROM public.fgi_ai_profiles WHERE user_id=p_user FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'workout_missing'; END IF;
 IF op='start' THEN
  IF EXISTS(SELECT 1 FROM public.fgi_ai_workouts WHERE user_id=p_user AND completed_at IS NULL AND data->>'status'='active') THEN RAISE EXCEPTION 'workout_changed'; END IF;
  SELECT document INTO doc FROM public.fgi_ai_plans WHERE id=(p_change->>'plan_id')::uuid AND user_id=p_user AND kind='training' AND status='active';
  IF NOT FOUND THEN RAISE EXCEPTION 'workout_missing'; END IF;
  SELECT value INTO w FROM jsonb_array_elements(doc->'workouts') WHERE value->>'id'=p_change->>'workout_id';
  IF w IS NULL OR jsonb_typeof(w->'exercises') IS DISTINCT FROM 'array' OR jsonb_array_length(w->'exercises')<1 THEN RAISE EXCEPTION 'workout_missing'; END IF;
  opened:=now();idx:=0;
  IF p_change->'from_cursor'='true'::jsonb THEN
   SELECT data->'current_workout' INTO c FROM public.fgi_ai_profiles WHERE user_id=p_user;
   IF c->>'plan_id' IS DISTINCT FROM p_change->>'plan_id' OR c->>'workout_id' IS DISTINCT FROM p_change->>'workout_id' OR c ? 'session_id' THEN RAISE EXCEPTION 'workout_changed'; END IF;
   opened:=(c->>'started_at')::timestamptz;idx:=(c->>'index')::integer;
   IF opened IS NULL OR opened>now() OR idx NOT BETWEEN 0 AND jsonb_array_length(w->'exercises') THEN RAISE EXCEPTION 'invalid_workout_result'; END IF;
  END IF;
  INSERT INTO public.fgi_ai_workouts(id,user_id,plan_id,started_at,data) VALUES((p_change->>'session_id')::uuid,p_user,(p_change->>'plan_id')::uuid,opened,jsonb_build_object('status','active','workout',w,'index',idx,'sets','[]'::jsonb,'reports','[]'::jsonb,'rest_until',null,'log_version',1));
  RETURN;
 END IF;
 SELECT * INTO row FROM public.fgi_ai_workouts WHERE id=(p_change->>'session_id')::uuid AND user_id=p_user FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'workout_missing'; END IF;
 IF op='complete' AND row.completed_at IS NOT NULL AND row.data->>'status'='completed' THEN RETURN; END IF;
 IF row.completed_at IS NOT NULL OR row.data->>'status' IS DISTINCT FROM 'active' THEN RAISE EXCEPTION 'workout_changed'; END IF;
 IF jsonb_typeof(p_change->'revision') IS DISTINCT FROM 'number' OR (p_change->>'revision')::numeric<>trunc((p_change->>'revision')::numeric) THEN RAISE EXCEPTION 'invalid_workout_result'; END IF;
 rev:=(p_change->>'revision')::integer;
 IF rev<>row.revision THEN RAISE EXCEPTION 'workout_changed'; END IF;
 w:=row.data->'workout';
 IF op='record' THEN
  SELECT value,ordinality::integer-1 INTO e,idx FROM jsonb_array_elements(w->'exercises') WITH ORDINALITY WHERE COALESCE(value->>'id','legacy-exercise-'||(ordinality::integer-1))=p_change->>'exercise_id';
  IF e IS NULL THEN RAISE EXCEPTION 'workout_missing'; END IF;
  e:=e||jsonb_build_object('id',COALESCE(e->>'id','legacy-exercise-'||idx));
  IF jsonb_typeof(p_change->'sets') IS DISTINCT FROM 'number' OR (p_change->>'sets')::numeric<>trunc((p_change->>'sets')::numeric) OR (p_change->>'sets')::integer NOT BETWEEN 1 AND 20 OR jsonb_typeof(p_change->'reps') IS DISTINCT FROM 'number' OR (p_change->>'reps')::numeric<>trunc((p_change->>'reps')::numeric) OR (p_change->>'reps')::integer NOT BETWEEN 1 AND 200 OR p_change->>'source' IS NULL OR p_change->>'source' NOT IN ('chat','form') THEN RAISE EXCEPTION 'invalid_workout_result'; END IF;
  IF p_change->'weight_kg' IS DISTINCT FROM 'null'::jsonb AND (jsonb_typeof(p_change->'weight_kg') IS DISTINCT FROM 'number' OR (p_change->>'weight_kg')::numeric NOT BETWEEN 0 AND 500) THEN RAISE EXCEPTION 'invalid_workout_result'; END IF;
  IF p_change->'rpe' IS DISTINCT FROM 'null'::jsonb AND (jsonb_typeof(p_change->'rpe') IS DISTINCT FROM 'number' OR (p_change->>'rpe')::numeric NOT BETWEEN 1 AND 10 OR (p_change->>'rpe')::numeric<>trunc((p_change->>'rpe')::numeric)) THEN RAISE EXCEPTION 'invalid_workout_result'; END IF;
  IF jsonb_typeof(p_change->'comment') IS DISTINCT FROM 'string' OR length(p_change->>'comment')>500 THEN RAISE EXCEPTION 'invalid_workout_result'; END IF;
  PERFORM (p_change->>'record_id')::uuid;
  report:=jsonb_build_object('exercise_id',e->>'id','sets',(p_change->>'sets')::integer,'reps',(p_change->>'reps')::integer,'weight_kg',p_change->'weight_kg','rpe',p_change->'rpe','comment',p_change->>'comment','source',p_change->>'source');
  IF COALESCE(row.data->'reports','[]'::jsonb) @> jsonb_build_array(report) AND p_change->>'source'='chat' THEN RETURN; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(row.data->'sets','[]'::jsonb)) WHERE value->>'record_id'=p_change->>'record_id') THEN RETURN; END IF;
  n:=(p_change->>'sets')::integer;
  IF jsonb_array_length(COALESCE(row.data->'sets','[]'::jsonb))+n>200 THEN RAISE EXCEPTION 'invalid_workout_result'; END IF;
  SELECT jsonb_agg(jsonb_build_object('record_id',p_change->>'record_id','set_number',i,'exercise_id',e->>'id','exercise_index',idx,'exercise',e->>'name','reps',(p_change->>'reps')::integer,'weight_kg',p_change->'weight_kg','rpe',p_change->'rpe','comment',p_change->>'comment','recorded_at',now())) INTO performed FROM generate_series(1,n) i;
  UPDATE public.fgi_ai_workouts SET data=data||jsonb_build_object('sets',COALESCE(data->'sets','[]'::jsonb)||performed,'reports',COALESCE(data->'reports','[]'::jsonb)||jsonb_build_array(report),'rest_until',now()+make_interval(secs=>COALESCE((e->>'rest_seconds')::integer,0))) WHERE id=row.id AND user_id=p_user;
 ELSIF op='move' THEN
  IF jsonb_typeof(p_change->'index') IS DISTINCT FROM 'number' OR (p_change->>'index')::numeric<>trunc((p_change->>'index')::numeric) OR (p_change->>'index')::integer NOT BETWEEN 0 AND jsonb_array_length(w->'exercises') THEN RAISE EXCEPTION 'invalid_workout_result'; END IF;
  UPDATE public.fgi_ai_workouts SET data=data||jsonb_build_object('index',(p_change->>'index')::integer,'rest_until',null) WHERE id=row.id AND user_id=p_user;
 ELSIF op='complete' THEN
  IF p_change->'confirmed' IS DISTINCT FROM 'true'::jsonb THEN RAISE EXCEPTION 'invalid_workout_result'; END IF;
  IF p_change->'duration_minutes' IS DISTINCT FROM 'null'::jsonb AND (jsonb_typeof(p_change->'duration_minutes') IS DISTINCT FROM 'number' OR (p_change->>'duration_minutes')::numeric NOT BETWEEN 1 AND 1440) THEN RAISE EXCEPTION 'invalid_workout_result'; END IF;
  IF p_change->'difficulty' IS DISTINCT FROM 'null'::jsonb AND (jsonb_typeof(p_change->'difficulty') IS DISTINCT FROM 'number' OR (p_change->>'difficulty')::numeric NOT BETWEEN 1 AND 10 OR (p_change->>'difficulty')::numeric<>trunc((p_change->>'difficulty')::numeric)) THEN RAISE EXCEPTION 'invalid_workout_result'; END IF;
  IF jsonb_typeof(p_change->'comment') IS DISTINCT FROM 'string' OR length(p_change->>'comment')>1500 THEN RAISE EXCEPTION 'invalid_workout_result'; END IF;
  UPDATE public.fgi_ai_workouts SET completed_at=now(),data=data||jsonb_build_object('status','completed','stopped_for_pain',false,'duration_minutes',p_change->'duration_minutes','difficulty',p_change->'difficulty','comment',p_change->>'comment') WHERE id=row.id AND user_id=p_user;
 ELSE
  IF jsonb_typeof(p_change->'stopped_for_pain') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'invalid_workout_result'; END IF;
  UPDATE public.fgi_ai_workouts SET completed_at=now(),data=data||jsonb_build_object('status','stopped','stopped_for_pain',p_change->'stopped_for_pain') WHERE id=row.id AND user_id=p_user;
 END IF;
END; $$;
REVOKE ALL ON FUNCTION fgi_private.ai_workout_change(uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION fgi_private.ai_workout_change(uuid,jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.fgi_ai_complete(p_user uuid,p_id uuid,p_conversation uuid,p_consent timestamptz,p_input text,p_output text,p_citations jsonb,p_kind text,p_document jsonb,p_result jsonb)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE patch jsonb; item record; n numeric; current_plan uuid; next_revision integer; state jsonb; current_doc jsonb; selected_workout jsonb; nested record; meal_state jsonb; workout_state jsonb; workout_change jsonb; session_row public.fgi_ai_workouts;
BEGIN
 PERFORM 1 FROM public.fgi_ai_profiles WHERE user_id=p_user AND updated_at=p_consent FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'consent_changed'; END IF;
 IF NOT COALESCE((public.fgi_ai_access(p_user,COALESCE((p_result->>'livemode')::boolean,true))->'modules') ? (p_result->>'module'),false) THEN RAISE EXCEPTION 'subscription_required'; END IF;
 PERFORM 1 FROM public.fgi_ai_conversations WHERE id=p_conversation AND user_id=p_user FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'conversation_missing'; END IF;
 PERFORM 1 FROM fgi_private.ai_requests WHERE user_id=p_user AND id=p_id AND status='pending' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'request_missing'; END IF;
 IF p_result ? 'memory_patch' THEN
  patch:=p_result->'memory_patch';
  IF (p_kind IS NOT NULL AND p_kind<>'training') OR jsonb_typeof(patch)<>'object' OR octet_length(patch::text)>8000 THEN RAISE EXCEPTION 'invalid_memory_patch'; END IF;
  FOR item IN SELECT key,value FROM jsonb_each(patch) LOOP
   IF item.key NOT IN ('name','age','height_cm','weight_kg','goal','target','experience','training_experience','setting','equipment','days_per_week','minutes','restrictions','preferred_sports','sport','weekdays','unavailable_equipment','needs_professional','memory_confirmed_fields','nutrition_preferences','activity','nutrition_pending','diet') THEN RAISE EXCEPTION 'invalid_memory_field'; END IF;
   IF item.key IN ('age','height_cm','weight_kg','days_per_week','minutes') THEN
    IF jsonb_typeof(item.value)<>'number' THEN RAISE EXCEPTION 'invalid_memory_number'; END IF;
    n:=item.value::text::numeric;
    IF (item.key='age' AND (n<13 OR n>100 OR n<>trunc(n))) OR (item.key='height_cm' AND (n<100 OR n>230)) OR (item.key='weight_kg' AND (n<30 OR n>300)) OR (item.key='days_per_week' AND (n<1 OR n>6 OR n<>trunc(n))) OR (item.key='minutes' AND (n<10 OR n>90 OR n<>trunc(n))) THEN RAISE EXCEPTION 'invalid_memory_bounds'; END IF;
   ELSIF item.key IN ('preferred_sports','weekdays','memory_confirmed_fields','unavailable_equipment') THEN
    IF jsonb_typeof(item.value)<>'array' THEN RAISE EXCEPTION 'invalid_memory_array'; END IF;
    IF (item.key='preferred_sports' AND (jsonb_array_length(item.value)<1 OR jsonb_array_length(item.value)>6 OR EXISTS(SELECT 1 FROM jsonb_array_elements(item.value) v WHERE jsonb_typeof(v)<>'string' OR length(v#>>'{}') NOT BETWEEN 1 AND 80))) OR (item.key='weekdays' AND (jsonb_array_length(item.value)>6 OR EXISTS(SELECT 1 FROM jsonb_array_elements(item.value) v WHERE jsonb_typeof(v)<>'number' OR v::text::numeric NOT BETWEEN 0 AND 6 OR v::text::numeric<>trunc(v::text::numeric)) OR (SELECT count(DISTINCT v) FROM jsonb_array_elements(item.value) v)<>jsonb_array_length(item.value))) OR (item.key='unavailable_equipment' AND (jsonb_array_length(item.value)>8 OR EXISTS(SELECT 1 FROM jsonb_array_elements(item.value) v WHERE jsonb_typeof(v)<>'string' OR length(v#>>'{}') NOT BETWEEN 1 AND 100))) OR (item.key='memory_confirmed_fields' AND (jsonb_array_length(item.value)>14 OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(item.value) v WHERE v NOT IN ('name','age','height_cm','weight_kg','goal','target','experience','training_experience','setting','equipment','days_per_week','minutes','restrictions','preferred_sports')))) THEN RAISE EXCEPTION 'invalid_memory_array_values'; END IF;
   ELSIF item.key='nutrition_preferences' THEN
    IF jsonb_typeof(item.value) IS DISTINCT FROM 'object' OR octet_length(item.value::text)>4000 THEN RAISE EXCEPTION 'invalid_nutrition_memory'; END IF;
    FOR nested IN SELECT key,value FROM jsonb_each(item.value) LOOP
     IF nested.key='excluded_foods' THEN
      IF jsonb_typeof(nested.value) IS DISTINCT FROM 'array' OR jsonb_array_length(nested.value)>12 THEN RAISE EXCEPTION 'invalid_nutrition_foods'; END IF;
      IF EXISTS(SELECT 1 FROM jsonb_array_elements(nested.value) v WHERE jsonb_typeof(v) IS DISTINCT FROM 'string' OR length(btrim(v#>>'{}')) NOT BETWEEN 1 AND 100 OR (v#>>'{}') ~ '[[:cntrl:]]') THEN RAISE EXCEPTION 'invalid_nutrition_foods'; END IF;
     ELSIF nested.key IN ('restrictions','preferences') THEN
      IF jsonb_typeof(nested.value) IS DISTINCT FROM 'string' OR length(nested.value#>>'{}')>(CASE nested.key WHEN 'restrictions' THEN 800 ELSE 600 END) OR (nested.value#>>'{}') ~ '[[:cntrl:]]' THEN RAISE EXCEPTION 'invalid_nutrition_text'; END IF;
     ELSIF nested.key='meals_per_day' THEN
      IF jsonb_typeof(nested.value) IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'invalid_nutrition_meals'; END IF;
      n:=nested.value::text::numeric;
      IF n<1 OR n>8 OR n<>trunc(n) THEN RAISE EXCEPTION 'invalid_nutrition_meals'; END IF;
     ELSIF nested.key='goal' THEN
      IF jsonb_typeof(nested.value) IS DISTINCT FROM 'string' OR (nested.value#>>'{}') NOT IN ('loss','gain','maintain','performance') THEN RAISE EXCEPTION 'invalid_nutrition_goal'; END IF;
     ELSE RAISE EXCEPTION 'invalid_nutrition_field';
     END IF;
    END LOOP;
   ELSIF item.key='nutrition_pending' THEN
    IF jsonb_typeof(item.value) IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'invalid_nutrition_pending'; END IF;
   ELSIF item.key='needs_professional' THEN
    IF item.value<>'true'::jsonb THEN RAISE EXCEPTION 'invalid_memory_safety'; END IF;
   ELSE
    IF jsonb_typeof(item.value)<>'string' OR length(item.value#>>'{}')>(CASE item.key WHEN 'restrictions' THEN 800 WHEN 'equipment' THEN 600 WHEN 'diet' THEN 600 WHEN 'target' THEN 300 WHEN 'training_experience' THEN 300 ELSE 100 END) THEN RAISE EXCEPTION 'invalid_memory_text'; END IF;
    IF (item.key='goal' AND (item.value#>>'{}') NOT IN ('Похудение','Набор мышечной массы','Сила','Выносливость','Подготовка к соревнованиям','Техника','Подвижность','Общее здоровье')) OR (item.key='experience' AND (item.value#>>'{}') NOT IN ('beginner','intermediate','advanced')) OR (item.key='setting' AND (item.value#>>'{}') NOT IN ('home','gym','outdoor')) OR (item.key='activity' AND (item.value#>>'{}') NOT IN ('sedentary','light','active')) THEN RAISE EXCEPTION 'invalid_memory_choice'; END IF;
   END IF;
  END LOOP;
  UPDATE public.fgi_ai_profiles SET data=data||patch WHERE user_id=p_user;
 END IF;
 IF p_result ? 'program_pending' THEN
  IF jsonb_typeof(p_result->'program_pending')<>'boolean' THEN RAISE EXCEPTION 'invalid_program_pending'; END IF;
  UPDATE public.fgi_ai_profiles SET data=jsonb_set(data,'{program_pending}',p_result->'program_pending',true) WHERE user_id=p_user;
 END IF;
 INSERT INTO public.fgi_ai_messages(user_id,conversation_id,request_id,role,body,citations,module) VALUES(p_user,p_conversation,p_id,'user',p_input,'[]',p_result->>'module'),(p_user,p_conversation,p_id,'assistant',p_output,p_citations,p_result->>'module');
 IF p_kind='training' THEN
  SELECT id INTO current_plan FROM public.fgi_ai_plans WHERE user_id=p_user AND kind='training' AND status='active' FOR UPDATE;
  IF p_result->>'program_saved'='true' THEN
   IF current_plan IS DISTINCT FROM NULLIF(p_result->>'program_previous_id','')::uuid THEN RAISE EXCEPTION 'program_changed'; END IF;
   IF p_document->>'schema_version'<>'2' OR jsonb_typeof(p_document->'workouts')<>'array' OR jsonb_array_length(p_document->'workouts') NOT BETWEEN 1 AND 6 OR jsonb_typeof(p_result->'profile_snapshot')<>'object' THEN RAISE EXCEPTION 'invalid_program'; END IF;
  END IF;
  SELECT COALESCE(max(revision),0)+1 INTO next_revision FROM public.fgi_ai_plans WHERE user_id=p_user AND kind='training';
  UPDATE public.fgi_ai_plans SET status='archived' WHERE id=current_plan AND user_id=p_user;
  INSERT INTO public.fgi_ai_plans(id,user_id,kind,title,document,status,revision,supersedes_id,profile_snapshot,source_profile_updated_at)
   VALUES((p_result->>'plan_id')::uuid,p_user,'training',p_document->>'title',p_document,'active',next_revision,current_plan,COALESCE(p_result->'profile_snapshot','{}'::jsonb),(SELECT updated_at FROM public.fgi_ai_profiles WHERE user_id=p_user));
 ELSIF p_kind='nutrition' THEN
  SELECT id INTO current_plan FROM public.fgi_ai_plans WHERE user_id=p_user AND kind='nutrition' AND status='active' FOR UPDATE;
  SELECT data->'nutrition_plan_pending' INTO meal_state FROM public.fgi_ai_profiles WHERE user_id=p_user;
  IF p_result->>'module' IS DISTINCT FROM 'nutrition' OR p_result->'nutrition_saved' IS DISTINCT FROM 'true'::jsonb OR meal_state->>'mode' IS DISTINCT FROM 'proposal' THEN RAISE EXCEPTION 'invalid_nutrition_plan'; END IF;
  IF current_plan IS DISTINCT FROM NULLIF(p_result->>'nutrition_previous_id','')::uuid OR current_plan IS DISTINCT FROM NULLIF(meal_state->>'base_plan_id','')::uuid THEN RAISE EXCEPTION 'nutrition_plan_changed'; END IF;
  IF p_document IS DISTINCT FROM meal_state->'document' OR p_result->'profile_snapshot' IS DISTINCT FROM meal_state->'profile_snapshot' OR p_result->>'plan_id' IS DISTINCT FROM meal_state->>'id' OR p_document->>'schema_version' IS DISTINCT FROM '3' OR jsonb_typeof(p_document->'meals') IS DISTINCT FROM 'array' OR jsonb_array_length(p_document->'meals') NOT BETWEEN 2 AND 8 OR octet_length(p_document::text)>30000 OR jsonb_typeof(p_result->'profile_snapshot') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'invalid_nutrition_plan'; END IF;
  SELECT COALESCE(max(revision),0)+1 INTO next_revision FROM public.fgi_ai_plans WHERE user_id=p_user AND kind='nutrition';
  UPDATE public.fgi_ai_plans SET status='archived' WHERE id=current_plan AND user_id=p_user;
  INSERT INTO public.fgi_ai_plans(id,user_id,kind,title,document,status,revision,supersedes_id,profile_snapshot,source_profile_updated_at)
   VALUES((p_result->>'plan_id')::uuid,p_user,'nutrition',p_document->>'title',p_document,'active',next_revision,current_plan,p_result->'profile_snapshot',(SELECT updated_at FROM public.fgi_ai_profiles WHERE user_id=p_user));
 ELSIF p_kind IS NOT NULL THEN
  RAISE EXCEPTION 'invalid_plan_kind';
 END IF;
 -- A proposed menu is private draft state, never an accepted plan.
 IF p_result ? 'nutrition_plan_pending' THEN
  state:=p_result->'nutrition_plan_pending';
  IF p_result->>'module' IS DISTINCT FROM 'nutrition' OR octet_length(state::text)>34000 THEN RAISE EXCEPTION 'invalid_nutrition_state'; END IF;
  IF state<>'null'::jsonb THEN
   IF jsonb_typeof(state) IS DISTINCT FROM 'object' OR state->>'mode' IS NULL OR state->>'mode' NOT IN ('request','proposal') OR state->>'id' IS NULL OR NOT(state ? 'base_plan_id') THEN RAISE EXCEPTION 'invalid_nutrition_state'; END IF;
   PERFORM (state->>'id')::uuid;
   SELECT id INTO current_plan FROM public.fgi_ai_plans WHERE user_id=p_user AND kind='nutrition' AND status='active';
   IF current_plan IS DISTINCT FROM NULLIF(state->>'base_plan_id','')::uuid THEN RAISE EXCEPTION 'nutrition_plan_changed'; END IF;
   IF state->>'mode'='proposal' AND (jsonb_typeof(state->'profile_snapshot') IS DISTINCT FROM 'object' OR octet_length((state->'profile_snapshot')::text)>5000 OR state->'document'->>'schema_version' IS DISTINCT FROM '3' OR jsonb_typeof(state->'document'->'meals') IS DISTINCT FROM 'array' OR jsonb_array_length(state->'document'->'meals') NOT BETWEEN 2 AND 8) THEN RAISE EXCEPTION 'invalid_nutrition_state'; END IF;
  END IF;
  UPDATE public.fgi_ai_profiles SET data=jsonb_set(data,'{nutrition_plan_pending}',state,true) WHERE user_id=p_user;
 END IF;
 -- Actual rows and the chat acknowledgement commit in this same transaction.
 IF p_result ? 'workout_changes' THEN
  IF p_result->>'module' IS DISTINCT FROM 'training' OR jsonb_typeof(p_result->'workout_changes') IS DISTINCT FROM 'array' OR jsonb_array_length(p_result->'workout_changes')>2 THEN RAISE EXCEPTION 'invalid_workout_result'; END IF;
  FOR workout_change IN SELECT value FROM jsonb_array_elements(p_result->'workout_changes') LOOP
   PERFORM fgi_private.ai_workout_change(p_user,workout_change);
  END LOOP;
 END IF;
 IF p_result ? 'workout_log_pending' THEN
  workout_state:=p_result->'workout_log_pending';
  IF p_result->>'module' IS DISTINCT FROM 'training' OR octet_length(workout_state::text)>3000 THEN RAISE EXCEPTION 'invalid_workout_result'; END IF;
  IF workout_state<>'null'::jsonb THEN
   IF jsonb_typeof(workout_state) IS DISTINCT FROM 'object' OR workout_state->>'mode' IS DISTINCT FROM 'completion' OR jsonb_typeof(workout_state->'details') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'invalid_workout_result'; END IF;
   PERFORM (workout_state->>'id')::uuid;
   SELECT * INTO session_row FROM public.fgi_ai_workouts WHERE id=(workout_state->>'session_id')::uuid AND user_id=p_user;
   IF NOT FOUND OR session_row.completed_at IS NOT NULL OR session_row.data->>'status' IS DISTINCT FROM 'active' OR session_row.revision IS DISTINCT FROM (workout_state->>'session_revision')::integer THEN RAISE EXCEPTION 'workout_changed'; END IF;
  END IF;
  UPDATE public.fgi_ai_profiles SET data=jsonb_set(data,'{workout_log_pending}',workout_state,true) WHERE user_id=p_user;
 END IF;
 -- A cursor/proposal is owner-private context, not performed-set history.
 IF p_result ? 'program_edit_pending' THEN
  state:=p_result->'program_edit_pending';
  IF p_result->>'module'<>'training' OR octet_length(state::text)>10000 THEN RAISE EXCEPTION 'invalid_edit_state'; END IF;
  IF state<>'null'::jsonb THEN
   IF jsonb_typeof(state)<>'object' OR state->>'mode' NOT IN ('proposal','select') OR NOT EXISTS(SELECT 1 FROM public.fgi_ai_plans WHERE id=(state->>'program_id')::uuid AND user_id=p_user AND kind='training' AND status='active') THEN RAISE EXCEPTION 'program_changed'; END IF;
  END IF;
  UPDATE public.fgi_ai_profiles SET data=jsonb_set(data,'{program_edit_pending}',state,true) WHERE user_id=p_user;
 END IF;
 IF p_result ? 'current_workout' THEN
  state:=p_result->'current_workout';
  IF p_result->>'module'<>'training' OR octet_length(state::text)>1000 THEN RAISE EXCEPTION 'invalid_workout_state'; END IF;
  IF state<>'null'::jsonb THEN
   IF jsonb_typeof(state)<>'object' OR NOT (state ?& ARRAY['plan_id','workout_id','index','started_at']) OR jsonb_typeof(state->'index') IS DISTINCT FROM 'number' OR (state->>'index')::numeric<>trunc((state->>'index')::numeric) THEN RAISE EXCEPTION 'invalid_workout_state'; END IF;
   SELECT document INTO current_doc FROM public.fgi_ai_plans WHERE id=(state->>'plan_id')::uuid AND user_id=p_user AND kind='training' AND status='active';
   IF NOT FOUND THEN RAISE EXCEPTION 'program_changed'; END IF;
   SELECT value INTO selected_workout FROM jsonb_array_elements(current_doc->'workouts') WHERE value->>'id'=state->>'workout_id';
   IF selected_workout IS NULL OR (state->>'index')::integer NOT BETWEEN 0 AND jsonb_array_length(selected_workout->'exercises') THEN RAISE EXCEPTION 'invalid_workout_state'; END IF;
   IF state ? 'session_id' THEN
    SELECT * INTO session_row FROM public.fgi_ai_workouts WHERE id=(state->>'session_id')::uuid AND user_id=p_user;
    IF NOT FOUND OR session_row.completed_at IS NOT NULL OR session_row.data->>'status' IS DISTINCT FROM 'active' OR session_row.data->'workout'->>'id' IS DISTINCT FROM state->>'workout_id' THEN RAISE EXCEPTION 'workout_changed'; END IF;
    state:=jsonb_set(state,'{started_at}',to_jsonb(session_row.started_at),true);
   END IF;
  END IF;
  UPDATE public.fgi_ai_profiles SET data=jsonb_set(data,'{current_workout}',state,true) WHERE user_id=p_user;
 END IF;
 -- Do not duplicate private profile patches in the retry cache.
 UPDATE fgi_private.ai_requests SET status='completed',result=p_result-'memory_patch'-'workout_changes' WHERE user_id=p_user AND id=p_id;
END; $$;
REVOKE ALL ON FUNCTION public.fgi_ai_complete(uuid,uuid,uuid,timestamptz,text,text,jsonb,text,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fgi_ai_complete(uuid,uuid,uuid,timestamptz,text,text,jsonb,text,jsonb,jsonb) TO service_role;
