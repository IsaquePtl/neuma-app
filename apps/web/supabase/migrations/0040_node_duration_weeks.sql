-- Duration of each live path level in Mon–Fri weeks (min 1).
alter table public.nodes
  add column if not exists duration_weeks int;

comment on column public.nodes.duration_weeks is
  'Number of Mon–Fri weeks this level spans (min 1). week_number = start week index.';
