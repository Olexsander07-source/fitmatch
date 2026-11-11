-- Private international trainer document review. A document is evidence, not a licence to work worldwide.
CREATE TABLE IF NOT EXISTS public.fgi_trainer_documents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 coach_id uuid NOT NULL REFERENCES public.fgi_coaches(id) ON DELETE CASCADE,
 service_country text NOT NULL CHECK (service_country ~ '^[A-Z]{2}$'),
 service_format text NOT NULL CHECK (service_format IN ('online','in_person','both')),
 document_kind text NOT NULL CHECK (document_kind IN ('qualification','professional_card','licence','business_registration')),
 document_path text NOT NULL UNIQUE,
 reference text CHECK (reference IS NULL OR char_length(reference)<=120),
 valid_until date,
 attested boolean NOT NULL CHECK(attested=true),
 statement_accepted_at timestamptz NOT NULL DEFAULT now(),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','rejected')),
 review_note text CHECK(review_note IS NULL OR char_length(review_note)<=800),
 reviewed_by uuid REFERENCES auth.users(id),
 reviewed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT fgi_doc_path_owner CHECK (split_part(document_path,'/',1)=coach_id::text),
 CONSTRAINT fgi_doc_path_uuid CHECK (document_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(pdf|jpg|jpeg|png|webp)$'),
 CONSTRAINT fgi_doc_review_guard CHECK (
  (status='pending' AND reviewed_by IS NULL AND reviewed_at IS NULL) OR
  (status<>'pending' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)
 )
);
CREATE INDEX IF NOT EXISTS fgi_trainer_documents_owner_date ON public.fgi_trainer_documents(coach_id,created_at DESC);
CREATE INDEX IF NOT EXISTS fgi_trainer_documents_pending ON public.fgi_trainer_documents(created_at) WHERE status='pending';
ALTER TABLE public.fgi_trainer_documents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fgi_trainer_documents FROM public,anon,authenticated;
GRANT SELECT ON public.fgi_trainer_documents TO authenticated;
GRANT INSERT(id,coach_id,service_country,service_format,document_kind,document_path,reference,valid_until,attested)
 ON public.fgi_trainer_documents TO authenticated;
GRANT UPDATE(status,review_note) ON public.fgi_trainer_documents TO authenticated;
GRANT DELETE ON public.fgi_trainer_documents TO authenticated;
DROP POLICY IF EXISTS fgi_trainer_documents_read ON public.fgi_trainer_documents;
CREATE POLICY fgi_trainer_documents_read ON public.fgi_trainer_documents FOR SELECT TO authenticated
 USING (coach_id=(SELECT auth.uid()) OR (SELECT public.fgi_is_owner()));
DROP POLICY IF EXISTS fgi_trainer_documents_submit ON public.fgi_trainer_documents;
CREATE POLICY fgi_trainer_documents_submit ON public.fgi_trainer_documents FOR INSERT TO authenticated
 WITH CHECK (coach_id=(SELECT auth.uid()) AND attested=true AND status='pending' AND reviewed_by IS NULL AND reviewed_at IS NULL);
DROP POLICY IF EXISTS fgi_trainer_documents_owner_review ON public.fgi_trainer_documents;
CREATE POLICY fgi_trainer_documents_owner_review ON public.fgi_trainer_documents FOR UPDATE TO authenticated
 USING ((SELECT public.fgi_is_owner())) WITH CHECK ((SELECT public.fgi_is_owner()));
DROP POLICY IF EXISTS fgi_trainer_documents_withdraw ON public.fgi_trainer_documents;
CREATE POLICY fgi_trainer_documents_withdraw ON public.fgi_trainer_documents FOR DELETE TO authenticated
 USING ((coach_id=(SELECT auth.uid()) AND status='pending') OR (SELECT public.fgi_is_owner()));

-- The reviewer is always the verified owner, and an applicant cannot edit evidence after upload.
CREATE OR REPLACE FUNCTION public.fgi_review_trainer_document_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $$
BEGIN
 IF NOT public.fgi_is_owner() THEN RAISE EXCEPTION 'owner_only' USING ERRCODE='42501'; END IF;
 IF NEW.coach_id IS DISTINCT FROM OLD.coach_id OR
    NEW.document_path IS DISTINCT FROM OLD.document_path OR
    NEW.service_country IS DISTINCT FROM OLD.service_country OR
    NEW.service_format IS DISTINCT FROM OLD.service_format OR
    NEW.document_kind IS DISTINCT FROM OLD.document_kind OR
    NEW.reference IS DISTINCT FROM OLD.reference OR
    NEW.valid_until IS DISTINCT FROM OLD.valid_until OR
    NEW.statement_accepted_at IS DISTINCT FROM OLD.statement_accepted_at OR
    NEW.attested IS DISTINCT FROM OLD.attested THEN
   RAISE EXCEPTION 'immutable_evidence' USING ERRCODE='23514';
 END IF;
 IF NEW.status NOT IN ('accepted','rejected') THEN RAISE EXCEPTION 'invalid_review_status' USING ERRCODE='23514'; END IF;
 NEW.reviewed_by=auth.uid();
 NEW.reviewed_at=now();
 RETURN NEW;
