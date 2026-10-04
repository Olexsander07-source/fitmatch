-- Administrator-run integration checks. Every fixture is rolled back.
BEGIN;
INSERT INTO auth.users(id,aud,role,email,raw_user_meta_data,created_at,updated_at) VALUES
 ('90000000-0000-4000-8000-000000000001','authenticated','authenticated','paid-ai-owner@example.invalid','{"friend":true}',now(),now()),
 ('90000000-0000-4000-8000-000000000002','authenticated','authenticated','paid-ai-other@example.invalid','{}',now(),now());
INSERT INTO public.fgi_ai_profiles(user_id,data,consent_version) VALUES('90000000-0000-4000-8000-000000000001','{}','2026-10-03'),('90000000-0000-4000-8000-000000000002','{}','2026-10-03');
SET LOCAL ROLE service_role;
DO $$ DECLARE u uuid:='90000000-0000-4000-8000-000000000001'; result jsonb; request uuid:=gen_random_uuid(); BEGIN
 IF public.fgi_ai_access(u,true)->'modules'<>'[]'::jsonb THEN RAISE EXCEPTION 'Metadata forged friend access'; END IF;
 result:=public.fgi_ai_checkout_claim(u,true,request,'training');
 PERFORM public.fgi_ai_checkout_save(u,true,request,'https://checkout.stripe.com/fixture');
 result:=public.fgi_ai_checkout_claim(u,true,gen_random_uuid(),'training');
 IF result->>'request_id'<>request::text OR result->>'url'<>'https://checkout.stripe.com/fixture' THEN RAISE EXCEPTION 'Pending checkout not reused'; END IF;
 result:=public.fgi_ai_checkout_claim(u,true,gen_random_uuid(),'bundle');
 IF result->>'error'<>'checkout_pending' THEN RAISE EXCEPTION 'Concurrent plan checkout created'; END IF;

 PERFORM public.fgi_ai_customer_save(u,false,'cus_paid_test');
 PERFORM public.fgi_ai_customer_save(u,true,'cus_paid_live');
 PERFORM public.fgi_ai_billing_sync('evt_test',10,false,u,'cus_paid_test','sub_paid_test','training','active',now()+interval '30 days',now()+interval '30 days',false,NULL,NULL);
 IF NOT(public.fgi_ai_access(u,false)->'modules')?'training' OR (public.fgi_ai_access(u,true)->'modules')?'training' THEN RAISE EXCEPTION 'Test/live entitlement isolation failed'; END IF;
 PERFORM public.fgi_ai_billing_sync('evt_live_unpaid',10,true,u,'cus_paid_live','sub_paid_live','bundle','active',NULL,now()+interval '30 days',false,NULL,NULL);
 IF public.fgi_ai_access(u,true)->'modules'<>'[]'::jsonb THEN RAISE EXCEPTION 'Unpaid active subscription granted access'; END IF;
 PERFORM public.fgi_ai_billing_sync('evt_live_paid',11,true,u,'cus_paid_live','sub_paid_live','bundle','active',now()+interval '30 days',now()+interval '30 days',false,NULL,NULL);
 IF jsonb_array_length(public.fgi_ai_access(u,true)->'modules')<>2 THEN RAISE EXCEPTION 'Paid bundle missing modules'; END IF;
 PERFORM public.fgi_ai_billing_sync('evt_live_paid',11,true,u,'cus_paid_live','sub_paid_live','training','canceled',NULL,NULL,false,NULL,NULL);
 IF jsonb_array_length(public.fgi_ai_access(u,true)->'modules')<>2 THEN RAISE EXCEPTION 'Duplicate event changed access'; END IF;
 PERFORM public.fgi_ai_billing_sync('evt_live_disputed',12,true,u,'cus_paid_live','sub_paid_live','bundle','active',now()+interval '30 days',now()+interval '30 days',false,'disputed','dp_one');
 IF public.fgi_ai_access(u,true)->'modules'<>'[]'::jsonb THEN RAISE EXCEPTION 'Disputed access not blocked'; END IF;
 PERFORM public.fgi_ai_billing_sync('evt_live_refund',13,true,u,'cus_paid_live','sub_paid_live','bundle','active',now()+interval '30 days',now()+interval '30 days',false,'refunded','ch_one');
 PERFORM public.fgi_ai_billing_sync('evt_live_won',14,true,u,'cus_paid_live','sub_paid_live','bundle','active',now()+interval '30 days',now()+interval '30 days',false,'resolved','dp_one');
 IF public.fgi_ai_access(u,true)->'modules'<>'[]'::jsonb THEN RAISE EXCEPTION 'Won dispute cleared unrelated refund'; END IF;
 UPDATE fgi_private.ai_billing_risks SET active=false WHERE risk_id='ch_one';
 result:=public.fgi_ai_reserve(u,request,true,'training',.2,.3,1000);
 IF result->>'reserved'<>'true' THEN RAISE EXCEPTION 'Reservation failed %',result; END IF;
 result:=public.fgi_ai_reserve(u,gen_random_uuid(),true,'training',.2,.3,1000);
 IF result->>'error'<>'monthly_limit' THEN RAISE EXCEPTION 'Monthly reservation exceeded cap'; END IF;
 PERFORM public.fgi_ai_meter(u,request,.05,100,50);
 result:=public.fgi_ai_reserve(u,gen_random_uuid(),true,'training',.2,.3,1000);
 IF result->>'reserved'<>'true' THEN RAISE EXCEPTION 'Settled unused reservation not released'; END IF;
 PERFORM public.fgi_ai_billing_sync('evt_live_cancel',20,true,u,'cus_paid_live','sub_paid_live','bundle','canceled',NULL,NULL,false,NULL,NULL);
 PERFORM public.fgi_ai_billing_sync('evt_live_old',15,true,u,'cus_paid_live','sub_paid_live','bundle','active',now()+interval '30 days',now()+interval '30 days',false,NULL,NULL);
 IF public.fgi_ai_access(u,true)->'modules'<>'[]'::jsonb THEN RAISE EXCEPTION 'Stale event reactivated canceled access'; END IF;
 INSERT INTO fgi_private.ai_friend_grants(user_id,modules,reason) VALUES(u,ARRAY['nutrition'],'Explicit rollback fixture');
 IF NOT (public.fgi_ai_access(u,true)->'modules')?'nutrition' OR (public.fgi_ai_access(u,true)->'modules')?'training' THEN RAISE EXCEPTION 'Friend module grant incorrect'; END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000001',true);
