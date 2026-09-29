-- FitGoIn Stage 1. Existing project only. No application data is deleted.
-- Requires the recorded pre-change snapshot. Applied atomically by Supabase.
SET lock_timeout = '5s';
SET statement_timeout = '30s';
LOCK TABLE public.profiles, public.coaches, public.fgi_coaches,
 public.reviews, public.bookings, public.conversations, public.messages
 IN SHARE ROW EXCLUSIVE MODE;

-- Stop rather than guess a mapping if legacy data appeared after the audit.
DO $$
BEGIN
 IF EXISTS (SELECT 1 FROM public.coaches) THEN
  RAISE EXCEPTION 'Legacy coaches now contain data; inspect and map before proceeding';
 END IF;
 IF EXISTS (SELECT 1 FROM public.reviews r LEFT JOIN public.fgi_coaches c ON c.id=r.coach_id WHERE c.id IS NULL)
 OR EXISTS (SELECT 1 FROM public.bookings b LEFT JOIN public.fgi_coaches c ON c.id=b.coach_id WHERE c.id IS NULL)
 OR EXISTS (SELECT 1 FROM public.conversations t LEFT JOIN public.fgi_coaches c ON c.id=t.coach_id WHERE c.id IS NULL) THEN
  RAISE EXCEPTION 'Unmapped trainer references found; no data changed';
 END IF;
END $$;

CREATE SCHEMA IF NOT EXISTS fgi_private;
REVOKE ALL ON SCHEMA fgi_private FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA fgi_private
 REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;

-- These are internal functions, never frontend RPC endpoints.
ALTER FUNCTION public.handle_new_user() SET SCHEMA fgi_private;
ALTER FUNCTION public.update_updated_at() SET SCHEMA fgi_private;
ALTER FUNCTION public.update_coach_rating(uuid) SET SCHEMA fgi_private;
ALTER FUNCTION public.handle_review_rating() SET SCHEMA fgi_private;
ALTER FUNCTION public.touch_conversation_last_message() SET SCHEMA fgi_private;

CREATE OR REPLACE FUNCTION fgi_private.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
 INSERT INTO public.profiles(id,full_name,role)
 VALUES (NEW.id,coalesce(NEW.raw_user_meta_data->>'full_name',''),'client')
 ON CONFLICT(id) DO NOTHING;
 RETURN NEW;
END $$;
-- Metadata supplies display text only. It never determines permissions or role.

CREATE OR REPLACE FUNCTION fgi_private.update_updated_at()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
BEGIN
 NEW.updated_at=now();
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION fgi_private.sync_coach_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
 -- RLS on fgi_coaches enforces ownership before this AFTER trigger runs.
 INSERT INTO public.profiles(id,full_name,role)
 VALUES(NEW.id,NEW.name,'coach')
 ON CONFLICT(id) DO UPDATE SET
  role=CASE WHEN profiles.role='admin' THEN 'admin' ELSE 'coach' END,
  full_name=coalesce(nullif(profiles.full_name,''),EXCLUDED.full_name),
  updated_at=now()
 WHERE profiles.role NOT IN ('coach','admin') OR nullif(profiles.full_name,'') IS NULL;
 RETURN NEW;
END $$;
CREATE TRIGGER fgi_coaches_sync_profile
 AFTER INSERT OR UPDATE ON public.fgi_coaches
 FOR EACH ROW EXECUTE FUNCTION fgi_private.sync_coach_profile();

-- Restore missing profiles for all existing Auth users, preserving existing data.
INSERT INTO public.profiles(id,full_name,role,created_at)
 SELECT u.id,coalesce(c.name,u.raw_user_meta_data->>'full_name',''),
 CASE WHEN c.id IS NULL THEN 'client' ELSE 'coach' END,u.created_at
 FROM auth.users u LEFT JOIN public.fgi_coaches c ON c.id=u.id
 ON CONFLICT(id) DO NOTHING;
UPDATE public.profiles p SET role='coach',updated_at=now()
 FROM public.fgi_coaches c
 WHERE p.id=c.id AND p.role NOT IN ('coach','admin');

ALTER TABLE public.reviews ADD CONSTRAINT reviews_coach_id_fkey
 FOREIGN KEY(coach_id) REFERENCES public.fgi_coaches(id) ON DELETE CASCADE;
