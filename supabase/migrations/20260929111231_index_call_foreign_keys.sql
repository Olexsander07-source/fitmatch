create index if not exists fgi_calls_caller_id_idx
  on public.fgi_calls(caller_id);

create index if not exists fgi_call_signals_sender_id_idx
  on public.fgi_call_signals(sender_id);