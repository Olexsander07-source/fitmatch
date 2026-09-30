alter table public.fgi_coaches
  add column if not exists availability text[] not null default '{}'::text[];

alter table public.fgi_coaches
  drop constraint if exists fgi_coaches_availability_check;

alter table public.fgi_coaches
  add constraint fgi_coaches_availability_check
  check (
    cardinality(availability) <= 4
    and availability <@ array['morning','day','evening','weekend']::text[]
  );