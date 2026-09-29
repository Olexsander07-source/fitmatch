alter table public.fgi_coaches
  add column if not exists stripe_account_id text,
  add column if not exists stripe_onboarding_complete boolean not null default false,
  add column if not exists stripe_transfers_enabled boolean not null default false;

create unique index if not exists fgi_coaches_stripe_account_id_uidx
  on public.fgi_coaches (stripe_account_id)
  where stripe_account_id is not null;

create table if not exists public.fgi_payments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references auth.users(id) on delete restrict,
  coach_id uuid not null references public.fgi_coaches(id) on delete restrict,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'eur' check (currency = 'eur'),
  platform_fee_cents integer not null check (platform_fee_cents >= 0 and platform_fee_cents <= amount_cents),
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  status text not null default 'pending' check (status in ('pending','paid','failed','expired','refunded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists fgi_payments_client_created_idx on public.fgi_payments (client_id, created_at desc);
create index if not exists fgi_payments_coach_created_idx on public.fgi_payments (coach_id, created_at desc);

alter table public.fgi_payments enable row level security;

revoke all on table public.fgi_payments from anon;
revoke insert, update, delete on table public.fgi_payments from authenticated;
grant select on table public.fgi_payments to authenticated;

drop policy if exists fgi_payments_participant_select on public.fgi_payments;
create policy fgi_payments_participant_select
on public.fgi_payments
for select
to authenticated
using ((select auth.uid()) = client_id or (select auth.uid()) = coach_id);
