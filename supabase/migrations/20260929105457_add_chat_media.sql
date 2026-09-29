alter table public.fgi_messages
  add column if not exists kind text not null default 'text',
  add column if not exists media_path text,
  add column if not exists media_mime text,
  add column if not exists media_size bigint,
  add column if not exists duration_ms integer;

alter table public.fgi_messages drop constraint if exists fgi_messages_body_check;
alter table public.fgi_messages drop constraint if exists fgi_messages_kind_check;
alter table public.fgi_messages drop constraint if exists fgi_messages_media_check;
alter table public.fgi_messages drop constraint if exists fgi_messages_media_path_check;

alter table public.fgi_messages
  add constraint fgi_messages_kind_check
    check (kind in ('text','image','video','audio')),
  add constraint fgi_messages_body_check
    check (
      length(trim(body)) <= 4000
      and (kind <> 'text' or length(trim(body)) >= 1)
    ),
  add constraint fgi_messages_media_path_check
    check (
      media_path is null
      or media_path like sender_id::text || '/' || thread_id::text || '/%'
    ),
  add constraint fgi_messages_media_check
    check (
      (
        kind = 'text'
        and media_path is null
        and media_mime is null
        and media_size is null
        and duration_ms is null
      )
      or
      (
        kind = 'image'
        and media_path is not null
        and media_mime in ('image/jpeg','image/png','image/webp')
        and media_size between 1 and 12582912
        and duration_ms is null
      )
      or
      (
        kind = 'video'
        and media_path is not null
        and media_mime in ('video/mp4','video/webm','video/quicktime')
        and media_size between 1 and 52428800
        and (duration_ms is null or duration_ms between 1 and 3600000)
      )
      or
      (
        kind = 'audio'
        and media_path is not null
        and media_mime in ('audio/webm','audio/mp4','audio/ogg','audio/mpeg')
        and media_size between 1 and 15728640
        and (duration_ms is null or duration_ms between 1 and 3600000)
      )
    );

grant select(kind, media_path, media_mime, media_size, duration_ms)
  on public.fgi_messages to authenticated;
grant insert(kind, media_path, media_mime, media_size, duration_ms)
  on public.fgi_messages to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values (
  'fgi-chat',
  'fgi-chat',
  false,
  52428800,
  array[
    'image/jpeg','image/png','image/webp',
    'video/mp4','video/webm','video/quicktime',
    'audio/webm','audio/mp4','audio/ogg','audio/mpeg'
  ]::text[]
)
on conflict(id) do update set
  public=false,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists fgi_chat_storage_insert on storage.objects;
create policy fgi_chat_storage_insert
on storage.objects
for insert to authenticated
with check (
  bucket_id = 'fgi-chat'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.fgi_threads t
    where t.id::text = (storage.foldername(name))[2]
      and ((select auth.uid()) = t.client_id or (select auth.uid()) = t.coach_id)
  )
);

drop policy if exists fgi_chat_storage_read on storage.objects;
create policy fgi_chat_storage_read
on storage.objects
for select to authenticated
using (
  bucket_id = 'fgi-chat'
  and exists (
    select 1 from public.fgi_threads t
    where t.id::text = (storage.foldername(name))[2]
      and ((select auth.uid()) = t.client_id or (select auth.uid()) = t.coach_id)
  )
);

drop policy if exists fgi_chat_storage_delete on storage.objects;
create policy fgi_chat_storage_delete
on storage.objects
for delete to authenticated
using (
  bucket_id = 'fgi-chat'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.fgi_threads t
    where t.id::text = (storage.foldername(name))[2]
      and ((select auth.uid()) = t.client_id or (select auth.uid()) = t.coach_id)
  )
);

notify pgrst, 'reload schema';