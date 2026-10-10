-- Preserve the existing diary. A new measurement is a new row, including on the same day.
ALTER TABLE public.fgi_ai_progress DROP CONSTRAINT fgi_ai_progress_user_id_recorded_on_key;
-- The legacy escaped-dot check rejected normal owner JPEG paths; retain owner scoping.
ALTER TABLE public.fgi_ai_progress DROP CONSTRAINT fgi_ai_progress_check;
ALTER TABLE public.fgi_ai_progress ADD CONSTRAINT fgi_ai_progress_check CHECK(photo_path IS NULL OR photo_path ~ ('^'||user_id::text||'/[0-9a-f-]{36}[.]jpg$'));
-- Old dates are known, but old creation times are not: do not invent timestamps for them.
ALTER TABLE public.fgi_ai_progress ADD COLUMN recorded_at timestamptz;
ALTER TABLE public.fgi_ai_progress ALTER COLUMN recorded_at SET DEFAULT now();
ALTER TABLE public.fgi_ai_progress ADD COLUMN timezone text NOT NULL DEFAULT 'UTC';
ALTER TABLE public.fgi_ai_progress ADD COLUMN source text NOT NULL DEFAULT 'legacy';
ALTER TABLE public.fgi_ai_progress ALTER COLUMN source SET DEFAULT 'form';
ALTER TABLE public.fgi_ai_progress ADD CONSTRAINT ai_progress_source CHECK(source IN('legacy','form','chat','profile'));
CREATE INDEX ai_progress_owner_date ON public.fgi_ai_progress(user_id,recorded_on DESC,recorded_at DESC NULLS LAST,id DESC);

CREATE FUNCTION fgi_private.ai_progress_guard() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF TG_OP='UPDATE' THEN
  IF (to_jsonb(NEW)-'photo_path') IS DISTINCT FROM (to_jsonb(OLD)-'photo_path') THEN RAISE EXCEPTION 'progress_immutable'; END IF;
  RETURN NEW;
 END IF;
 PERFORM 1 FROM public.fgi_ai_profiles WHERE user_id=NEW.user_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'profile_missing'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name=NEW.timezone) OR NEW.recorded_on<'2000-01-01' OR NEW.recorded_on>(now() AT TIME ZONE NEW.timezone)::date OR NEW.source NOT IN('form','chat','profile') THEN RAISE EXCEPTION 'invalid_progress'; END IF;
 NEW.recorded_at:=clock_timestamp();
 RETURN NEW;
END; $$;
CREATE TRIGGER ai_progress_guard BEFORE INSERT OR UPDATE ON public.fgi_ai_progress FOR EACH ROW EXECUTE FUNCTION fgi_private.ai_progress_guard();

CREATE FUNCTION fgi_private.ai_progress_profile() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE latest public.fgi_ai_progress;
BEGIN
 IF NEW.weight_kg IS NULL THEN RETURN NULL; END IF;
 SELECT * INTO latest FROM public.fgi_ai_progress WHERE user_id=NEW.user_id AND weight_kg IS NOT NULL ORDER BY recorded_on DESC,recorded_at DESC NULLS LAST,id DESC LIMIT 1;
 IF latest.id=NEW.id THEN
  UPDATE public.fgi_ai_profiles SET data=data||jsonb_build_object('weight_kg',NEW.weight_kg,'weight_recorded_on',NEW.recorded_on,'weight_measurement_id',NEW.id) WHERE user_id=NEW.user_id;
 END IF;
 RETURN NULL;
END; $$;
CREATE TRIGGER ai_progress_profile AFTER INSERT ON public.fgi_ai_progress FOR EACH ROW EXECUTE FUNCTION fgi_private.ai_progress_profile();

-- Clearing the profile field must not erase or contradict a known history.
CREATE FUNCTION fgi_private.ai_profile_weight_guard() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE latest public.fgi_ai_progress;
BEGIN
 IF jsonb_typeof(NEW.data->'weight_kg') IS DISTINCT FROM 'number' THEN
  SELECT * INTO latest FROM public.fgi_ai_progress WHERE user_id=NEW.user_id AND weight_kg IS NOT NULL ORDER BY recorded_on DESC,recorded_at DESC NULLS LAST,id DESC LIMIT 1;
  IF FOUND THEN NEW.data:=NEW.data||jsonb_build_object('weight_kg',latest.weight_kg,'weight_recorded_on',latest.recorded_on,'weight_measurement_id',latest.id); END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER ai_profile_weight_guard BEFORE INSERT OR UPDATE ON public.fgi_ai_profiles FOR EACH ROW EXECUTE FUNCTION fgi_private.ai_profile_weight_guard();
REVOKE ALL ON FUNCTION fgi_private.ai_profile_weight_guard() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION fgi_private.ai_profile_weight_guard() TO service_role;