ALTER TABLE public.reviews DROP CONSTRAINT reviews_client_id_fkey;
ALTER TABLE public.reviews ADD CONSTRAINT reviews_client_id_fkey
 FOREIGN KEY(client_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.reviews ADD CONSTRAINT reviews_no_self_review CHECK(coach_id<>client_id);

ALTER TABLE public.bookings DROP CONSTRAINT bookings_coach_id_fkey;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_coach_id_fkey
 FOREIGN KEY(coach_id) REFERENCES public.fgi_coaches(id) ON DELETE CASCADE;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_no_self_booking CHECK(coach_id<>client_id);

ALTER TABLE public.conversations DROP CONSTRAINT conversations_coach_id_fkey;
ALTER TABLE public.conversations ADD CONSTRAINT conversations_coach_id_fkey
 FOREIGN KEY(coach_id) REFERENCES public.fgi_coaches(id) ON DELETE CASCADE;
ALTER TABLE public.conversations ADD CONSTRAINT conversations_no_self_chat CHECK(coach_id<>client_id);

ALTER TABLE public.fgi_coaches ADD COLUMN reviews_count integer NOT NULL DEFAULT 0 CHECK(reviews_count>=0);

CREATE OR REPLACE FUNCTION fgi_private.guard_review()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE trainer uuid;
BEGIN
 IF TG_OP='UPDATE' AND
  (NEW.coach_id IS DISTINCT FROM OLD.coach_id OR NEW.client_id IS DISTINCT FROM OLD.client_id OR NEW.id IS DISTINCT FROM OLD.id) THEN
  RAISE EXCEPTION 'Review ownership and trainer cannot be changed' USING ERRCODE='42501';
 END IF;
 trainer=CASE WHEN TG_OP='DELETE' THEN OLD.coach_id ELSE NEW.coach_id END;
 -- Serialize review writes for each trainer before the AFTER trigger aggregates.
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(trainer::text,792627));
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER reviews_guard BEFORE INSERT OR UPDATE OR DELETE ON public.reviews
 FOR EACH ROW EXECUTE FUNCTION fgi_private.guard_review();

