-- Check-point quiz: MC questions + student attempts (score only; no path gate)

create table if not exists public.node_quiz_questions (
  id uuid primary key default gen_random_uuid(),
  node_id uuid not null references public.nodes(id) on delete cascade,
  order_index integer not null default 0,
  prompt text not null,
  options jsonb not null default '[]'::jsonb,
  correct_option_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists node_quiz_questions_node_idx
  on public.node_quiz_questions (node_id, order_index);

create table if not exists public.node_quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  node_id uuid not null references public.nodes(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  score integer not null check (score >= 0 and score <= 100),
  correct_count integer not null check (correct_count >= 0),
  total integer not null check (total >= 0),
  created_at timestamptz not null default now()
);

create index if not exists node_quiz_attempts_node_student_idx
  on public.node_quiz_attempts (node_id, student_id, created_at desc);

alter table public.node_quiz_questions enable row level security;
alter table public.node_quiz_attempts enable row level security;

-- Mentors CRUD questions
drop policy if exists "Mentors manage node_quiz_questions" on public.node_quiz_questions;
create policy "Mentors manage node_quiz_questions"
  on public.node_quiz_questions
  for all
  to authenticated
  using (public.is_mentor())
  with check (public.is_mentor());

-- Students read questions on their own path nodes
drop policy if exists "Students read own node_quiz_questions" on public.node_quiz_questions;
create policy "Students read own node_quiz_questions"
  on public.node_quiz_questions
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.nodes n
      join public.paths p on p.id = n.path_id
      where n.id = node_quiz_questions.node_id
        and p.student_id = auth.uid()
    )
  );

-- Students insert + read own attempts
drop policy if exists "Students insert own node_quiz_attempts" on public.node_quiz_attempts;
create policy "Students insert own node_quiz_attempts"
  on public.node_quiz_attempts
  for insert
  to authenticated
  with check (
    student_id = auth.uid()
    and exists (
      select 1
      from public.nodes n
      join public.paths p on p.id = n.path_id
      where n.id = node_quiz_attempts.node_id
        and p.student_id = auth.uid()
    )
  );

drop policy if exists "Students read own node_quiz_attempts" on public.node_quiz_attempts;
create policy "Students read own node_quiz_attempts"
  on public.node_quiz_attempts
  for select
  to authenticated
  using (student_id = auth.uid());

-- Mentors read attempts (to review scores)
drop policy if exists "Mentors read node_quiz_attempts" on public.node_quiz_attempts;
create policy "Mentors read node_quiz_attempts"
  on public.node_quiz_attempts
  for select
  to authenticated
  using (public.is_mentor());
