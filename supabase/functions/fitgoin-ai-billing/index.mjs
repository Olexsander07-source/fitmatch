import {AIError,UUID} from '../../../fitgoin-ai-core.mjs';
import {PLANS} from '../../../fitgoin-ai-paid.mjs';

const id=value=>typeof value==='string'?value:value?.id;
const subOf=invoice=>id(invoice?.parent?.subscription_details?.subscription)||id(invoice?.subscription);
const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{...headers,'Content-Type':'application/json','Cache-Control':'no-store'}});
const modeKey=(key,live)=>new RegExp(`^(?:sk|rk)_${live?'live':'test'}_`).test(key||'');
const timestamp=value=>Number.isFinite(value)&&value>0?new Date(value*1000).toISOString():null;
const EVENTS=new Set(['checkout.session.completed','checkout.session.async_payment_succeeded','customer.subscription.created','customer.subscription.updated','customer.subscription.deleted','invoice.paid','invoice.payment_failed','invoice.payment_action_required','charge.refunded','charge.dispute.created','charge.dispute.updated','charge.dispute.closed','radar.early_fraud_warning.created']);

// Stripe resource IDs resolve ownership through a server-owned Customer mapping.
// User-editable metadata and the Checkout return page never grant an entitlement.
export async function resolveSubscriptions(stripe,event) {
  const object=event.data.object,type=event.type;
  if(type.startsWith('customer.subscription.'))return [object.id];
  if(type.startsWith('checkout.session.'))return id(object.subscription)?[id(object.subscription)]:[];
  if(type.startsWith('invoice.'))return subOf(object)?[subOf(object)]:[];
  if(!type.startsWith('charge.')&&!type.startsWith('radar.'))return [];
  const charge=type==='charge.refunded'?await stripe.charges.retrieve(object.id):await stripe.charges.retrieve(id(object.charge));
  if(id(charge.invoice)){
    const invoice=await stripe.invoices.retrieve(id(charge.invoice));return subOf(invoice)?[subOf(invoice)]:[];
  }
  const intent=id(charge.payment_intent)||id(object.payment_intent);
  if(!intent)return [];
  const payments=await stripe.invoicePayments.list({payment:{type:'payment_intent',payment_intent:intent},limit:100});
  if(payments.has_more)throw new AIError('billing_reconciliation_required',503);
  const subscriptions=[];
  for(const payment of payments.data){const invoice=await stripe.invoices.retrieve(id(payment.invoice));const sub=subOf(invoice);if(sub)subscriptions.push(sub);}
  return [...new Set(subscriptions)];
}

