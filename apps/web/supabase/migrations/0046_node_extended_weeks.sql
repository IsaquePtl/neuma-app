-- "Prolongar prazo" works in whole weeks. Planned weeks (duration_weeks) count
-- against the path's week budget; extended_weeks push this level and every
-- following level later without consuming that budget.
alter table public.nodes
  add column if not exists extended_weeks integer not null default 0;

alter table public.nodes
  drop constraint if exists nodes_extended_weeks_range;
alter table public.nodes
  add constraint nodes_extended_weeks_range
  check (extended_weeks >= 0 and extended_weeks <= 52);
