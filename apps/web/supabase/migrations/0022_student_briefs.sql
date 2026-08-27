-- 0022: Student transformation briefs (ROTA DE TRANSFORMAÇÃO)

create table if not exists public.student_briefs (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.profiles(id) on delete set null,
  path_id uuid references public.paths(id) on delete set null,
  placeholder_name text,
  raw_markdown text not null,
  structured jsonb not null default '{}'::jsonb,
  source text not null default 'mentor'
    check (source in ('mentor', 'agent', 'tally', 'imported')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists student_briefs_student_idx
  on public.student_briefs (student_id);
create index if not exists student_briefs_path_idx
  on public.student_briefs (path_id);

alter table public.student_briefs enable row level security;

create policy student_briefs_mentor_all
  on public.student_briefs for all to authenticated
  using (public.is_mentor())
  with check (public.is_mentor());

-- Students can read their own brief once linked
create policy student_briefs_student_select
  on public.student_briefs for select to authenticated
  using (student_id = auth.uid());
