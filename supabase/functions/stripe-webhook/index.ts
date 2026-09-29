import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

function envKey(name: string, legacy?: string) {
  const raw = Deno.env.get(name);
  if (raw) {
    try { return JSON.parse(raw).default as string; } catch { return raw; }
  }
  return legacy ? Deno.env.get(legacy) || '' : '';
}

function hex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifyStripeSignature(payload: string, signatureHeader: string, secret: string) {
  const parts = signatureHeader.split(',').map((part) => part.trim());
  const timestamp = parts.find((part) => part.startsWith('t='))?.slice(2) || '';
  const signatures = parts.filter((part) => part.startsWith('v1=')).map((part) => part.slice(3));
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Math.floor(Date.now() / 1000) - ts) > 300 || !signatures.length) return false;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${payload}`));
  const expected = hex(digest);
  return signatures.some((candidate) => safeEqual(candidate, expected));
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') || '';
  const signature = req.headers.get('stripe-signature') || '';
  if (!webhookSecret || !signature) return new Response('Webhook is not configured', { status: 503 });

  const raw = await req.text();
  if (!(await verifyStripeSignature(raw, signature, webhookSecret))) {
    return new Response('Invalid signature', { status: 400 });
  }

  let event: any;
  try { event = JSON.parse(raw); }
  catch { return new Response('Invalid JSON', { status: 400 }); }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const secretKey = envKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !secretKey) return new Response('Server configuration error', { status: 500 });
  const adminDb = createClient(supabaseUrl, secretKey, { auth: { persistSession: false } });
  const object = event?.data?.object || {};
  const now = new Date().toISOString();

  try {
    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      const paymentId = String(object.metadata?.fitgoin_payment_id || object.client_reference_id || '');
      if (paymentId) {
        const intent = typeof object.payment_intent === 'string' ? object.payment_intent : object.payment_intent?.id || null;
        const { error } = await adminDb.from('fgi_payments').update({
          status: 'paid',
          stripe_payment_intent_id: intent,
          updated_at: now,
        }).eq('id', paymentId);
        if (error) throw error;
      }
    } else if (event.type === 'checkout.session.expired') {
      const paymentId = String(object.metadata?.fitgoin_payment_id || object.client_reference_id || '');
      if (paymentId) {
        const { error } = await adminDb.from('fgi_payments').update({ status: 'expired', updated_at: now }).eq('id', paymentId).eq('status', 'pending');
        if (error) throw error;
      }
    } else if (event.type === 'checkout.session.async_payment_failed' || event.type === 'payment_intent.payment_failed') {
      const paymentId = String(object.metadata?.fitgoin_payment_id || '');
      if (paymentId) {
        const { error } = await adminDb.from('fgi_payments').update({ status: 'failed', updated_at: now }).eq('id', paymentId);
        if (error) throw error;
      }
    } else if (event.type === 'payment_intent.succeeded') {
      const paymentId = String(object.metadata?.fitgoin_payment_id || '');
      if (paymentId) {
        const { error } = await adminDb.from('fgi_payments').update({
          status: 'paid',
          stripe_payment_intent_id: object.id || null,
          updated_at: now,
        }).eq('id', paymentId);
        if (error) throw error;
      }
    } else if (event.type === 'charge.refunded' && Number(object.amount_refunded || 0) >= Number(object.amount || 1)) {
      const intent = typeof object.payment_intent === 'string' ? object.payment_intent : object.payment_intent?.id || '';
      if (intent) {
        const { error } = await adminDb.from('fgi_payments').update({ status: 'refunded', updated_at: now }).eq('stripe_payment_intent_id', intent);
        if (error) throw error;
      }
    } else if (event.type === 'account.updated') {
      const accountId = String(object.id || '');
      if (accountId) {
        const { error } = await adminDb.from('fgi_coaches').update({
          stripe_onboarding_complete: object.details_submitted === true,
          stripe_transfers_enabled: object.capabilities?.transfers === 'active',
        }).eq('stripe_account_id', accountId);
        if (error) throw error;
      }
    }

    return new Response(JSON.stringify({ received: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('stripe-webhook', event?.type, error);
    return new Response('Webhook processing failed', { status: 500 });
  }
});
