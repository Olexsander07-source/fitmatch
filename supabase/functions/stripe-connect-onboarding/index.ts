import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const SITE_URL = 'https://fitgoin.com';
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

function countryCode(value: string | null | undefined) {
  const v = String(value || '').trim();
  if (/^[A-Za-z]{2}$/.test(v)) return v.toUpperCase();
  const n = v.toLowerCase();
  if (['france', 'français', 'francaise', 'française', 'франция'].includes(n)) return 'FR';
  return '';
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

  try {
    const stripeApiKey = Deno.env.get('STRIPE_API_KEY') || '';
    if (!stripeApiKey) return json(req, { error: 'Stripe key is not configured yet.' }, 503);

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const publishableKey = envKey('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY');
    const secretKey = envKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY');
    const auth = req.headers.get('authorization') || '';
    if (!auth || !publishableKey || !secretKey) return json(req, { error: 'Unauthorized' }, 401);

    const userDb = createClient(supabaseUrl, publishableKey, { global: { headers: { Authorization: auth } } });
    const adminDb = createClient(supabaseUrl, secretKey, { auth: { persistSession: false } });
    const { data: userData, error: userError } = await userDb.auth.getUser();
    if (userError || !userData.user) return json(req, { error: 'Unauthorized' }, 401);

    const user = userData.user;
    const { data: coach, error: coachError } = await adminDb
      .from('fgi_coaches')
      .select('id,name,country,stripe_account_id')
      .eq('id', user.id)
      .maybeSingle();
    if (coachError) throw coachError;
    if (!coach) return json(req, { error: 'Сначала создай профиль тренера.' }, 403);

    let accountId = coach.stripe_account_id as string | null;
    if (!accountId) {
      const form = new URLSearchParams();
      form.set('controller[stripe_dashboard][type]', 'express');
      form.set('controller[fees][payer]', 'application');
      form.set('controller[losses][payments]', 'application');
      form.set('capabilities[transfers][requested]', 'true');
      form.set('metadata[fitgoin_coach_id]', user.id);
      if (coach.name) form.set('business_profile[name]', String(coach.name).slice(0, 100));
      const country = countryCode(coach.country);
      if (country) form.set('country', country);

      const account = await stripeRequest(stripeApiKey, 'accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form,
      });
      accountId = account.id;
      const { error: saveError } = await adminDb.from('fgi_coaches').update({ stripe_account_id: accountId }).eq('id', user.id);
      if (saveError) throw saveError;
    }

    const account = await stripeRequest(stripeApiKey, `accounts/${encodeURIComponent(accountId)}`, { method: 'GET' });
    const onboardingComplete = account.details_submitted === true;
    const transfersEnabled = account.capabilities?.transfers === 'active';
    const { error: statusError } = await adminDb.from('fgi_coaches').update({
      stripe_onboarding_complete: onboardingComplete,
      stripe_transfers_enabled: transfersEnabled,
    }).eq('id', user.id);
    if (statusError) throw statusError;

    const linkForm = new URLSearchParams();
    linkForm.set('account', accountId);
    linkForm.set('refresh_url', `${SITE_URL}/?stripe=refresh#account`);
    linkForm.set('return_url', `${SITE_URL}/?stripe=return#account`);
    linkForm.set('type', 'account_onboarding');
    linkForm.set('collection_options[fields]', 'eventually_due');

    const link = await stripeRequest(stripeApiKey, 'account_links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: linkForm,
    });

    return json(req, { url: link.url, onboarding_complete: onboardingComplete, transfers_enabled: transfersEnabled });
  } catch (error) {
    console.error('stripe-connect-onboarding', error);
    return json(req, { error: error instanceof Error ? error.message : 'Stripe onboarding failed.' }, 500);
  }
});
