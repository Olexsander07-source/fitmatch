-- Transactional access checks against the existing schema; no fixture survives.
BEGIN;
INSERT INTO auth.users(id,aud,role,email,raw_user_meta_data,created_at,updated_at) VALUES
 ('e4b00000-0000-4000-8000-000000000001','authenticated','authenticated','stage4b-rls-owner@example.invalid','{}',now(),now()),
 ('e4b00000-0000-4000-8000-000000000002','authenticated','authenticated','stage4b-rls-other@example.invalid','{}',now(),now());
INSERT INTO public.fgi_coaches(id,name,sport,goal,format,price,period,city,country,languages,published) VALUES
 ('e4b00000-0000-4000-8000-000000000001','4B rollback hidden',(SELECT id FROM public.fgi_sports ORDER BY id LIMIT 1),'Сила','Онлайн',20,'занятие','','',ARRAY['ru'],false),
 ('e4b00000-0000-4000-8000-000000000002','4B rollback public',(SELECT id FROM public.fgi_sports ORDER BY id LIMIT 1),'Сила','Онлайн и офлайн',30,'месяц','Nice','France',ARRAY['ru'],true);
SET LOCAL ROLE anon;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.fgi_coaches WHERE id='e4b00000-0000-4000-8000-000000000001') THEN RAISE EXCEPTION 'Hidden profile visible to anon'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.fgi_coaches WHERE id='e4b00000-0000-4000-8000-000000000002') THEN RAISE EXCEPTION 'Public profile inaccessible'; END IF;
 IF has_table_privilege(current_user,'public.profiles','SELECT') OR has_table_privilege(current_user,'public.fgi_messages','SELECT') THEN RAISE EXCEPTION 'Private table accessible to anon'; END IF;
END $$;
RESET ROLE;
SET LOCAL request.jwt.claim.sub='e4b00000-0000-4000-8000-000000000001';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.fgi_coaches WHERE id='e4b00000-0000-4000-8000-000000000001') THEN RAISE EXCEPTION 'Owner lost own hidden profile'; END IF;
 IF EXISTS(SELECT 1 FROM public.fgi_coaches WHERE published=true AND id='e4b00000-0000-4000-8000-000000000001') THEN RAISE EXCEPTION 'Search exposes hidden own profile'; END IF;
 IF EXISTS(SELECT 1 FROM public.profiles WHERE id='e4b00000-0000-4000-8000-000000000002') THEN RAISE EXCEPTION 'Other private profile visible'; END IF;
 IF EXISTS(SELECT 1 FROM public.fgi_coaches WHERE id='e4b00000-0000-4000-8000-000000000002' AND published=true AND price<=40 AND period='занятие') THEN RAISE EXCEPTION 'Different price unit admitted'; END IF;
END $$;
RESET ROLE;
SET LOCAL request.jwt.claim.sub='e4b00000-0000-4000-8000-000000000002';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.fgi_coaches WHERE id='e4b00000-0000-4000-8000-000000000001') THEN RAISE EXCEPTION 'Other hidden trainer visible'; END IF;
 IF EXISTS(SELECT 1 FROM public.profiles WHERE id='e4b00000-0000-4000-8000-000000000001') THEN RAISE EXCEPTION 'Other private account visible'; END IF;
END $$;
RESET ROLE;
SELECT 'stage4b_existing_rls_passed' AS result;
ROLLBACK;