-- A subsequently changed profile weight is also a real, dated historical entry.
-- Pre-existing profile values are deliberately NOT backfilled with guessed dates.
CREATE FUNCTION fgi_private.ai_profile_measurement() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE latest public.fgi_ai_progress; tz text; w numeric;
BEGIN
 IF jsonb_typeof(NEW.data->'weight_kg') IS DISTINCT FROM 'number' THEN RETURN NULL; END IF;
 IF TG_OP='UPDATE' AND NEW.data->'weight_kg' IS NOT DISTINCT FROM OLD.data->'weight_kg' THEN RETURN NULL; END IF;
 w:=(NEW.data->>'weight_kg')::numeric;
 IF w<20 OR w>300 OR w<>round(w,2) THEN RAISE EXCEPTION 'invalid_progress'; END IF;
 SELECT * INTO latest FROM public.fgi_ai_progress WHERE user_id=NEW.user_id AND weight_kg IS NOT NULL ORDER BY recorded_on DESC,recorded_at DESC NULLS LAST,id DESC LIMIT 1;
 IF latest.id IS NOT NULL AND latest.weight_kg=w THEN RETURN NULL; END IF;
 tz:=COALESCE(NEW.data->>'progress_timezone','UTC');
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name=tz) THEN tz:='UTC'; END IF;
 INSERT INTO public.fgi_ai_progress(user_id,recorded_on,weight_kg,timezone,source) VALUES(NEW.user_id,(now() AT TIME ZONE tz)::date,w,tz,'profile');
 RETURN NULL;
END; $$;
CREATE TRIGGER ai_profile_measurement AFTER INSERT OR UPDATE ON public.fgi_ai_profiles FOR EACH ROW EXECUTE FUNCTION fgi_private.ai_profile_measurement();
REVOKE ALL ON FUNCTION fgi_private.ai_progress_guard(),fgi_private.ai_progress_profile(),fgi_private.ai_profile_measurement() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION fgi_private.ai_progress_guard(),fgi_private.ai_progress_profile(),fgi_private.ai_profile_measurement() TO service_role;

-- Reconcile existing, dated diary rows without fabricating historical measurements.
UPDATE public.fgi_ai_profiles p SET data=p.data||jsonb_build_object('weight_kg',m.weight_kg,'weight_recorded_on',m.recorded_on,'weight_measurement_id',m.id)
FROM (SELECT DISTINCT ON(user_id) user_id,id,recorded_on,weight_kg FROM public.fgi_ai_progress WHERE weight_kg IS NOT NULL ORDER BY user_id,recorded_on DESC,recorded_at DESC NULLS LAST,id DESC) m WHERE m.user_id=p.user_id;
CREATE INDEX ai_workouts_completed_owner_date ON public.fgi_ai_workouts(user_id,completed_at DESC,id DESC) WHERE completed_at IS NOT NULL AND data->>'status'='completed';

CREATE FUNCTION fgi_private.ai_progress_change(p_user uuid,p_id uuid,p_record jsonb) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE row public.fgi_ai_progress;
BEGIN
 IF jsonb_typeof(p_record) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_record) k WHERE k NOT IN('recorded_on','weight_kg','notes','timezone','source')) OR jsonb_typeof(p_record->'weight_kg') IS DISTINCT FROM 'number' OR jsonb_typeof(p_record->'recorded_on') IS DISTINCT FROM 'string' OR jsonb_typeof(p_record->'notes') IS DISTINCT FROM 'string' OR p_record->>'source' IS DISTINCT FROM 'chat' OR length(p_record->>'notes')>1500 OR (p_record->>'weight_kg')::numeric<>round((p_record->>'weight_kg')::numeric,2) THEN RAISE EXCEPTION 'invalid_progress'; END IF;
 SELECT * INTO row FROM public.fgi_ai_progress WHERE id=p_id;
 IF FOUND THEN
  IF row.user_id<>p_user OR row.recorded_on<>(p_record->>'recorded_on')::date OR row.weight_kg IS DISTINCT FROM (p_record->>'weight_kg')::numeric OR row.notes IS DISTINCT FROM p_record->>'notes' THEN RAISE EXCEPTION 'invalid_progress'; END IF;
  RETURN;
 END IF;
 INSERT INTO public.fgi_ai_progress(id,user_id,recorded_on,weight_kg,notes,timezone,source) VALUES(p_id,p_user,(p_record->>'recorded_on')::date,(p_record->>'weight_kg')::numeric,p_record->>'notes',p_record->>'timezone','chat');
