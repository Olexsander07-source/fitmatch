-- Additive premium onboarding state. Existing profiles/messages/payments are untouched.
set lock_timeout = '5s';
set statement_timeout = '30s';

create table public.fgi_user_workspace (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint fgi_workspace_object check (jsonb_typeof(data) = 'object'),
  constraint fgi_workspace_size check (octet_length(data::text) <= 24576)
);
alter table public.fgi_user_workspace enable row level security;
revoke all on public.fgi_user_workspace from public, anon, authenticated;
grant select, insert, update, delete on public.fgi_user_workspace to authenticated;
grant all on public.fgi_user_workspace to service_role;
create policy fgi_workspace_read on public.fgi_user_workspace for select to authenticated
using (user_id = (select auth.uid()));
create policy fgi_workspace_insert on public.fgi_user_workspace for insert to authenticated
with check (user_id = (select auth.uid()));
create policy fgi_workspace_update on public.fgi_user_workspace for update to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy fgi_workspace_delete on public.fgi_user_workspace for delete to authenticated
using (user_id = (select auth.uid()));
create trigger fgi_workspace_updated before update on public.fgi_user_workspace
for each row execute function fgi_private.update_updated_at();
comment on table public.fgi_user_workspace is 'Owner-only UI drafts, onboarding and bookmarks; never role or paid-access authority.';

-- A client may choose to become a trainer, just as they can already create their
-- own fgi_coaches row. No arbitrary user ID or target role is accepted.
create function fgi_private.start_trainer_onboarding()
returns text language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); stored_role text;
begin
  if actor is null or coalesce(auth.role(),'') <> 'authenticated' then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  select role into stored_role from public.profiles where id=actor and is_active for update;
  if not found then raise exception 'active_profile_required' using errcode = '42501'; end if;
  if stored_role = 'client' then
    update public.profiles set role='coach', updated_at=now() where id=actor and role='client' and is_active;
    stored_role := 'coach';
  elsif stored_role not in ('coach','admin') then
    raise exception 'role_not_supported' using errcode = '42501';
  end if;
  return stored_role;
end;
$$;
revoke all on function fgi_private.start_trainer_onboarding() from public, anon, authenticated;
grant usage on schema fgi_private to authenticated;
grant execute on function fgi_private.start_trainer_onboarding() to authenticated;
create function public.fgi_start_trainer_onboarding()
returns text language sql security invoker set search_path = '' as $$
  select fgi_private.start_trainer_onboarding();
$$;
revoke all on function public.fgi_start_trainer_onboarding() from public, anon, authenticated;
grant execute on function public.fgi_start_trainer_onboarding() to authenticated;
comment on function public.fgi_start_trainer_onboarding() is 'Authenticated, active users may start their own trainer onboarding. Does not grant admin or subscription access.';
