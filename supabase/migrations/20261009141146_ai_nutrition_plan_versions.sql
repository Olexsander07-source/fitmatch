-- Stage 3B: an accepted nutrition version and a bounded owner-private draft.
-- Preserve legacy menus as history; retain the newest as the current menu.
SET lock_timeout='5s';
SET statement_timeout='30s';
WITH ranked AS (
 SELECT id,row_number() OVER(PARTITION BY user_id ORDER BY (status='active') DESC,created_at DESC,id DESC) AS n
 FROM public.fgi_ai_plans WHERE kind='nutrition'
)
UPDATE public.fgi_ai_plans p SET status=CASE WHEN r.n=1 THEN 'active' ELSE 'archived' END
FROM ranked r WHERE p.id=r.id AND p.status IS DISTINCT FROM CASE WHEN r.n=1 THEN 'active' ELSE 'archived' END;
CREATE UNIQUE INDEX IF NOT EXISTS ai_one_active_nutrition_plan ON public.fgi_ai_plans(user_id) WHERE kind='nutrition' AND status='active';
CREATE OR REPLACE FUNCTION public.fgi_ai_complete(p_user uuid,p_id uuid,p_conversation uuid,p_consent timestamptz,p_input text,p_output text,p_citations jsonb,p_kind text,p_document jsonb,p_result jsonb)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE patch jsonb; item record; n numeric; current_plan uuid; next_revision integer; state jsonb; current_doc jsonb; selected_workout jsonb; nested record; meal_state jsonb;
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
  END IF;
  UPDATE public.fgi_ai_profiles SET data=jsonb_set(data,'{current_workout}',state,true) WHERE user_id=p_user;
 END IF;
 -- Do not duplicate private profile patches in the retry cache.
 UPDATE fgi_private.ai_requests SET status='completed',result=p_result-'memory_patch' WHERE user_id=p_user AND id=p_id;
END; $$;
REVOKE ALL ON FUNCTION public.fgi_ai_complete(uuid,uuid,uuid,timestamptz,text,text,jsonb,text,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fgi_ai_complete(uuid,uuid,uuid,timestamptz,text,text,jsonb,text,jsonb,jsonb) TO service_role;
