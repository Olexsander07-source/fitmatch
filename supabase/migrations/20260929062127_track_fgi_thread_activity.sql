alter table public.fgi_threads
  add column if not exists updated_at timestamptz;

update public.fgi_threads t
set updated_at = greatest(
  t.created_at,
  coalesce((select max(m.created_at) from public.fgi_messages m where m.thread_id = t.id), t.created_at)
)
where t.updated_at is null;

alter table public.fgi_threads
  alter column updated_at set default now(),
  alter column updated_at set not null;

create index if not exists fgi_threads_updated_at_idx
  on public.fgi_threads(updated_at desc);

create or replace function fgi_private.touch_fgi_thread_last_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.fgi_threads
  set updated_at = greatest(updated_at, new.created_at)
  where id = new.thread_id;
  return new;
end
$$;

revoke all on function fgi_private.touch_fgi_thread_last_message() from public, anon, authenticated;

drop trigger if exists fgi_messages_touch_thread on public.fgi_messages;
create trigger fgi_messages_touch_thread
after insert on public.fgi_messages
for each row execute function fgi_private.touch_fgi_thread_last_message();