create table if not exists public.fgi_presence (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  online boolean not null default false,
  last_seen_at timestamptz not null default now()
);

alter table public.fgi_presence enable row level security;

revoke all on public.fgi_presence from anon, authenticated;
grant select(user_id, online, last_seen_at) on public.fgi_presence to authenticated;
grant insert(user_id, online) on public.fgi_presence to authenticated;
grant update(online) on public.fgi_presence to authenticated;

drop policy if exists fgi_presence_select_participants on public.fgi_presence;
create policy fgi_presence_select_participants
on public.fgi_presence
for select to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1
    from public.fgi_threads t
    where
      (t.client_id = (select auth.uid()) and t.coach_id = fgi_presence.user_id)
      or
      (t.coach_id = (select auth.uid()) and t.client_id = fgi_presence.user_id)
  )
);

drop policy if exists fgi_presence_insert_own on public.fgi_presence;
create policy fgi_presence_insert_own
on public.fgi_presence
for insert to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists fgi_presence_update_own on public.fgi_presence;
create policy fgi_presence_update_own
on public.fgi_presence
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create or replace function fgi_private.stamp_fgi_presence()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.last_seen_at = now();
  return new;
end
$$;

revoke all on function fgi_private.stamp_fgi_presence() from public, anon, authenticated;

drop trigger if exists fgi_presence_stamp on public.fgi_presence;
create trigger fgi_presence_stamp
before insert or update on public.fgi_presence
for each row execute function fgi_private.stamp_fgi_presence();

notify pgrst, 'reload schema';