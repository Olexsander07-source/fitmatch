-- FitGoIn: server-only translations for explicitly published coach profile fields.
-- No client-supplied free-form text may be translated by this endpoint.
create table if not exists public.fgi_public_profile_translations (
  coach_id uuid not null references public.fgi_coaches(id) on delete cascade,
  field_name text not null check (field_name in ('goal','bio','education','titles','achievements')),
  target_language text not null check (target_language in ('fr','en','ru')),
  source_sha256 text not null check (source_sha256 ~ '^[0-9a-f]{64}$'),
  translated_text text not null check (char_length(translated_text) between 1 and 9000),
  updated_at timestamptz not null default now(),
  primary key (coach_id,field_name,target_language)
);
alter table public.fgi_public_profile_translations enable row level security;
revoke all on public.fgi_public_profile_translations from public,anon,authenticated;
grant select,insert,update,delete on public.fgi_public_profile_translations to service_role;

create table if not exists public.fgi_public_translation_daily_limit (
  day date primary key,
  used_count integer not null default 0 check (used_count between 0 and 300)
);
alter table public.fgi_public_translation_daily_limit enable row level security;
revoke all on public.fgi_public_translation_daily_limit from public,anon,authenticated;
grant select,insert,update on public.fgi_public_translation_daily_limit to service_role;

create or replace function public.fgi_claim_public_translation_budget(p_count integer)
returns boolean
language plpgsql security definer set search_path = pg_catalog,public
as $$
declare approved integer;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'permission_denied' using errcode='42501';
  end if;
  if p_count is null or p_count < 1 or p_count > 15 then
    return false;
  end if;
  insert into public.fgi_public_translation_daily_limit(day,used_count)
  values ((now() at time zone 'utc')::date,p_count)
  on conflict(day) do update
    set used_count=public.fgi_public_translation_daily_limit.used_count+excluded.used_count
  where public.fgi_public_translation_daily_limit.used_count+excluded.used_count<=300
  returning used_count into approved;
  return approved is not null;
end;
$$;
revoke all on function public.fgi_claim_public_translation_budget(integer) from public,anon,authenticated;
grant execute on function public.fgi_claim_public_translation_budget(integer) to service_role;
