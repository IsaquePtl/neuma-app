-- Extra check-in slots per level: base allowance is 1;
-- each mentor week-extension (or revision request) increments this counter.
alter table public.nodes
  add column if not exists week_extensions int not null default 0;

comment on column public.nodes.week_extensions is
  'Extra check-in slots beyond the base 1. Incremented when the mentor extends the level or asks for a check-in revision.';
