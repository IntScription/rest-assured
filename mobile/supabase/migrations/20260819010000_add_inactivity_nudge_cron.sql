-- Proactive engagement nudge: once a day, notify users who have trained
-- before but have gone quiet for 3+ days. Reuses the existing
-- notifications -> push-notifications trigger, so this only needs to
-- insert a row; delivery is already wired up.
--
-- Guards:
--   * only users with at least one completed workout_session (never nudge
--     someone who hasn't started training yet — that's an onboarding
--     problem, not an inactivity one)
--   * only re-nudge at most once every 2 days per user, so this can't spam
--     someone who stays inactive for a week straight
create or replace function public.send_inactivity_nudges()
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.notifications (user_id, title, body, data)
  select
    p.id,
    'Time to get back to it',
    'You haven''t logged a workout in a few days. A quick session today keeps your progress moving.',
    jsonb_build_object('type', 'inactivity_nudge')
  from public.profiles p
  where exists (
    select 1 from public.workout_sessions ws where ws.user_id = p.id
  )
  and (
    select max(ws2.workout_date)
    from public.workout_sessions ws2
    where ws2.user_id = p.id
  ) < (current_date - interval '3 days')
  and not exists (
    select 1 from public.notifications n
    where n.user_id = p.id
      and n.data ->> 'type' = 'inactivity_nudge'
      and n.created_at > now() - interval '2 days'
  );
$$;

select cron.schedule(
  'inactivity-nudges',
  '0 15 * * *',
  $$select public.send_inactivity_nudges();$$
);
