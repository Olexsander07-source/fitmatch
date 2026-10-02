-- The coach form includes availability in every insert/upsert.
-- Keep column-level protection for ratings, verification and payment state.
grant insert (availability), update (availability)
  on table public.fgi_coaches to authenticated;

notify pgrst, 'reload schema';
