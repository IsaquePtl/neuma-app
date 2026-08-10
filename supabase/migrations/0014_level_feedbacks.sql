-- Freeform mentor feedback on a path level (independent of check-ins)
create table if not exists public.level_feedbacks (
  id uuid primary key default gen_random_uuid(),
  node_id uuid not null references public.nodes(id) on delete cascade,
  mentor_id uuid not null references public.profiles(id) on delete cascade,
  notes text,
  video_url text,
  file_url text,
  created_at timestamptz not null default now()
);

create index if not exists level_feedbacks_node_id_idx
  on public.level_feedbacks (node_id, created_at desc);

alter table public.level_feedbacks enable row level security;

create policy "Mentors manage level_feedbacks"
  on public.level_feedbacks
  for all
  to authenticated
  using (public.is_mentor())
  with check (public.is_mentor() and mentor_id = auth.uid());

-- Students can read feedback on their own path levels
create policy "Students read own level_feedbacks"
  on public.level_feedbacks
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.nodes n
      join public.paths p on p.id = n.path_id
      where n.id = level_feedbacks.node_id
        and p.student_id = auth.uid()
    )
  );
