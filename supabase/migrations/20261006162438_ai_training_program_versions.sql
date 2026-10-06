-- Extend the existing program table. Preserve existing programs and RLS.
SET lock_timeout='5s';
SET statement_timeout='30s';
ALTER TABLE public.fgi_ai_plans
 ADD COLUMN status text NOT NULL DEFAULT 'archived' CHECK(status IN ('active','archived')),
 ADD COLUMN revision integer NOT NULL DEFAULT 1 CHECK(revision>=1),
 ADD COLUMN profile_snapshot jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(profile_snapshot)='object' AND octet_length(profile_snapshot::text)<=16000),
 ADD COLUMN source_profile_updated_at timestamptz,
 ADD COLUMN supersedes_id uuid;
ALTER TABLE public.fgi_ai_plans ADD CONSTRAINT ai_program_previous_owner FOREIGN KEY(supersedes_id,user_id) REFERENCES public.fgi_ai_plans(id,user_id) ON DELETE SET NULL (supersedes_id);
WITH ranked AS (
 SELECT id,row_number() OVER(PARTITION BY user_id ORDER BY created_at,id) AS v,
 row_number() OVER(PARTITION BY user_id ORDER BY created_at DESC,id DESC) AS newest
 FROM public.fgi_ai_plans WHERE kind='training'
)
UPDATE public.fgi_ai_plans p SET revision=r.v,status=CASE WHEN r.newest=1 THEN 'active' ELSE 'archived' END FROM ranked r WHERE r.id=p.id;
CREATE UNIQUE INDEX ai_one_active_training_program ON public.fgi_ai_plans(user_id) WHERE kind='training' AND status='active';
COMMENT ON COLUMN public.fgi_ai_plans.profile_snapshot IS 'Consented sports facts used to generate this version. No inferred defaults.';
-- Browser plan inserts/updates stay forbidden. Existing SELECT/DELETE owner
-- policies and RLS are retained; validated replacement uses server completion.
-- Reuse the existing profile and completion transaction. No new tables or RLS.
SET lock_timeout='5s';
SET statement_timeout='30s';
CREATE OR REPLACE FUNCTION public.fgi_ai_complete(p_user uuid,p_id uuid,p_conversation uuid,p_consent timestamptz,p_input text,p_output text,p_citations jsonb,p_kind text,p_document jsonb,p_result jsonb)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE patch jsonb; item record; n numeric; current_plan uuid; next_revision integer;
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
   IF item.key NOT IN ('name','age','height_cm','weight_kg','goal','target','experience','training_experience','setting','equipment','days_per_week','minutes','restrictions','preferred_sports','sport','weekdays','needs_professional','memory_confirmed_fields') THEN RAISE EXCEPTION 'invalid_memory_field'; END IF;
   IF item.key IN ('age','height_cm','weight_kg','days_per_week','minutes') THEN
    IF jsonb_typeof(item.value)<>'number' THEN RAISE EXCEPTION 'invalid_memory_number'; END IF;
    n:=item.value::text::numeric;
    IF (item.key='age' AND (n<13 OR n>100 OR n<>trunc(n))) OR (item.key='height_cm' AND (n<100 OR n>230)) OR (item.key='weight_kg' AND (n<30 OR n>300)) OR (item.key='days_per_week' AND (n<1 OR n>6 OR n<>trunc(n))) OR (item.key='minutes' AND (n<10 OR n>90 OR n<>trunc(n))) THEN RAISE EXCEPTION 'invalid_memory_bounds'; END IF;
   ELSIF item.key IN ('preferred_sports','weekdays','memory_confirmed_fields') THEN
    IF jsonb_typeof(item.value)<>'array' THEN RAISE EXCEPTION 'invalid_memory_array'; END IF;
    IF (item.key='preferred_sports' AND (jsonb_array_length(item.value)<1 OR jsonb_array_length(item.value)>6 OR EXISTS(SELECT 1 FROM jsonb_array_elements(item.value) v WHERE jsonb_typeof(v)<>'string' OR length(v#>>'{}') NOT BETWEEN 1 AND 80))) OR (item.key='weekdays' AND item.value<>'[]'::jsonb) OR (item.key='memory_confirmed_fields' AND (jsonb_array_length(item.value)>14 OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(item.value) v WHERE v NOT IN ('name','age','height_cm','weight_kg','goal','target','experience','training_experience','setting','equipment','days_per_week','minutes','restrictions','preferred_sports')))) THEN RAISE EXCEPTION 'invalid_memory_array_values'; END IF;
   ELSIF item.key='needs_professional' THEN
    IF item.value<>'true'::jsonb THEN RAISE EXCEPTION 'invalid_memory_safety'; END IF;
   ELSE
    IF jsonb_typeof(item.value)<>'string' OR length(item.value#>>'{}')>(CASE item.key WHEN 'restrictions' THEN 800 WHEN 'equipment' THEN 600 WHEN 'target' THEN 300 WHEN 'training_experience' THEN 300 ELSE 100 END) THEN RAISE EXCEPTION 'invalid_memory_text'; END IF;
    IF (item.key='goal' AND (item.value#>>'{}') NOT IN ('Похудение','Набор мышечной массы','Сила','Выносливость','Подготовка к соревнованиям','Техника','Подвижность','Общее здоровье')) OR (item.key='experience' AND (item.value#>>'{}') NOT IN ('beginner','intermediate','advanced')) OR (item.key='setting' AND (item.value#>>'{}') NOT IN ('home','gym','outdoor')) THEN RAISE EXCEPTION 'invalid_memory_choice'; END IF;
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
 ELSIF p_kind IS NOT NULL THEN
  INSERT INTO public.fgi_ai_plans(id,user_id,kind,title,document) VALUES((p_result->>'plan_id')::uuid,p_user,p_kind,p_document->>'title',p_document);
 END IF;
 -- Do not duplicate private profile patches in the retry cache.
 UPDATE fgi_private.ai_requests SET status='completed',result=p_result-'memory_patch' WHERE user_id=p_user AND id=p_id;
END; $$;
REVOKE ALL ON FUNCTION public.fgi_ai_complete(uuid,uuid,uuid,timestamptz,text,text,jsonb,text,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fgi_ai_complete(uuid,uuid,uuid,timestamptz,text,text,jsonb,text,jsonb,jsonb) TO service_role;
