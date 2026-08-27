-- 0025: Richer mentor calendar events (edit + link to student/path/node)

alter table public.mentor_calendar_events
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists student_id uuid references public.profiles(id) on delete set null,
  add column if not exists path_id uuid references public.paths(id) on delete set null,
  add column if not exists node_id uuid references public.nodes(id) on delete set null,
  add column if not exists ends_at timestamptz,
  add column if not exists source text not null default 'manual'
    check (source in ('manual', 'agent'));

create index if not exists mentor_calendar_events_student_idx
  on public.mentor_calendar_events (student_id)
  where student_id is not null;
