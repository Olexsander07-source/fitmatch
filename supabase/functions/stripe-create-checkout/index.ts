import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const SITE_URL = 'https://fitgoin.com';
const PLATFORM_FEE_RATE = 0.05;
const allowedOrigins = new Set([SITE_URL, 'https://www.fitgoin.com']);

function cors(req: Request) {
  const origin = req.headers.get('origin') || SITE_URL;
  return {
    'Access-Control-Allow-Origin': allowedOrigins.has(origin) ? origin : SITE_URL,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(req), 'Content-Type': 'application/json' } });
}

function envKey(name: string, legacy?: string) {
  const raw = Deno.env.get(name);
  if (raw) {
    try { return JSON.parse(raw).default as string; } catch { return raw; }
  }
  return legacy ? Deno.env.get(legacy) || '' : '';
}

async function stripeRequest(apiKey: string, path: string, init: RequestInit = {}) {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${apiKey}`, ...(init.headers || {}) },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || `Stripe error ${response.status}`);
  return data;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== 'POST') return json(req, { error: 'Method not allowed' }, 405);

  let paymentId = '';
  let adminDb: ReturnType<typeof createClient> | null = null;
  try {
    const stripeApiKey = Deno.env.get('STRIPE_API_KEY') || '';
    if (!stripeApiKey) return json(req, { error: 'Stripe key is not configured yet.' }, 503);

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const publishableKey = envKey('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY');
    const secretKey = envKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY');
    const auth = req.headers.get('authorization') || '';
    if (!auth || !publishableKey || !secretKey) return json(req, { error: 'Unauthorized' }, 401);

    const userDb = createClient(supabaseUrl, publishableKey, { global: { headers: { Authorization: auth } } });
    adminDb = createClient(supabaseUrl, secretKey, { auth: { persistSession: false } });
    const { data: userData, error: userError } = await userDb.auth.getUser();
    if (userError || !userData.user) return json(req, { error: 'Unauthorized' }, 401);
    const user = userData.user;

    const body = await req.json().catch(() => ({}));
    const coachId = String(body?.coach_id || '');
    if (!/^[0-9a-f-]{36}$/i.test(coachId)) return json(req, { error: 'Invalid coach.' }, 400);
    if (coachId === user.id) return json(req, { error: 'Нельзя оплачивать собственный профиль.' }, 400);

    const { data: coach, error: coachError } = await adminDb
      .from('fgi_coaches')
      .select('id,name,price,period,published,stripe_account_id,stripe_onboarding_complete,stripe_transfers_enabled')
      .eq('id', coachId)
      .maybeSingle();
    if (coachError) throw coachError;
    if (!coach || coach.published === false) return json(req, { error: 'Профиль тренера недоступен.' }, 404);
    if (!coach.stripe_account_id) return json(req, { error: 'Тренер ещё не подключил выплаты Stripe.' }, 409);

    const amountCents = Math.round(Number(coach.price) * 100);
    if (!Number.isFinite(amountCents) || amountCents < 50) return json(req, { error: 'Для оплаты картой цена должна быть не меньше 0,50 €.' }, 400);
    const platformFeeCents = Math.round(amountCents * PLATFORM_FEE_RATE);

    const account = await stripeRequest(stripeApiKey, `accounts/${encodeURIComponent(coach.stripe_account_id)}`, { method: 'GET' });
    const onboardingComplete = account.details_submitted === true;
    const transfersEnabled = account.capabilities?.transfers === 'active';
    await adminDb.from('fgi_coaches').update({
      stripe_onboarding_complete: onboardingComplete,
      stripe_transfers_enabled: transfersEnabled,
    }).eq('id', coachId);
    if (!onboardingComplete || !transfersEnabled) return json(req, { error: 'Тренеру нужно завершить настройку Stripe перед приёмом оплаты.' }, 409);

    const { data: payment, error: paymentError } = await adminDb.from('fgi_payments').insert({
      client_id: user.id,
      coach_id: coachId,
      amount_cents: amountCents,
      currency: 'eur',
      platform_fee_cents: platformFeeCents,
      status: 'pending',
    }).select('id').single();
    if (paymentError) throw paymentError;
    paymentId = payment.id;

    const form = new URLSearchParams();
    form.set('mode', 'payment');
    form.set('success_url', `${SITE_URL}/?payment=success#account`);
    form.set('cancel_url', `${SITE_URL}/?payment=cancel&coach=${encodeURIComponent(coachId)}`);
    form.set('client_reference_id', paymentId);
    form.set('payment_method_types[0]', 'card');
    form.set('line_items[0][price_data][currency]', 'eur');
    form.set('line_items[0][price_data][unit_amount]', String(amountCents));
    form.set('line_items[0][price_data][product_data][name]', `Тренировка с ${String(coach.name || 'тренером').slice(0, 80)}`);
    form.set('line_items[0][price_data][product_data][description]', `FitGoIn · ${String(coach.period || 'занятие').slice(0, 80)}`);
    form.set('line_items[0][quantity]', '1');
    form.set('payment_intent_data[application_fee_amount]', String(platformFeeCents));
    form.set('payment_intent_data[transfer_data][destination]', String(coach.stripe_account_id));
    form.set('metadata[fitgoin_payment_id]', paymentId);
    form.set('metadata[fitgoin_client_id]', user.id);
    form.set('metadata[fitgoin_coach_id]', coachId);
    form.set('payment_intent_data[metadata][fitgoin_payment_id]', paymentId);
    form.set('payment_intent_data[metadata][fitgoin_client_id]', user.id);
    form.set('payment_intent_data[metadata][fitgoin_coach_id]', coachId);
    if (user.email) form.set('customer_email', user.email);

    const session = await stripeRequest(stripeApiKey, 'checkout/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
    });

    const { error: updateError } = await adminDb.from('fgi_payments').update({
      stripe_checkout_session_id: session.id,
      updated_at: new Date().toISOString(),
    }).eq('id', paymentId);
    if (updateError) throw updateError;

    return json(req, { url: session.url, payment_id: paymentId });
  } catch (error) {
    console.error('stripe-create-checkout', error);
    if (paymentId && adminDb) {
      await adminDb.from('fgi_payments').update({ status: 'failed', updated_at: new Date().toISOString() }).eq('id', paymentId);
    }
    return json(req, { error: error instanceof Error ? error.message : 'Checkout failed.' }, 500);
  }
});