export function createBillingHandler({env,fetcher=fetch,stripeClient}={}) {
  const get=name=>typeof env==='function'?env(name):env?.[name];
  const url=(get('SUPABASE_URL')||'').replace(/\/$/,''),publicKey=get('SUPABASE_ANON_KEY'),secret=get('SUPABASE_SERVICE_ROLE_KEY');
  const live=get('AI_BILLING_MODE')!=='test',key=get('FGI_AI_STRIPE_KEY'),webhookSecret=get('FGI_AI_WEBHOOK_SECRET');
  const priceIds=Object.fromEntries(Object.keys(PLANS).map(plan=>[plan,get('FGI_AI_PRICE_'+plan.toUpperCase())]));
  const enabled=Boolean(get('FGI_AI_BILLING_ENABLED')==='true'&&key&&modeKey(key,live)&&webhookSecret&&Object.values(priceIds).every(v=>/^price_/.test(v||''))&&(!live||get('FGI_AI_COMMERCIAL_READY')==='true')&&get('OPENAI_API_KEY'));
  let client=stripeClient;
  async function stripe(){if(!client){const {default:StripeClient}=await import('npm:stripe@22.6.0');client=new StripeClient(key,{apiVersion:'2026-08-26.dahlia',httpClient:StripeClient.createFetchHttpClient(),maxNetworkRetries:2,timeout:15000});client.cryptoProvider=StripeClient.createSubtleCryptoProvider();}return client;}
  async function rpc(name,body){
    const response=await fetcher(url+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:secret,Authorization:'Bearer '+secret,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw new AIError('backend_unavailable',503);return response.json();
  }
  async function sync(stripe,event,subId) {
    const sub=await stripe.subscriptions.retrieve(subId,{expand:['latest_invoice','items.data.price']});
    if(sub.livemode!==live)throw new AIError('billing_mode_mismatch',422);
    const items=sub.items?.data||[],plan=items.length===1?Object.keys(priceIds).find(p=>priceIds[p]===id(items[0].price)):null;
    const customer=id(sub.customer),owner=await rpc('fgi_ai_customer_owner',{p_customer:customer,p_live:live});
    if(!owner?.user_id)return; // Another product's customer has no FitGoIn AI owner.
    let invoice=typeof sub.latest_invoice==='object'?sub.latest_invoice:null;
    if(!invoice&&id(sub.latest_invoice))invoice=await stripe.invoices.retrieve(id(sub.latest_invoice));
    const lines=invoice?.lines?.data||[];
    if(invoice?.lines?.has_more)throw new AIError('billing_reconciliation_required',503);
    const periods=lines.filter(line=>line.amount>=0&&(id(line.pricing?.price_details?.price)||id(line.price))===priceIds[plan]).map(line=>line.period?.end).filter(Number.isFinite);
    const paid=Boolean(plan&&invoice?.status==='paid'&&invoice.amount_remaining===0&&subOf(invoice)===sub.id&&id(invoice.customer)===customer);
    let risk=null;
    if(event.type==='charge.refunded'){
      const charge=await stripe.charges.retrieve(event.data.object.id);
      if(charge.refunded||charge.amount_refunded>=charge.amount)risk='refunded';
    }
    if(event.type.startsWith('charge.dispute.')){
      const dispute=await stripe.disputes.retrieve(event.data.object.id);risk=dispute.status==='won'?'resolved':'disputed';
    }
    if(event.type==='radar.early_fraud_warning.created')risk='fraud_review';
    await rpc('fgi_ai_billing_sync',{p_event:event.id+':'+sub.id,p_created:event.created,p_live:live,p_user:owner.user_id,p_customer:customer,p_subscription:sub.id,p_plan:plan,p_status:sub.status,p_paid_until:paid&&periods.length?timestamp(Math.max(...periods)):null,p_period_end:timestamp(items[0]?.current_period_end||sub.current_period_end),p_cancel:Boolean(sub.cancel_at_period_end),p_risk:risk,p_risk_id:risk?event.data.object.id:null});
  }
  return async request=>{
    const origin=request.headers.get('origin'),headers={'Vary':'Origin','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'authorization, apikey, content-type, stripe-signature, x-client-info'};
    if(origin&&!['https://fitgoin.com','https://www.fitgoin.com'].includes(origin))return json({error:'origin_not_allowed'},403,headers);
    if(origin)headers['Access-Control-Allow-Origin']=origin;
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
    if(request.method==='GET')return json({checkout_enabled:enabled,livemode:live},200,headers);
    if(request.method!=='POST')return json({error:'method_not_allowed'},405,headers);
    try {
      if(!url||!secret||!publicKey)throw new AIError('backend_unavailable',503);
      if(Number(request.headers.get('content-length'))>256000)throw new AIError('request_too_large',413);
      const raw=await request.text();if(raw.length>256000)throw new AIError('request_too_large',413);
      if(new URL(request.url).pathname.endsWith('/webhook')){
        if(!key||!modeKey(key,live)||!webhookSecret)throw new AIError('billing_not_configured',503);
        const signature=request.headers.get('stripe-signature');if(!signature)throw new AIError('invalid_signature',400);
        const s=await stripe();let event;
        try{event=await s.webhooks.constructEventAsync(raw,signature,webhookSecret,300,s.cryptoProvider);}catch{throw new AIError('invalid_signature',400);}
        if(event.livemode!==live||!EVENTS.has(event.type))return json({received:true},200,headers);
        for(const subId of await resolveSubscriptions(s,event))await sync(s,event,subId);
        return json({received:true},200,headers);
      }
      const token=request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];if(!token)throw new AIError('authentication_required',401);
      const auth=await fetcher(url+'/auth/v1/user',{headers:{apikey:publicKey,Authorization:'Bearer '+token},signal:AbortSignal.timeout(10000)});
      if(!auth.ok)throw new AIError('authentication_required',401);
      const user=await auth.json();if(!UUID.test(user.id||''))throw new AIError('authentication_required',401);
      let input;try{input=JSON.parse(raw);}catch{throw new AIError('invalid_request');}
      if(input.action==='access'){
        const access=await rpc('fgi_ai_access',{p_user:user.id,p_live:live});return json({...access,checkout_enabled:enabled,livemode:live},200,headers);
      }
      if(!['checkout','portal'].includes(input.action)||!UUID.test(input.request_id||''))throw new AIError('invalid_request');
      if(!key||!modeKey(key,live))throw new AIError('billing_not_configured',503);
      const existing=await rpc('fgi_ai_customer_get',{p_user:user.id,p_live:live}),s=await stripe();
      if(input.action==='portal'){
        if(!existing?.customer_id)throw new AIError('subscription_missing',404);
        const portal=await s.billingPortal.sessions.create({customer:existing.customer_id,return_url:'https://fitgoin.com/#ai'},{idempotencyKey:`fgi-ai-portal-${live}-${user.id}-${input.request_id}`});
        return json({url:portal.url},200,headers);
      }
      if(!enabled)throw new AIError('billing_not_configured',503);
      if(!Object.hasOwn(PLANS,input.plan))throw new AIError('invalid_plan',400);
      const price=await s.prices.retrieve(priceIds[input.plan]);
      if(!price.active||price.livemode!==live||price.currency!=='eur'||price.unit_amount!==PLANS[input.plan].amount||price.recurring?.interval!=='month'||price.recurring.interval_count!==1)throw new AIError('billing_price_mismatch',503);
      let customer=existing?.customer_id;
      if(!customer){const created=await s.customers.create({email:user.email},{idempotencyKey:`fgi-ai-customer-${live}-${user.id}`});const saved=await rpc('fgi_ai_customer_save',{p_user:user.id,p_live:live,p_customer:created.id});customer=saved.customer_id;}
      const subscriptions=await s.subscriptions.list({customer,status:'all',limit:100});
      if(subscriptions.has_more||subscriptions.data.some(sub=>!['canceled','incomplete_expired'].includes(sub.status)))throw new AIError('subscription_exists',409);
      const claim=await rpc('fgi_ai_checkout_claim',{p_user:user.id,p_live:live,p_id:input.request_id,p_plan:input.plan});
      if(claim?.error)throw new AIError(claim.error,409);
      if(claim?.url)return json({url:claim.url},200,headers);
      if(!UUID.test(claim?.request_id||''))throw new AIError('backend_unavailable',503);
      // Retries and concurrent tabs reuse a server-owned nonce and the same
      // exact parameters, including expiry, so they cannot open two checkouts.
      const suffix=claim.request_id.replace(/-/g,'').slice(0,8).split('').map(c=>String.fromCharCode(97+parseInt(c,16))).join('');
      const session=await s.checkout.sessions.create({mode:'subscription',customer,line_items:[{price:price.id,quantity:1}],success_url:'https://fitgoin.com/?ai_payment=return#ai',cancel_url:'https://fitgoin.com/#ai',expires_at:claim.expires,integration_identifier:'fitgoin_ai_'+suffix,consent_collection:{terms_of_service:'required'}},{idempotencyKey:`fgi-ai-checkout-${live}-${user.id}-${input.plan}-${claim.request_id}`});
      await rpc('fgi_ai_checkout_save',{p_user:user.id,p_live:live,p_id:claim.request_id,p_url:session.url});
      return json({url:session.url},200,headers);
    } catch(error){return json({error:error instanceof AIError?error.code:'billing_unavailable'},error instanceof AIError?error.status:503,headers);}
  };
}
if(typeof Deno!=='undefined'&&import.meta.main)Deno.serve(createBillingHandler({env:name=>Deno.env.get(name)}));
