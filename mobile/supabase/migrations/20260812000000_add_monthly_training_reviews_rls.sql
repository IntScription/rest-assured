-- monthly_training_reviews has row level security enabled but no policies,
-- which denies every operation by default (including the user's own rows).
-- Add the same user-scoped policy shape already used on `logs`.
create policy "monthly_training_reviews_select_own"
  on public.monthly_training_reviews
  for select
  using (auth.uid() = user_id);

create policy "monthly_training_reviews_insert_own"
  on public.monthly_training_reviews
  for insert
  with check (auth.uid() = user_id);

create policy "monthly_training_reviews_update_own"
  on public.monthly_training_reviews
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "monthly_training_reviews_delete_own"
  on public.monthly_training_reviews
  for delete
  using (auth.uid() = user_id);
