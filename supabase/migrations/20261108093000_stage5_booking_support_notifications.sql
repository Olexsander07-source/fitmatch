-- FitGoIn stage 5: complete an existing chat with an appointment request.
-- No payments. Reuse public.bookings rather than creating duplicate booking tables.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS thread_id uuid REFERENCES public.fgi_threads(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS duration_minutes integer NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Europe/Paris';
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_duration_check;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_duration_check CHECK (duration_minutes BETWEEN 15 AND 240);
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_timezone_check;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_timezone_check CHECK (length(timezone) BETWEEN 3 AND 80);
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_status_check
 CHECK (status IN ('pending','confirmed','declined','cancelled','completed'));
CREATE INDEX IF NOT EXISTS fgi_bookings_by_thread_created
 ON public.bookings(thread_id,created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS fgi_bookings_coach_timeslot_active
 ON public.bookings(coach_id,booking_date,booking_time)
 WHERE status IN ('pending','confirmed');

-- A server-verified owner identity, not self-editable user_metadata.
CREATE OR REPLACE FUNCTION public.fgi_is_owner()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$
 SELECT coalesce((SELECT u.raw_app_meta_data->>'fitgoin_role'='owner'
  FROM auth.users u WHERE u.id=(SELECT auth.uid())),false);
$$;
REVOKE ALL ON FUNCTION public.fgi_is_owner() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fgi_is_owner() TO authenticated;

CREATE TABLE IF NOT EXISTS public.fgi_support_tickets(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 category text NOT NULL CHECK (category IN ('problem','question','suggestion')),
 subject text NOT NULL CHECK(length(btrim(subject)) BETWEEN 6 AND 140),
 body text NOT NULL CHECK(length(btrim(body)) BETWEEN 10 AND 6000),
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','in_progress','resolved')),
 owner_reply text CHECK(owner_reply IS NULL OR length(owner_reply) <= 6000),
 owner_reply_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fgi_support_reporter_created ON public.fgi_support_tickets(reporter_id,created_at DESC);
CREATE INDEX IF NOT EXISTS fgi_support_status_created ON public.fgi_support_tickets(status,created_at DESC);

CREATE TABLE IF NOT EXISTS public.fgi_notifications(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK(kind IN ('booking_requested','booking_received','booking_confirmed','booking_declined','booking_cancelled','booking_completed','support_new','support_reply')),
 booking_id uuid REFERENCES public.bookings(id) ON DELETE CASCADE,
 ticket_id uuid REFERENCES public.fgi_support_tickets(id) ON DELETE CASCADE,
 title text NOT NULL CHECK(length(title) BETWEEN 1 AND 180),
 body text NOT NULL DEFAULT '' CHECK(length(body)<=400),
 read_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fgi_notifications_inbox ON public.fgi_notifications(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS fgi_notifications_unread ON public.fgi_notifications(user_id,created_at DESC) WHERE read_at IS NULL;

ALTER TABLE public.fgi_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fgi_support_tickets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fgi_notifications FROM PUBLIC,anon,authenticated;
REVOKE ALL ON public.fgi_support_tickets FROM PUBLIC,anon,authenticated;
GRANT SELECT,UPDATE(read_at) ON public.fgi_notifications TO authenticated;
GRANT SELECT,INSERT(reporter_id,category,subject,body),UPDATE(status,owner_reply,owner_reply_at)
 ON public.fgi_support_tickets TO authenticated;
DROP POLICY IF EXISTS fgi_notifications_view ON public.fgi_notifications;
CREATE POLICY fgi_notifications_view ON public.fgi_notifications FOR SELECT TO authenticated
 USING (user_id=(SELECT auth.uid()));
DROP POLICY IF EXISTS fgi_notifications_mark ON public.fgi_notifications;
CREATE POLICY fgi_notifications_mark ON public.fgi_notifications FOR UPDATE TO authenticated
 USING (user_id=(SELECT auth.uid())) WITH CHECK (user_id=(SELECT auth.uid()));
DROP POLICY IF EXISTS fgi_support_view ON public.fgi_support_tickets;
CREATE POLICY fgi_support_view ON public.fgi_support_tickets FOR SELECT TO authenticated
 USING (reporter_id=(SELECT auth.uid()) OR (SELECT public.fgi_is_owner()));
DROP POLICY IF EXISTS fgi_support_submit ON public.fgi_support_tickets;
CREATE POLICY fgi_support_submit ON public.fgi_support_tickets FOR INSERT TO authenticated
 WITH CHECK(reporter_id=(SELECT auth.uid()) AND status='open' AND owner_reply IS NULL);
DROP POLICY IF EXISTS fgi_support_owner_update ON public.fgi_support_tickets;
CREATE POLICY fgi_support_owner_update ON public.fgi_support_tickets FOR UPDATE TO authenticated
 USING ((SELECT public.fgi_is_owner())) WITH CHECK ((SELECT public.fgi_is_owner()));

CREATE OR REPLACE FUNCTION public.fgi_touch_support_ticket()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 NEW.updated_at=now();
 IF NEW.owner_reply IS DISTINCT FROM OLD.owner_reply THEN
   NEW.owner_reply_at=CASE WHEN NEW.owner_reply IS NULL THEN NULL ELSE now() END;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS fgi_support_touch ON public.fgi_support_tickets;
CREATE TRIGGER fgi_support_touch BEFORE UPDATE ON public.fgi_support_tickets
 FOR EACH ROW EXECUTE FUNCTION public.fgi_touch_support_ticket();

CREATE OR REPLACE FUNCTION public.fgi_notify_booking()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE kind text; label text;
BEGIN
 IF TG_OP='UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
 IF NEW.status='pending' THEN
   INSERT INTO public.fgi_notifications(user_id,kind,booking_id,title,body)
   VALUES(NEW.coach_id,'booking_requested',NEW.id,'New training request','A client requested a training session.'),
         (NEW.client_id,'booking_received',NEW.id,'Request sent','Your training request was sent to the coach.');
 ELSE
   kind=CASE NEW.status WHEN 'confirmed' THEN 'booking_confirmed'
       WHEN 'declined' THEN 'booking_declined'
       WHEN 'cancelled' THEN 'booking_cancelled'
       WHEN 'completed' THEN 'booking_completed' ELSE NULL END;
   label=CASE NEW.status WHEN 'confirmed' THEN 'Training confirmed'
       WHEN 'declined' THEN 'Training request declined'
       WHEN 'cancelled' THEN 'Training cancelled'
       WHEN 'completed' THEN 'Training completed' ELSE '' END;
   IF kind IS NOT NULL THEN
     INSERT INTO public.fgi_notifications(user_id,kind,booking_id,title,body)
     VALUES(NEW.client_id,kind,NEW.id,label,'See your bookings for details.'),
           (NEW.coach_id,kind,NEW.id,label,'See your bookings for details.');
   END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS fgi_booking_notify ON public.bookings;
CREATE TRIGGER fgi_booking_notify AFTER INSERT OR UPDATE OF status ON public.bookings
 FOR EACH ROW EXECUTE FUNCTION public.fgi_notify_booking();

-- Remove the legacy direct update route: clients must never approve their own request.
DROP POLICY IF EXISTS bookings_insert ON public.bookings;
DROP POLICY IF EXISTS bookings_update ON public.bookings;
REVOKE INSERT,UPDATE ON public.bookings FROM authenticated,anon;

CREATE OR REPLACE FUNCTION public.fgi_booking_create(
 p_thread_id uuid,p_date date,p_time time without time zone,
 p_note text DEFAULT '',p_duration integer DEFAULT 60,p_timezone text DEFAULT 'Europe/Paris')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid := auth.uid(); threadrow public.fgi_threads%ROWTYPE;
 new_id uuid; at_time timestamptz;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501'; END IF;
 SELECT * INTO threadrow FROM public.fgi_threads WHERE id=p_thread_id;
 IF NOT FOUND OR actor<>threadrow.client_id THEN
  RAISE EXCEPTION 'not_client_of_thread' USING ERRCODE='42501';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.fgi_coaches WHERE id=threadrow.coach_id AND published) THEN
  RAISE EXCEPTION 'coach_not_published' USING ERRCODE='22023';
 END IF;
 IF p_duration IS NULL OR p_duration<15 OR p_duration>240 OR p_date IS NULL OR p_time IS NULL
    OR length(coalesce(p_note,''))>1000 OR length(coalesce(p_timezone,''))>80
    OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name=p_timezone)
 THEN RAISE EXCEPTION 'invalid_booking' USING ERRCODE='22023'; END IF;
 at_time=(p_date+p_time) AT TIME ZONE p_timezone;
 IF at_time<=now()+interval '5 minutes' OR at_time>now()+interval '365 days' THEN
  RAISE EXCEPTION 'invalid_booking_time' USING ERRCODE='22023';
 END IF;
 INSERT INTO public.bookings(coach_id,client_id,thread_id,booking_date,booking_time,duration_minutes,
 timezone,status,note)
 VALUES(threadrow.coach_id,actor,threadrow.id,p_date,p_time,p_duration,p_timezone,'pending',btrim(coalesce(p_note,'')))
 RETURNING id INTO new_id;
 RETURN new_id;
END $$;

CREATE OR REPLACE FUNCTION public.fgi_booking_decide(p_booking_id uuid,p_action text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid := auth.uid(); b public.bookings%ROWTYPE; next_status text;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501'; END IF;
 SELECT * INTO b FROM public.bookings WHERE id=p_booking_id FOR UPDATE;
 IF NOT FOUND OR actor NOT IN (b.client_id,b.coach_id) THEN
  RAISE EXCEPTION 'booking_not_found' USING ERRCODE='42501';
 END IF;
 IF p_action='confirm' AND actor=b.coach_id AND b.status='pending' THEN next_status='confirmed';
 ELSIF p_action='decline' AND actor=b.coach_id AND b.status='pending' THEN next_status='declined';
 ELSIF p_action='cancel' AND b.status IN ('pending','confirmed') THEN next_status='cancelled';
 ELSIF p_action='complete' AND actor=b.coach_id AND b.status='confirmed'
    AND (b.booking_date+b.booking_time) AT TIME ZONE b.timezone<=now() THEN next_status='completed';
 ELSE RAISE EXCEPTION 'invalid_booking_transition' USING ERRCODE='22023'; END IF;
 UPDATE public.bookings SET status=next_status,updated_at=now() WHERE id=b.id;
 RETURN next_status;
END $$;
REVOKE ALL ON FUNCTION public.fgi_booking_create(uuid,date,time,text,integer,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fgi_booking_create(uuid,date,time,text,integer,text) TO authenticated;
REVOKE ALL ON FUNCTION public.fgi_booking_decide(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fgi_booking_decide(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.fgi_notify_support()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF TG_OP='INSERT' THEN
   INSERT INTO public.fgi_notifications(user_id,kind,ticket_id,title,body)
   SELECT u.id,'support_new',NEW.id,'New support request','A new user report is waiting for review.'
   FROM auth.users u WHERE u.raw_app_meta_data->>'fitgoin_role'='owner';
 ELSIF NEW.owner_reply IS DISTINCT FROM OLD.owner_reply AND NEW.owner_reply IS NOT NULL THEN
   INSERT INTO public.fgi_notifications(user_id,kind,ticket_id,title,body)
   VALUES(NEW.reporter_id,'support_reply',NEW.id,'Support replied','Open your support request to read the reply.');
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS fgi_support_notify ON public.fgi_support_tickets;
CREATE TRIGGER fgi_support_notify AFTER INSERT OR UPDATE ON public.fgi_support_tickets
 FOR EACH ROW EXECUTE FUNCTION public.fgi_notify_support();

-- Sending mail requires a verified outbound mail service. Store a durable queue,
-- never lose a report while SMTP/Cloudflare Email Service is being configured.
CREATE TABLE IF NOT EXISTS fgi_private.support_email_outbox(
 ticket_id uuid NOT NULL REFERENCES public.fgi_support_tickets(id) ON DELETE CASCADE,
 owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 destination_email text NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sent','failed')),
 created_at timestamptz NOT NULL DEFAULT now(),
 sent_at timestamptz,
 error_code text,
 PRIMARY KEY(ticket_id,owner_id)
);
REVOKE ALL ON fgi_private.support_email_outbox FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.fgi_queue_support_email()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 INSERT INTO fgi_private.support_email_outbox(ticket_id,owner_id,destination_email)
 SELECT NEW.id,u.id,u.email FROM auth.users u
 WHERE u.raw_app_meta_data->>'fitgoin_role'='owner'
  AND u.email_confirmed_at IS NOT NULL AND u.email IS NOT NULL
 ON CONFLICT DO NOTHING;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS fgi_support_email_queue ON public.fgi_support_tickets;
CREATE TRIGGER fgi_support_email_queue AFTER INSERT ON public.fgi_support_tickets
 FOR EACH ROW EXECUTE FUNCTION public.fgi_queue_support_email();

COMMENT ON TABLE fgi_private.support_email_outbox IS 'Pending owner email notifications; mail sender integration must be configured separately.';
