import test from 'node:test';
import assert from 'node:assert/strict';
import {weeklyReview,adaptWorkout,CONSENT_VERSION} from '../fitgoin-ai-core.mjs';
import {PLANS,MEDIA_CONSENT,validateImages,validateMedia,normalizeFood,trainingCalendar} from '../fitgoin-ai-paid.mjs';
import {createAIHandler} from '../supabase/functions/fitgoin-ai/index.mjs';
import {createBillingHandler,resolveSubscriptions} from '../supabase/functions/fitgoin-ai-billing/index.mjs';

const USER='90000000-0000-4000-8000-000000000001',REQUEST='90000000-0000-4000-8000-000000000002',CONV='90000000-0000-4000-8000-000000000003';
const JPEG={mime:'image/jpeg',base64:btoa('\xff\xd8\xff'+'x'.repeat(120))};
const FOOD={title:'Примерная порция',uncertainty:'Размер порции и количество масла неизвестны.',items:[{name:'Рис',portion:'Около 150 г',calories_low:160,calories_high:250,protein_g:4,fat_g:1,carbs_g:40}],questions:['Уточни массу порции.'],warnings:['Проверь состав и аллергены.']};
const BE={SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_ANON_KEY:'public-fixture',SUPABASE_SERVICE_ROLE_KEY:'server-fixture',FGI_AI_STRIPE_KEY:'rk_test_fixture',FGI_AI_WEBHOOK_SECRET:'whsec_fixture',AI_BILLING_MODE:'test',FGI_AI_PRICE_TRAINING:'price_training',FGI_AI_PRICE_NUTRITION:'price_nutrition',FGI_AI_PRICE_BUNDLE:'price_bundle',FGI_AI_BILLING_ENABLED:'true',OPENAI_API_KEY:'provider-fixture'};
function billing(change={}){
 const calls=[],stripeCalls=[];
 const invoice={id:'in_fixture',customer:'cus_owner',status:'paid',amount_remaining:0,parent:{subscription_details:{subscription:'sub_owner'}},lines:{data:[{amount:2000,pricing:{price_details:{price:'price_training'}},period:{end:1900000000}}]}};
 const subscription={id:'sub_owner',livemode:false,customer:'cus_owner',status:'active',cancel_at_period_end:false,latest_invoice:invoice,items:{data:[{price:{id:'price_training'},current_period_end:1900000000}]}};
 const event=change.event||{id:'evt_fixture',created:1791111111,livemode:false,type:'invoice.paid',data:{object:invoice}};
 const stripe={
  cryptoProvider:{},webhooks:{constructEventAsync:async(raw,signature)=>{if(signature!=='valid')throw Error('invalid');return event;}},
  customers:{create:async()=>({id:'cus_new'})},
  subscriptions:{retrieve:async()=>change.subscription||subscription,list:async args=>{stripeCalls.push(['list',args]);return {data:change.subscriptions||[],has_more:false};}},
  prices:{retrieve:async id=>({id,active:true,livemode:false,currency:'eur',unit_amount:change.priceAmount??2000,recurring:{interval:'month',interval_count:1}})},
  checkout:{sessions:{create:async(args,opts)=>{stripeCalls.push(['checkout',args,opts]);return {url:'https://checkout.stripe.com/session'};}}},
  billingPortal:{sessions:{create:async args=>{stripeCalls.push(['portal',args]);return {url:'https://billing.stripe.com/session'};}}},
  invoices:{retrieve:async()=>invoice},charges:{retrieve:async()=>({id:'ch_fixture',invoice:'in_fixture',refunded:change.refunded??true,amount:2000,amount_refunded:2000})},
  disputes:{retrieve:async()=>({id:'dp_fixture',status:change.disputeStatus||'needs_response'})}
 };
 const fetcher=async(url,options)=>{
  const body=options.body?JSON.parse(options.body):null;calls.push({url,body});
  const json=(data,status=200)=>new Response(JSON.stringify(data),{status});
  if(url.endsWith('/auth/v1/user'))return json({id:USER,email:'test@example.invalid',user_metadata:{friend:true}},change.invalidAuth?401:200);
  if(url.endsWith('fgi_ai_customer_get'))return json({customer_id:'cus_owner'});
  if(url.endsWith('fgi_ai_checkout_claim'))return json(change.checkoutClaim||{request_id:REQUEST,expires:1900000000});
  if(url.endsWith('fgi_ai_customer_owner'))return json({user_id:USER});
  if(url.endsWith('fgi_ai_access'))return json({modules:change.modules||[],friend:false});
  if(url.endsWith('fgi_ai_billing_sync')&&change.failSync)return json({error:'retry'},503);
  return json(null);
 };
 const handler=createBillingHandler({env:{...BE,...change.env},fetcher,stripeClient:stripe});
 const request=(body,headers={})=>handler(new Request('https://fixture.supabase.co/functions/v1/fitgoin-ai-billing',{method:'POST',headers:{Authorization:'Bearer user-token',Origin:'https://fitgoin.com',...headers},body:JSON.stringify({request_id:REQUEST,...body})}));
 const webhook=(signature='valid')=>handler(new Request('https://fixture.supabase.co/functions/v1/fitgoin-ai-billing/webhook',{method:'POST',headers:{'stripe-signature':signature},body:'{"untrusted":"signed event fixture"}'}));
 return {handler,request,webhook,calls,stripeCalls};
}
test('Checkout cannot open before provider, webhook, live mode and commercial configuration are ready',async()=>{
 for(const env of [{OPENAI_API_KEY:''},{FGI_AI_WEBHOOK_SECRET:''},{AI_BILLING_MODE:'live'},{FGI_AI_BILLING_ENABLED:'false'}]){
  const s=billing({env});assert.equal((await s.request({action:'checkout',plan:'training'})).status,503);assert(!s.stripeCalls.some(c=>c[0]==='checkout'));
 }
});
test('Checkout uses the authenticated Customer and verified server Price, ignoring user and price overrides',async()=>{
 const s=billing();assert.equal((await s.request({action:'checkout',plan:'training',customer:'cus_attacker',user_id:'other',price:'price_free',amount:1})).status,200);
 const call=s.stripeCalls.find(c=>c[0]==='checkout');assert.equal(call[1].customer,'cus_owner');assert.deepEqual(call[1].line_items,[{price:'price_training',quantity:1}]);assert(!('payment_method_types' in call[1]));assert.match(call[1].integration_identifier,/[a-z]{8}$/);assert(call[2].idempotencyKey.includes(USER));
 const mismatch=billing({priceAmount:1});assert.equal((await mismatch.request({action:'checkout',plan:'training'})).status,503);assert(!mismatch.stripeCalls.some(c=>c[0]==='checkout'));
});
test('Existing subscriptions go to Customer Portal instead of creating a second charge',async()=>{
 const s=billing({subscriptions:[{status:'active'}]});assert.equal((await s.request({action:'checkout',plan:'training'})).status,409);
 assert.equal((await s.request({action:'portal',customer:'cus_attacker'})).status,200);assert.equal(s.stripeCalls.find(c=>c[0]==='portal')[1].customer,'cus_owner');
});
test('Webhook rejects bad signatures, separates live/test and uses resource ownership',async()=>{
 const bad=billing();assert.equal((await bad.webhook('forged')).status,400);assert.equal(bad.calls.length,0);
 const different=billing({event:{id:'evt_live',created:1,livemode:true,type:'invoice.paid',data:{object:{}}}});assert.equal((await different.webhook()).status,200);assert.equal(different.calls.length,0);
 const valid=billing();assert.equal((await valid.webhook()).status,200);const sync=valid.calls.find(c=>c.url.endsWith('fgi_ai_billing_sync')).body;assert.equal(sync.p_user,USER);assert.equal(sync.p_plan,'training');assert.equal(sync.p_paid_until,new Date(1900000000000).toISOString());
});
test('Payment failure does not grant a new paid period; DB errors leave webhooks retryable',async()=>{
 const unpaid=billing({subscription:{id:'sub_owner',livemode:false,customer:'cus_owner',status:'past_due',latest_invoice:{status:'open'},items:{data:[{price:{id:'price_training'},current_period_end:1900000000}]}}});assert.equal((await unpaid.webhook()).status,200);assert.equal(unpaid.calls.find(c=>c.url.endsWith('fgi_ai_billing_sync')).body.p_paid_until,null);
 const failed=billing({failSync:true});assert.equal((await failed.webhook()).status,503);
});
test('Full refunds and disputes record separate risk IDs; a won dispute resolves only that risk',async()=>{
 for(const [type,object,reason,extra] of [['charge.refunded',{id:'ch_fixture'},'refunded',{}],['charge.dispute.created',{id:'dp_fixture',charge:'ch_fixture'},'disputed',{}],['charge.dispute.closed',{id:'dp_fixture',charge:'ch_fixture'},'resolved',{disputeStatus:'won'}]]){
  const s=billing({...extra,event:{id:'evt_risk',created:10,livemode:false,type,data:{object}}});assert.equal((await s.webhook()).status,200);const sync=s.calls.find(c=>c.url.endsWith('fgi_ai_billing_sync')).body;assert.equal(sync.p_risk,reason);assert.equal(sync.p_risk_id,object.id);
 }
});
test('New Stripe charge graph resolves PaymentIntent → Invoice Payment → Invoice → Subscription without metadata',async()=>{
 const calls=[],stripe={charges:{retrieve:async()=>({payment_intent:'pi_fixture',metadata:{user_id:'attacker'}})},invoicePayments:{list:async args=>{calls.push(args);return {data:[{invoice:'in_fixture'}]};}},invoices:{retrieve:async()=>({parent:{subscription_details:{subscription:'sub_owner'}}})}};
 assert.deepEqual(await resolveSubscriptions(stripe,{type:'charge.dispute.created',data:{object:{charge:'ch_fixture'}}}),['sub_owner']);assert.equal(calls[0].payment.payment_intent,'pi_fixture');
});
test('Media requires fresh consent, bounded actual JPEG bytes and internally consistent estimates',()=>{
 assert.equal(validateImages([JPEG],'food_photo',MEDIA_CONSENT).length,1);assert.throws(()=>validateImages([JPEG],'food_photo','old'));assert.throws(()=>validateImages([{mime:'image/jpeg',base64:btoa('not an image'.repeat(30))}],'technique',MEDIA_CONSENT));
 assert.equal(validateMedia('food_photo',FOOD).total.calories_low,160);assert.throws(()=>validateMedia('food_photo',{...FOOD,user_id:'attacker'}));assert.throws(()=>validateMedia('food_photo',{...FOOD,items:[{...FOOD.items[0],calories_high:50}]}));
 assert.throws(()=>normalizeFood({name:'Empty'}));assert.throws(()=>normalizeFood({name:'Empty',calories_low:null,calories_high:null,protein_g:0,fat_g:0,carbs_g:0}));
});
test('Calendar avoids an already-passed occurrence and retains local time and weekly recurrence',()=>{
 const now=new Date(2026,9,5,19,0),ics=trainingCalendar({weekdays:[1],minutes:30},'18:00',now);assert(ics.includes('DTSTART:20261012T180000'));assert(ics.includes('RRULE:FREQ=WEEKLY;BYDAY=MO'));assert(ics.includes('TRIGGER:-PT15M'));
});
test('Adaptation includes muscular fatigue, preserves safe rest, and never claims an unseen completed session',()=>{
 const workout={minutes:30,exercises:[{sets:3,minutes:5,rest_seconds:120}]};const adapted=adaptWorkout(workout,12,{sleep:8,energy:4,soreness:5});assert(adapted.exercises.every(e=>e.sets<3&&e.minutes*60>=e.sets*20+(e.sets-1)*e.rest_seconds));assert.throws(()=>adaptWorkout(workout,30,{pain:true}));
 const now=Date.now(),report=weeklyReview([{completed_at:new Date(now-1000).toISOString(),data:{status:'stopped',stopped_for_pain:true,sets:[]}}],{days_per_week:3},now);assert.equal(report.completed,0);assert.equal(report.average_rpe,null);assert(report.stopped_for_pain);
});
test('Unpaid and wrong-module requests cannot spend OpenAI tokens or use editable friend metadata',async()=>{
 const calls=[],handler=createAIHandler({env:{...BE,SUPABASE_URL:'https://fixture.supabase.co'},fetcher:async(url,options)=>{calls.push(url);if(url.endsWith('/auth/v1/user'))return new Response(JSON.stringify({id:USER,user_metadata:{friend:true}}));if(url.endsWith('/rpc/fgi_ai_access'))return new Response(JSON.stringify({modules:['training']}));throw Error('Unexpected call');}});
 const request=new Request('https://fixture/functions/v1/fitgoin-ai',{method:'POST',headers:{Authorization:'Bearer user'},body:JSON.stringify({action:'food_photo',request_id:REQUEST,conversation_id:CONV,message:'food',images:[JPEG],media_consent:MEDIA_CONSENT,friend:true})});
 assert.equal((await handler(request)).status,402);assert(!calls.some(x=>x.includes('api.openai.com')||x.includes('fgi_ai_claim')));
});
test('Configured prices preserve the agreed three monthly plans',()=>{assert.deepEqual(Object.values(PLANS).map(x=>x.amount),[2000,1000,3000]);});

test('Concurrent checkout requests reuse the server-owned pending session and cannot change its plan',async()=>{
 const existing=billing({checkoutClaim:{url:'https://checkout.stripe.com/already-created'}});assert.equal((await existing.request({action:'checkout',plan:'training',request_id:'90000000-0000-4000-8000-000000000099'})).status,200);assert(!existing.stripeCalls.some(c=>c[0]==='checkout'));
 const pending=billing({checkoutClaim:{error:'checkout_pending'}});assert.equal((await pending.request({action:'checkout',plan:'training'})).status,409);assert(!pending.stripeCalls.some(c=>c[0]==='checkout'));
});
