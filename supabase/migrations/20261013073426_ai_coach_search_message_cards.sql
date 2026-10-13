-- Public coach snapshots belong to the existing owner-only AI message/history.
-- No new coach/search/message table, role grant, entitlement or MATCH function.
ALTER TABLE public.fgi_ai_messages ADD COLUMN IF NOT EXISTS coach_search jsonb;
ALTER TABLE public.fgi_ai_messages ADD CONSTRAINT ai_message_coach_search_bounded CHECK (
 coach_search IS NULL OR (
  role='assistant' AND jsonb_typeof(coach_search)='object' AND octet_length(coach_search::text)<=16000
  AND coach_search ?& ARRAY['schema_version','status']
  AND jsonb_typeof(coach_search->'schema_version')='number' AND coach_search->'schema_version'='1'::jsonb
  AND jsonb_typeof(coach_search->'status')='string'
  AND coach_search->>'status' IN ('results','no_results','needs_clarification','cancelled','unavailable')
  AND (NOT (coach_search ? 'coaches') OR CASE WHEN jsonb_typeof(coach_search->'coaches')='array' THEN jsonb_array_length(coach_search->'coaches')<=3 ELSE false END)
  AND (coach_search->>'status'<>'results' OR CASE WHEN jsonb_typeof(coach_search->'coaches')='array' THEN jsonb_array_length(coach_search->'coaches') BETWEEN 1 AND 3 ELSE false END)
 )
);
COMMENT ON COLUMN public.fgi_ai_messages.coach_search IS 'Versioned public snapshots from controlled search_coaches, saved atomically with the assistant answer. Owner message RLS and existing service-only writes apply.';

-- Preserve the complete current nutrition/program/workout/memory transaction.
-- Replace exactly one INSERT statement; fail closed if its contract changed.
DO $migration$
DECLARE
 definition text := pg_get_functiondef('public.fgi_ai_complete(uuid,uuid,uuid,timestamptz,text,text,jsonb,text,jsonb,jsonb)'::regprocedure);
 original text := $old$INSERT INTO public.fgi_ai_messages(user_id,conversation_id,request_id,role,body,citations,module) VALUES(p_user,p_conversation,p_id,'user',p_input,'[]',p_result->>'module'),(p_user,p_conversation,p_id,'assistant',p_output,p_citations,p_result->>'module');$old$;
 replacement text := $new$INSERT INTO public.fgi_ai_messages(user_id,conversation_id,request_id,role,body,citations,module,coach_search) VALUES(p_user,p_conversation,p_id,'user',p_input,'[]',p_result->>'module',NULL),(p_user,p_conversation,p_id,'assistant',p_output,p_citations,p_result->>'module',p_result->'coach_search');$new$;
BEGIN
 IF position(original IN definition)=0 OR (length(definition)-length(replace(definition,original,'')))/length(original)<>1 THEN
  RAISE EXCEPTION 'Existing fgi_ai_complete INSERT changed; review before applying coach cards';
 END IF;
 EXECUTE replace(definition,original,replacement);
END;
$migration$;
