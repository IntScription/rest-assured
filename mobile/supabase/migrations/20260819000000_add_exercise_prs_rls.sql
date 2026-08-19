-- exercise_prs has row level security enabled but no policies, which denies
-- every operation by default (including the user's own rows). Same gap
-- monthly_training_reviews had. It's currently unused by the app, but adding
-- the standard user-scoped policy shape now avoids the same silent-failure
-- surprise the moment something starts writing to it.
create policy "exercise_prs_select_own"
  on public.exercise_prs
  for select
  using (auth.uid() = user_id);

create policy "exercise_prs_insert_own"
  on public.exercise_prs
  for insert
  with check (auth.uid() = user_id);

create policy "exercise_prs_update_own"
  on public.exercise_prs
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "exercise_prs_delete_own"
  on public.exercise_prs
  for delete
  using (auth.uid() = user_id);
