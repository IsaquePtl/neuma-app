-- Phase checkpoints: a milestone can close its phase (is_phase_checkpoint).
-- Closing checkpoint = last level of the phase. Failing its quiz requires the
-- student to revisit the phase's levels (node_visits) before retrying.
-- A milestone without the flag is a standalone quiz (retry immediately).

alter table public.nodes
  add column if not exists is_phase_checkpoint boolean not null default false;

alter table public.path_template_nodes
  add column if not exists is_phase_checkpoint boolean not null default false;

-- Backfill: only a milestone that is already the last level of its phase
-- becomes the phase checkpoint. One per phase by construction; no reorders.
with last_in_phase as (
  select distinct on (path_id, phase_key) id, kind
  from public.nodes
  where phase_key is not null
  order by path_id, phase_key, order_index desc
)
update public.nodes n
set is_phase_checkpoint = true
from last_in_phase l
where n.id = l.id and l.kind = 'milestone';

with last_in_phase as (
  select distinct on (template_id, phase_key) id, kind
  from public.path_template_nodes
  where phase_key is not null
  order by template_id, phase_key, order_index desc
)
update public.path_template_nodes n
set is_phase_checkpoint = true
from last_in_phase l
where n.id = l.id and l.kind = 'milestone';

alter table public.nodes
  drop constraint if exists nodes_phase_checkpoint_shape;
alter table public.nodes
  add constraint nodes_phase_checkpoint_shape
  check (not is_phase_checkpoint or (kind = 'milestone' and phase_key is not null));

alter table public.path_template_nodes
  drop constraint if exists path_template_nodes_phase_checkpoint_shape;
alter table public.path_template_nodes
  add constraint path_template_nodes_phase_checkpoint_shape
  check (not is_phase_checkpoint or (kind = 'milestone' and phase_key is not null));

create unique index if not exists nodes_one_checkpoint_per_phase
  on public.nodes (path_id, phase_key)
  where is_phase_checkpoint;

create unique index if not exists path_template_nodes_one_checkpoint_per_phase
  on public.path_template_nodes (template_id, phase_key)
  where is_phase_checkpoint;

-- Atomic reorder (order_index unique is not deferrable). Security invoker:
-- RLS still applies, so only mentors can reorder.
create or replace function public.reorder_path_nodes(p_path_id uuid, p_ids uuid[])
returns void
language plpgsql
as $$
begin
  update public.nodes n
  set order_index = -1 - (o.pos)::int
  from unnest(p_ids) with ordinality as o(id, pos)
  where n.id = o.id and n.path_id = p_path_id;

  update public.nodes n
  set order_index = (o.pos)::int - 1
  from unnest(p_ids) with ordinality as o(id, pos)
  where n.id = o.id and n.path_id = p_path_id;
end;
$$;

create or replace function public.reorder_template_nodes(p_template_id uuid, p_ids uuid[])
returns void
language plpgsql
as $$
begin
  update public.path_template_nodes n
  set order_index = -1 - (o.pos)::int
  from unnest(p_ids) with ordinality as o(id, pos)
  where n.id = o.id and n.template_id = p_template_id;

  update public.path_template_nodes n
  set order_index = (o.pos)::int - 1
  from unnest(p_ids) with ordinality as o(id, pos)
  where n.id = o.id and n.template_id = p_template_id;
end;
$$;

-- Last time a student opened each level (phase review after a failed quiz).
create table if not exists public.node_visits (
  student_id uuid not null references public.profiles(id) on delete cascade,
  node_id uuid not null references public.nodes(id) on delete cascade,
  visited_at timestamptz not null default now(),
  primary key (student_id, node_id)
);

alter table public.node_visits enable row level security;

drop policy if exists "Students manage own node visits" on public.node_visits;
create policy "Students manage own node visits"
  on public.node_visits
  for all
  to authenticated
  using (student_id = auth.uid())
  with check (
    student_id = auth.uid()
    and exists (
      select 1
      from public.nodes n
      join public.paths p on p.id = n.path_id
      where n.id = node_visits.node_id and p.student_id = auth.uid()
    )
  );

drop policy if exists "Mentors read node visits" on public.node_visits;
create policy "Mentors read node visits"
  on public.node_visits
  for select
  to authenticated
  using (public.is_mentor());
