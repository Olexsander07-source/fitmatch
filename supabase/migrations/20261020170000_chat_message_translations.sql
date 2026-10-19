-- Cache only translations for existing private chat messages.
-- Translation is performed by the authenticated server endpoint after the
-- fgi_messages RLS read check; no browser key or public translation rows.
create table if not exists public.fgi_message_translations (
  message_id bigint not null references public.fgi_messages(id) on delete cascade,
  target_language text not null check (target_language ~ '^[a-z]{2}$'),
  translated_text text not null check (char_length(translated_text) between 1 and 10000),
  requested_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (message_id, target_language)
);
create index if not exists fgi_message_translations_usage_idx
  on public.fgi_message_translations(requested_by,created_at);
alter table public.fgi_message_translations enable row level security;
revoke all on table public.fgi_message_translations from public,anon,authenticated;