END
$$;
REVOKE ALL ON FUNCTION public.fgi_review_trainer_document_guard() FROM public,anon,authenticated;
DROP TRIGGER IF EXISTS fgi_trainer_document_review_guard ON public.fgi_trainer_documents;
CREATE TRIGGER fgi_trainer_document_review_guard
 BEFORE UPDATE ON public.fgi_trainer_documents
 FOR EACH ROW EXECUTE FUNCTION public.fgi_review_trainer_document_guard();

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('fgi-trainer-docs','fgi-trainer-docs',false,6291456,ARRAY['application/pdf','image/jpeg','image/png','image/webp'])
ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=6291456,
allowed_mime_types=ARRAY['application/pdf','image/jpeg','image/png','image/webp'];
DROP POLICY IF EXISTS fgi_trainer_docs_upload ON storage.objects;
CREATE POLICY fgi_trainer_docs_upload ON storage.objects FOR INSERT TO authenticated
 WITH CHECK (bucket_id='fgi-trainer-docs'
  AND (storage.foldername(name))[1]=(SELECT auth.uid())::text
  AND name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(pdf|jpg|jpeg|png|webp)$'
  AND EXISTS(SELECT 1 FROM public.fgi_coaches c WHERE c.id=(SELECT auth.uid())));
DROP POLICY IF EXISTS fgi_trainer_docs_read ON storage.objects;
CREATE POLICY fgi_trainer_docs_read ON storage.objects FOR SELECT TO authenticated
 USING (bucket_id='fgi-trainer-docs'
  AND ((storage.foldername(name))[1]=(SELECT auth.uid())::text OR (SELECT public.fgi_is_owner())));
DROP POLICY IF EXISTS fgi_trainer_docs_delete ON storage.objects;
CREATE POLICY fgi_trainer_docs_delete ON storage.objects FOR DELETE TO authenticated
 USING (bucket_id='fgi-trainer-docs' AND
  ((SELECT public.fgi_is_owner()) OR
   ((storage.foldername(name))[1]=(SELECT auth.uid())::text AND EXISTS
    (SELECT 1 FROM public.fgi_trainer_documents d
     WHERE d.coach_id=(SELECT auth.uid()) AND d.document_path=name AND d.status='pending'))));

-- Commercial rollout remains disabled until real publisher and B2C compliance are documented.
CREATE TABLE IF NOT EXISTS public.fgi_launch_compliance (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 enterprise_registered boolean NOT NULL DEFAULT false,
 consumer_terms_approved boolean NOT NULL DEFAULT false,
 trainer_rules_approved boolean NOT NULL DEFAULT false,
 payment_activation_approved boolean NOT NULL DEFAULT false,
 updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.fgi_launch_compliance(singleton) VALUES(true) ON CONFLICT DO NOTHING;
ALTER TABLE public.fgi_launch_compliance ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fgi_launch_compliance FROM public,anon,authenticated;
GRANT ALL ON public.fgi_launch_compliance TO service_role;
CREATE OR REPLACE FUNCTION public.fgi_block_unapproved_payment_links()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
 IF nullif(btrim(NEW.payment_url),'') IS NOT NULL
 AND (NOT EXISTS(SELECT 1 FROM public.fgi_launch_compliance
                  WHERE singleton=true AND enterprise_registered AND consumer_terms_approved
                  AND trainer_rules_approved AND payment_activation_approved))
 THEN RAISE EXCEPTION 'payments_not_enabled: FitGoIn cannot offer trainer payment links before legal launch'
      USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END
$$;
DROP TRIGGER IF EXISTS fgi_block_unapproved_payment_links ON public.fgi_coaches;
CREATE TRIGGER fgi_block_unapproved_payment_links
 BEFORE INSERT OR UPDATE OF payment_url ON public.fgi_coaches
 FOR EACH ROW EXECUTE FUNCTION public.fgi_block_unapproved_payment_links();
