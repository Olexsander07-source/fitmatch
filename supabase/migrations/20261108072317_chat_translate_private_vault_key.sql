-- Grant only the already-privileged Supabase service_role access to the
-- translator API key encrypted by Supabase Vault. This is SECURITY INVOKER:
-- it cannot bypass privilege checks for callers. No key is hardcoded here.
CREATE OR REPLACE FUNCTION public.fgi_chat_translate_key()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $function$
  SELECT jsonb_build_object('api_key', (
    SELECT decrypted_secret
    FROM vault.decrypted_secrets
    WHERE name = 'fgi_chat_translate_private_api_key'
    ORDER BY created_at DESC
    LIMIT 1
  ));
$function$;

REVOKE ALL ON FUNCTION public.fgi_chat_translate_key() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fgi_chat_translate_key() FROM anon;
REVOKE ALL ON FUNCTION public.fgi_chat_translate_key() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.fgi_chat_translate_key() TO service_role;
COMMENT ON FUNCTION public.fgi_chat_translate_key() IS 'Server-role-only access to FitGoIn private self-hosted translation key in Supabase Vault';
