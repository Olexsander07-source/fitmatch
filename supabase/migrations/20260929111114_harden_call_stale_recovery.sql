create or replace function fgi_private.expire_stale_fgi_calls()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.fgi_calls
     set status = case when status='ringing' then 'missed' else 'ended' end,
         ended_at = coalesce(ended_at,now()),
         updated_at = now()
   where thread_id=new.thread_id
     and (
       (status='ringing' and created_at < now() - interval '90 seconds')
       or
       (status='accepted' and updated_at < now() - interval '90 seconds')
     );
  return new;
end
$$;

revoke all on function fgi_private.expire_stale_fgi_calls() from public,anon,authenticated;

notify pgrst,'reload schema';