END; $$;
REVOKE ALL ON FUNCTION fgi_private.ai_progress_change(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION fgi_private.ai_progress_change(uuid,uuid,jsonb) TO service_role;

-- Service-only read API; the Edge Function passes only the verified Auth user's ID.
CREATE FUNCTION public.fgi_ai_history(p_user uuid,p_timezone text,p_terms text[] DEFAULT '{}') RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE day date; answer jsonb; exercises jsonb;
BEGIN
 IF p_terms IS NULL OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name=p_timezone) OR cardinality(p_terms)>4 OR EXISTS(SELECT 1 FROM unnest(p_terms) t WHERE length(t)<2 OR length(t)>50) THEN RAISE EXCEPTION 'invalid_progress'; END IF;
 day:=(now() AT TIME ZONE p_timezone)::date;
 SELECT jsonb_build_object('today',day,'week_start',day-6,
  'workout_count_week',(SELECT count(*) FROM public.fgi_ai_workouts WHERE user_id=p_user AND data->>'status'='completed' AND completed_at<=now() AND completed_at>=((day-6)::timestamp AT TIME ZONE p_timezone) AND completed_at<((day+1)::timestamp AT TIME ZONE p_timezone)),
  'workouts',COALESCE((SELECT jsonb_agg(r ORDER BY r.completed_at DESC,r.id DESC) FROM (SELECT id,completed_at,data FROM public.fgi_ai_workouts WHERE user_id=p_user AND completed_at IS NOT NULL AND completed_at<=now() AND data->>'status'='completed' ORDER BY completed_at DESC,id DESC LIMIT 10) r),'[]'),
  'weights',COALESCE((SELECT jsonb_agg(r ORDER BY r.recorded_on DESC,r.recorded_at DESC NULLS LAST,r.id DESC) FROM (SELECT id,recorded_on,recorded_at,weight_kg,notes FROM public.fgi_ai_progress WHERE user_id=p_user AND weight_kg IS NOT NULL ORDER BY recorded_on DESC,recorded_at DESC NULLS LAST,id DESC LIMIT 20) r),'[]'),
  'first_weight',(SELECT to_jsonb(r) FROM (SELECT id,recorded_on,weight_kg FROM public.fgi_ai_progress WHERE user_id=p_user AND weight_kg IS NOT NULL ORDER BY recorded_on,recorded_at NULLS FIRST,id LIMIT 1) r),
  'latest_weight',(SELECT to_jsonb(r) FROM (SELECT id,recorded_on,weight_kg FROM public.fgi_ai_progress WHERE user_id=p_user AND weight_kg IS NOT NULL ORDER BY recorded_on DESC,recorded_at DESC NULLS LAST,id DESC LIMIT 1) r)) INTO answer;
 IF cardinality(p_terms)>0 THEN
  WITH candidates AS (
   SELECT DISTINCT ON (lower(replace(e->>'exercise','ё','е'))) w.id,w.completed_at
   FROM public.fgi_ai_workouts w CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(w.data->'sets')='array' THEN w.data->'sets' ELSE '[]' END) e
   WHERE w.user_id=p_user AND w.completed_at IS NOT NULL AND w.completed_at<=now() AND w.data->>'status'='completed' AND e->>'exercise' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM unnest(p_terms) t WHERE strpos(lower(replace(e->>'exercise','ё','е')),t)=0)
   ORDER BY lower(replace(e->>'exercise','ё','е')),w.completed_at DESC,w.id DESC
  ) SELECT COALESCE(jsonb_agg(r ORDER BY r.completed_at DESC,r.id DESC),'[]') INTO exercises FROM (SELECT w.id,w.completed_at,w.data FROM public.fgi_ai_workouts w WHERE w.id IN(SELECT id FROM candidates) AND w.user_id=p_user ORDER BY w.completed_at DESC,w.id DESC LIMIT 10) r;
 END IF;
 RETURN answer||jsonb_build_object('exercise_workouts',COALESCE(exercises,'[]'::jsonb));
END; $$;
REVOKE ALL ON FUNCTION public.fgi_ai_history(uuid,text,text[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fgi_ai_history(uuid,text,text[]) TO service_role;

-- Extend the existing transaction; preserve 3B nutrition and 3C workout semantics.
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
 IF p_result ? 'progress_record' THEN
  PERFORM fgi_private.ai_progress_change(p_user,p_id,p_result->'progress_record');
 END IF;
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
  IF patch ? 'weight_kg' AND NOT(p_result ? 'progress_record') THEN
   PERFORM fgi_private.ai_progress_change(p_user,p_id,jsonb_build_object('recorded_on',(now() AT TIME ZONE COALESCE(p_result->>'measurement_timezone','UTC'))::date,'weight_kg',patch->'weight_kg','notes','','timezone',COALESCE(p_result->>'measurement_timezone','UTC'),'source','chat'));
  END IF;
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
 UPDATE fgi_private.ai_requests SET status='completed',result=p_result-'memory_patch'-'workout_changes'-'progress_record'-'measurement_timezone' WHERE user_id=p_user AND id=p_id;
END; $$;
REVOKE ALL ON FUNCTION public.fgi_ai_complete(uuid,uuid,uuid,timestamptz,text,text,jsonb,text,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fgi_ai_complete(uuid,uuid,uuid,timestamptz,text,text,jsonb,text,jsonb,jsonb) TO service_role;
