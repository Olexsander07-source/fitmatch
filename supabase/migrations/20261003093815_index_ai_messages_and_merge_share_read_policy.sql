-- Complete the conversation/owner foreign-key index and avoid duplicate SELECT policies.
SET lock_timeout='5s';
CREATE INDEX fgi_ai_messages_owner_history ON public.fgi_ai_messages(conversation_id,user_id,created_at DESC,request_id DESC,role);
DROP INDEX public.fgi_ai_messages_history;
DROP POLICY ai_owner ON public.fgi_ai_shares;
DROP POLICY ai_consented_coach_read ON public.fgi_ai_shares;
CREATE POLICY ai_share_read ON public.fgi_ai_shares FOR SELECT TO authenticated
 USING(user_id=(select auth.uid()) OR (coach_id=(select auth.uid()) AND expires_at>now()));
CREATE POLICY ai_share_insert ON public.fgi_ai_shares FOR INSERT TO authenticated
 WITH CHECK(user_id=(select auth.uid()) AND EXISTS(SELECT 1 FROM public.fgi_ai_profiles WHERE user_id=(select auth.uid())));
CREATE POLICY ai_share_update ON public.fgi_ai_shares FOR UPDATE TO authenticated
 USING(user_id=(select auth.uid()))
 WITH CHECK(user_id=(select auth.uid()) AND EXISTS(SELECT 1 FROM public.fgi_ai_profiles WHERE user_id=(select auth.uid())));
CREATE POLICY ai_share_delete ON public.fgi_ai_shares FOR DELETE TO authenticated USING(user_id=(select auth.uid()));
