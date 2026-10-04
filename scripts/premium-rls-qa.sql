-- Run as one query. Fixtures and role transitions are always rolled back.
begin;
do $$
declare owner_a uuid := gen_random_uuid(); owner_b uuid := gen_random_uuid(); owner_c uuid := gen_random_uuid(); n integer; result text; denied boolean;
begin
  insert into auth.users(id,aud,role,email,raw_user_meta_data,created_at,updated_at)
  values(owner_a,'authenticated','authenticated','qa-premium-'||owner_a||'@example.invalid','{"full_name":"Premium QA fixture","signup_intent":"admin"}',now(),now()),
        (owner_b,'authenticated','authenticated','qa-premium-'||owner_b||'@example.invalid','{"full_name":"Premium QA inactive fixture"}',now(),now()),
        (owner_c,'authenticated','authenticated','qa-premium-'||owner_c||'@example.invalid','{}',now(),now());
  if (select role from public.profiles where id=owner_a) <> 'client' then raise exception 'Metadata granted a role'; end if;
  update public.profiles set is_active=false where id=owner_b;
  insert into public.fgi_user_workspace(user_id,data) values(owner_a,'{"saved_ai":[]}'),(owner_b,'{"private":"fixture"}');
  perform set_config('request.jwt.claim.sub','',true);
  perform set_config('request.jwt.claim.role','authenticated',true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_a,'role','authenticated','user_metadata',jsonb_build_object('role','admin','friend',true))::text,true);
  execute 'set local role authenticated';
  select count(*) into n from public.fgi_user_workspace where user_id in(owner_a,owner_b);
  if n <> 1 then raise exception 'Foreign workspace visible'; end if;
  update public.fgi_user_workspace set data='{"own":"saved"}' where user_id=owner_a;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Own workspace update failed'; end if;
  denied:=false;
  begin insert into public.fgi_user_workspace(user_id,data) values(owner_c,'{}'); exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'Foreign workspace insert allowed'; end if;
  update public.fgi_user_workspace set data='{"foreign":"changed"}' where user_id=owner_b;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'Foreign workspace writable'; end if;
  delete from public.fgi_user_workspace where user_id=owner_b;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'Foreign workspace deletable'; end if;
  denied:=false;
  begin update public.fgi_user_workspace set user_id=owner_c where user_id=owner_a; exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'Workspace ownership transferable'; end if;
  denied:=false;
  begin update public.profiles set role='admin' where id=owner_a; exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'Browser can assign role'; end if;
  denied:=false;
  begin update public.fgi_user_workspace set data=jsonb_build_object('oversized',repeat('x',25000)) where user_id=owner_a; exception when check_violation then denied:=true; end;
  if not denied then raise exception 'Unbounded workspace'; end if;
  select public.fgi_start_trainer_onboarding() into result;
  if result <> 'coach' then raise exception 'Own onboarding failed'; end if;
  execute 'reset role';
  if (select role from public.profiles where id=owner_a) <> 'coach' then raise exception 'Own role not stored'; end if;
  if (select role from public.profiles where id=owner_b) <> 'client' then raise exception 'Foreign role changed'; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',owner_b,'role','authenticated')::text,true);
  execute 'set local role authenticated';
  denied:=false;
  begin perform public.fgi_start_trainer_onboarding(); exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'Inactive account allowed onboarding'; end if;
  execute 'reset role';
  perform set_config('request.jwt.claim.role','anon',true);
  perform set_config('request.jwt.claims','{"role":"anon"}',true);
  execute 'set local role anon';
  denied:=false;
  begin perform public.fgi_start_trainer_onboarding(); exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'Anonymous onboarding allowed'; end if;
  denied:=false;
  begin select count(*) into n from public.fgi_user_workspace; exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'Anonymous workspace access allowed'; end if;
  execute 'reset role';
end;
$$;
rollback;
