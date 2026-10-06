-- Cover the version-owner FK; keep the single existing program table.
SET lock_timeout='5s';
SET statement_timeout='30s';
CREATE INDEX ai_program_previous_owner_idx ON public.fgi_ai_plans(supersedes_id,user_id);
