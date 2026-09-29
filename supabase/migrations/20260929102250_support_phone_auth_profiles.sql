create or replace function fgi_private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles(id, full_name, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name',''),
    new.phone,
    'client'
  )
  on conflict(id) do update set
    full_name = coalesce(nullif(public.profiles.full_name,''), excluded.full_name),
    phone = coalesce(public.profiles.phone, excluded.phone),
    updated_at = now()
  where nullif(public.profiles.full_name,'') is null
     or public.profiles.phone is null;
  return new;
end
$$;

revoke all on function fgi_private.handle_new_user() from public, anon, authenticated;

update public.profiles p
set phone = u.phone,
    updated_at = now()
from auth.users u
where p.id = u.id
  and p.phone is null
  and u.phone is not null;
