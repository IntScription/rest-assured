-- Add optional RPE (Rate of Perceived Exertion) tracking to workout logs.
-- Nullable and additive: existing rows/queries are unaffected.
-- Scale: 1-10, half-point increments (e.g. 8.5) are conventional in RPE-based training.
alter table public.logs
  add column rpe numeric(3, 1);

alter table public.logs
  add constraint logs_rpe_range check (rpe is null or (rpe >= 1 and rpe <= 10));
