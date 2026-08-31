-- Track when a student has seen mentor feedback (check-in or level).
create table if not exists public.student_feedback_views (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  feedback_kind text not null check (feedback_kind in ('check_in', 'level')),
  reference_id uuid not null,
  viewed_at timestamptz not null default now(),
  unique (student_id, feedback_kind, reference_id)
);

create index if not exists student_feedback_views_student_idx
  on public.student_feedback_views (student_id, feedback_kind, reference_id);

alter table public.student_feedback_views enable row level security;

create policy "Students manage own feedback views"
  on public.student_feedback_views
  for all
  to authenticated
  using (student_id = auth.uid())
  with check (student_id = auth.uid());