SET LOCAL ROLE authenticated;
INSERT INTO public.fgi_ai_food(user_id,name,calories_low,calories_high,protein_g,fat_g,carbs_g,source) VALUES('90000000-0000-4000-8000-000000000001','Confirmed fixture',100,200,5,5,20,'manual');
DO $$ BEGIN
 IF has_schema_privilege(current_user,'fgi_private','usage') OR has_function_privilege(current_user,'public.fgi_ai_access(uuid,boolean)','execute') THEN RAISE EXCEPTION 'Browser controls entitlements'; END IF;
 BEGIN INSERT INTO fgi_private.ai_friend_grants(user_id,modules,reason) VALUES('90000000-0000-4000-8000-000000000001',ARRAY['training'],'forged');RAISE EXCEPTION 'Friend grant forged';EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000002',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.fgi_ai_food WHERE user_id='90000000-0000-4000-8000-000000000001') THEN RAISE EXCEPTION 'Foreign food log readable'; END IF;
 BEGIN INSERT INTO public.fgi_ai_food(user_id,name,calories_low,calories_high,protein_g,fat_g,carbs_g,source) VALUES('90000000-0000-4000-8000-000000000001','Forged',100,200,5,5,20,'manual');RAISE EXCEPTION 'Foreign food log writable';EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SET LOCAL ROLE service_role;
SELECT public.fgi_ai_delete('90000000-0000-4000-8000-000000000001');
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.fgi_ai_food WHERE user_id='90000000-0000-4000-8000-000000000001') THEN RAISE EXCEPTION 'Food data not deleted'; END IF;
 IF NOT EXISTS(SELECT 1 FROM fgi_private.ai_customers WHERE user_id='90000000-0000-4000-8000-000000000001') THEN RAISE EXCEPTION 'Data deletion removed billing ownership'; END IF;
END $$;
RESET ROLE;
ROLLBACK;
SELECT 'Paid access, mode isolation, webhook idempotency/order, risk separation, monthly reservations, owner RLS and deletion passed; all fixtures rolled back' AS verification;
