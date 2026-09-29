alter table public.fgi_coaches drop constraint if exists fgi_coaches_price_check;
alter table public.fgi_coaches add constraint fgi_coaches_price_check check (price is null or (price >= 0 and price <= 100));

revoke insert(image_url), update(image_url) on public.fgi_coaches from authenticated;

create or replace function fgi_private.set_fgi_thread_client_name()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare display_name text;
begin
  select coalesce(nullif(trim(p.full_name), ''), 'Клиент')
    into display_name
    from public.profiles p
   where p.id = new.client_id;
  new.client_name := coalesce(display_name, 'Клиент');
  return new;
end $$;
revoke all on function fgi_private.set_fgi_thread_client_name() from public, anon, authenticated;

drop trigger if exists fgi_threads_set_client_name on public.fgi_threads;
create trigger fgi_threads_set_client_name
before insert or update of client_id, client_name on public.fgi_threads
for each row execute function fgi_private.set_fgi_thread_client_name();

update public.fgi_threads t
   set client_name = coalesce(nullif(trim(p.full_name), ''), 'Клиент')
  from public.profiles p
 where p.id = t.client_id
   and t.client_name is distinct from coalesce(nullif(trim(p.full_name), ''), 'Клиент');

drop policy if exists reviews_insert_own on public.reviews;
create policy reviews_insert_own on public.reviews
for insert to authenticated
with check (
  client_id = (select auth.uid())
  and coach_id <> (select auth.uid())
  and exists (
    select 1 from public.fgi_coaches c
    where c.id = reviews.coach_id and c.published
  )
  and exists (
    select 1 from public.bookings b
    where b.coach_id = reviews.coach_id
      and b.client_id = (select auth.uid())
      and b.status = 'completed'
  )
);

notify pgrst, 'reload schema';