CREATE OR REPLACE FUNCTION fgi_private.update_coach_rating(p_coach_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
 UPDATE public.fgi_coaches c SET
  rating=coalesce((SELECT round(avg(r.rating)::numeric,2) FROM public.reviews r WHERE r.coach_id=p_coach_id),0),
  reviews_count=(SELECT count(*) FROM public.reviews r WHERE r.coach_id=p_coach_id)
 WHERE c.id=p_coach_id;
END $$;
CREATE OR REPLACE FUNCTION fgi_private.handle_review_rating()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
 IF TG_OP='DELETE' THEN
  PERFORM fgi_private.update_coach_rating(OLD.coach_id);
  RETURN OLD;
 END IF;
 PERFORM fgi_private.update_coach_rating(NEW.coach_id);
 RETURN NEW;
END $$;
SELECT fgi_private.update_coach_rating(id) FROM public.fgi_coaches;

CREATE OR REPLACE FUNCTION fgi_private.guard_booking()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE actor uuid=auth.uid();
BEGIN
 IF TG_OP='INSERT' THEN
  IF actor IS NOT NULL AND (NEW.client_id<>actor OR NEW.status<>'pending') THEN
   RAISE EXCEPTION 'Clients can create only their own pending bookings' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
 END IF;
 IF NEW.id IS DISTINCT FROM OLD.id OR NEW.coach_id IS DISTINCT FROM OLD.coach_id
  OR NEW.client_id IS DISTINCT FROM OLD.client_id OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
  RAISE EXCEPTION 'Booking participants and identity cannot be changed' USING ERRCODE='42501';
 END IF;
 IF actor IS NULL THEN RETURN NEW; END IF; -- Privileged maintenance, not an API policy.
 IF actor=OLD.client_id THEN
  IF OLD.status NOT IN ('pending','confirmed')
   OR NEW.status NOT IN (OLD.status,'cancelled')
   OR (OLD.status<>'pending' AND (NEW.booking_date IS DISTINCT FROM OLD.booking_date
     OR NEW.booking_time IS DISTINCT FROM OLD.booking_time OR NEW.note IS DISTINCT FROM OLD.note)) THEN
    RAISE EXCEPTION 'Client may edit pending bookings or cancel an active booking' USING ERRCODE='42501';
  END IF;
 ELSIF actor=OLD.coach_id THEN
  IF NEW.booking_date IS DISTINCT FROM OLD.booking_date OR NEW.booking_time IS DISTINCT FROM OLD.booking_time
   OR NEW.note IS DISTINCT FROM OLD.note THEN
   RAISE EXCEPTION 'Trainer may change booking status only' USING ERRCODE='42501';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND NOT
   ((OLD.status='pending' AND NEW.status IN ('confirmed','cancelled'))
    OR (OLD.status='confirmed' AND NEW.status IN ('completed','cancelled'))) THEN
   RAISE EXCEPTION 'Invalid booking status transition' USING ERRCODE='42501';
  END IF;
 ELSE
  RAISE EXCEPTION 'Not a participant in this booking' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER bookings_guard BEFORE INSERT OR UPDATE ON public.bookings
 FOR EACH ROW EXECUTE FUNCTION fgi_private.guard_booking();
CREATE TRIGGER bookings_updated_at BEFORE UPDATE ON public.bookings
 FOR EACH ROW EXECUTE FUNCTION fgi_private.update_updated_at();
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
 FOR EACH ROW EXECUTE FUNCTION fgi_private.update_updated_at();

-- The old function referred to a nonexistent last_message_at column.
CREATE OR REPLACE FUNCTION fgi_private.touch_conversation_last_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
 UPDATE public.conversations SET updated_at=NEW.created_at WHERE id=NEW.conversation_id;
 RETURN NEW;
END $$;
CREATE TRIGGER messages_touch_conversation AFTER INSERT ON public.messages
 FOR EACH ROW EXECUTE FUNCTION fgi_private.touch_conversation_last_message();

-- Replace permissive legacy policies; keep working fgi_threads/fgi_messages intact.
DO $$
DECLARE p record; t text; cols text;
BEGIN
 FOR p IN SELECT * FROM pg_policies WHERE schemaname='public'
  AND tablename IN ('profiles','sports','coaches','reviews','bookings','conversations','messages')
 LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,p.tablename); END LOOP;
 FOREACH t IN ARRAY ARRAY['profiles','sports','coaches','reviews','bookings','conversations','messages']
 LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC,anon,authenticated',t);
  SELECT string_agg(quote_ident(column_name),',') INTO cols FROM information_schema.columns
   WHERE table_schema='public' AND table_name=t;
  EXECUTE format('REVOKE ALL (%s) ON TABLE public.%I FROM PUBLIC,anon,authenticated',cols,t);
 END LOOP;
END $$;
GRANT SELECT ON public.sports,public.coaches TO anon,authenticated;
CREATE POLICY sports_public_select ON public.sports FOR SELECT TO anon,authenticated USING(true);
CREATE POLICY coaches_select ON public.coaches FOR SELECT TO anon,authenticated USING(true);
COMMENT ON TABLE public.coaches IS 'Retired legacy table. Application writes revoked. Canonical trainer identity is public.fgi_coaches.id.';

GRANT SELECT ON public.profiles TO authenticated;
GRANT INSERT(id,full_name,avatar_url,phone),UPDATE(full_name,avatar_url,phone) ON public.profiles TO authenticated;
CREATE POLICY profiles_select ON public.profiles FOR SELECT TO authenticated USING(id=(SELECT auth.uid()));
CREATE POLICY profiles_insert_own ON public.profiles FOR INSERT TO authenticated
 WITH CHECK(id=(SELECT auth.uid()) AND role='client' AND is_active);
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE TO authenticated
 USING(id=(SELECT auth.uid())) WITH CHECK(id=(SELECT auth.uid()));

GRANT SELECT ON public.reviews TO anon,authenticated;
GRANT INSERT(coach_id,client_id,rating,comment),UPDATE(rating,comment),DELETE ON public.reviews TO authenticated;
CREATE POLICY reviews_public_select ON public.reviews FOR SELECT TO anon,authenticated USING(
 client_id=(SELECT auth.uid()) OR coach_id=(SELECT auth.uid())
 OR EXISTS(SELECT 1 FROM public.fgi_coaches c WHERE c.id=reviews.coach_id AND c.published));
