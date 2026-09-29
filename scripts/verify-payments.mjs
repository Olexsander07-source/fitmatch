import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [payments, migration, onboarding, checkout, webhook, config] = await Promise.all([
  read('payments.js'),
  read('supabase/migrations/20260929142200_add_stripe_card_payments.sql'),
  read('supabase/functions/stripe-connect-onboarding/index.ts'),
  read('supabase/functions/stripe-create-checkout/index.ts'),
  read('supabase/functions/stripe-webhook/index.ts'),
  read('supabase/config.toml'),
]);

const all = [payments, onboarding, checkout, webhook].join('\n');
if (/\b(?:sk|rk)_(?:test|live)_[A-Za-z0-9]/.test(all) || /\bwhsec_[A-Za-z0-9]/.test(all)) throw new Error('Stripe secret material must never be committed');
if (!payments.includes("invokePaymentFunction('stripe-connect-onboarding')")) throw new Error('Stripe onboarding frontend flow is missing');
if (!payments.includes("invokePaymentFunction('stripe-create-checkout'")) throw new Error('Stripe Checkout frontend flow is missing');
if (!checkout.includes('const PLATFORM_FEE_RATE = 0.05')) throw new Error('FitGoIn 5% platform fee is missing');
if (!checkout.includes(".select('id,name,price,period,published,stripe_account_id")) throw new Error('Checkout price must be loaded server-side');
if (!checkout.includes("payment_intent_data[application_fee_amount]")) throw new Error('Stripe application fee is missing');
if (!checkout.includes("payment_intent_data[transfer_data][destination]")) throw new Error('Stripe destination transfer is missing');
if (!onboarding.includes("Deno.env.get('STRIPE_API_KEY')")) throw new Error('Stripe API key must come from Edge Function secrets');
if (!webhook.includes("Deno.env.get('STRIPE_WEBHOOK_SECRET')")) throw new Error('Stripe webhook secret must come from Edge Function secrets');
if (!webhook.includes('verifyStripeSignature')) throw new Error('Stripe webhook signature verification is missing');
if (!config.includes('[functions.stripe-webhook]') || !config.includes('verify_jwt = false')) throw new Error('Stripe webhook must be public at the Supabase gateway and verify Stripe signatures itself');
if (!migration.includes('alter table public.fgi_payments enable row level security')) throw new Error('Payment RLS is missing');
if (!migration.includes('revoke insert, update, delete on table public.fgi_payments from authenticated')) throw new Error('Clients must not write payment state directly');
const md5=createHash('md5').update(migration).digest('hex');
if(md5!=='9184fe28cc9f83228ce4c03508ad248e')throw new Error(`Payment migration differs from applied production migration: ${md5}`);

console.log('FitGoIn payment source verification passed.');
