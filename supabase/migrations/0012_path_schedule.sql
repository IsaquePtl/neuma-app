-- Schedule for path templates + duration per level
alter table public.path_templates
  add column if not exists start_date date,
  add column if not exists end_date date,
  add column if not exists period_months int;

alter table public.path_template_nodes
  add column if not exists duration_weeks int;