CREATE POLICY reviews_insert_own ON public.reviews FOR INSERT TO authenticated WITH CHECK(
 client_id=(SELECT auth.uid()) AND coach_id<>(SELECT auth.uid())
 AND EXISTS(SELECT 1 FROM public.fgi_coaches c WHERE c.id=reviews.coach_id AND c.published));
CREATE POLICY reviews_update_own ON public.reviews FOR UPDATE TO authenticated
 USING(client_id=(SELECT auth.uid())) WITH CHECK(client_id=(SELECT auth.uid()));
CREATE POLICY reviews_delete_own ON public.reviews FOR DELETE TO authenticated USING(client_id=(SELECT auth.uid()));

GRANT SELECT ON public.bookings TO authenticated;
GRANT INSERT(coach_id,client_id,booking_date,booking_time,note),UPDATE(booking_date,booking_time,status,note)
 ON public.bookings TO authenticated;
CREATE POLICY bookings_select ON public.bookings FOR SELECT TO authenticated
 USING(client_id=(SELECT auth.uid()) OR coach_id=(SELECT auth.uid()));
CREATE POLICY bookings_insert ON public.bookings FOR INSERT TO authenticated WITH CHECK(
 client_id=(SELECT auth.uid()) AND coach_id<>(SELECT auth.uid()) AND status='pending'
 AND EXISTS(SELECT 1 FROM public.fgi_coaches c WHERE c.id=bookings.coach_id AND c.published));
CREATE POLICY bookings_update ON public.bookings FOR UPDATE TO authenticated
 USING(client_id=(SELECT auth.uid()) OR coach_id=(SELECT auth.uid()))
 WITH CHECK(client_id=(SELECT auth.uid()) OR coach_id=(SELECT auth.uid()));

GRANT SELECT ON public.conversations TO authenticated;
GRANT INSERT(coach_id,client_id) ON public.conversations TO authenticated;
CREATE POLICY conversations_select ON public.conversations FOR SELECT TO authenticated
 USING(client_id=(SELECT auth.uid()) OR coach_id=(SELECT auth.uid()));
CREATE POLICY conversations_insert ON public.conversations FOR INSERT TO authenticated WITH CHECK(
 client_id=(SELECT auth.uid()) AND coach_id<>(SELECT auth.uid())
 AND EXISTS(SELECT 1 FROM public.fgi_coaches c WHERE c.id=conversations.coach_id AND c.published));

GRANT SELECT ON public.messages TO authenticated;
GRANT INSERT(conversation_id,sender_id,content),UPDATE(is_read) ON public.messages TO authenticated;
CREATE POLICY messages_select ON public.messages FOR SELECT TO authenticated USING(
 EXISTS(SELECT 1 FROM public.conversations t WHERE t.id=messages.conversation_id
 AND ((SELECT auth.uid())=t.client_id OR (SELECT auth.uid())=t.coach_id)));
CREATE POLICY messages_insert ON public.messages FOR INSERT TO authenticated WITH CHECK(
 sender_id=(SELECT auth.uid()) AND EXISTS(SELECT 1 FROM public.conversations t WHERE t.id=messages.conversation_id
 AND ((SELECT auth.uid())=t.client_id OR (SELECT auth.uid())=t.coach_id)));
CREATE POLICY messages_mark_read ON public.messages FOR UPDATE TO authenticated
 USING(sender_id<>(SELECT auth.uid()) AND EXISTS(SELECT 1 FROM public.conversations t WHERE t.id=messages.conversation_id
 AND ((SELECT auth.uid())=t.client_id OR (SELECT auth.uid())=t.coach_id)))
 WITH CHECK(sender_id<>(SELECT auth.uid()) AND EXISTS(SELECT 1 FROM public.conversations t WHERE t.id=messages.conversation_id
 AND ((SELECT auth.uid())=t.client_id OR (SELECT auth.uid())=t.coach_id)));

-- Trigger functions run through database triggers, not direct user RPCs.
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA fgi_private FROM PUBLIC,anon,authenticated;
NOTIFY pgrst,'reload schema';
