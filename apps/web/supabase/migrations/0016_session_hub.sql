-- Check-ins sem nível + reviews do aluno sobre a app / 1:1

-- Permitir check-in sem node (órfão)
alter table public.check_ins
  alter column node_id drop not null;

alter table public.check_ins
  drop constraint if exists check_ins_node_id_fkey;

alter table public.check_ins
  add constraint check_ins_node_id_fkey
  foreign key (node_id) references public.nodes(id) on delete set null;

alter table public.check_ins
  add column if not exists level_label text;

comment on column public.check_ins.level_label is
  'Rótulo quando não há node (ex.: Sem nível associado)';

-- Reviews / opinião do aluno (não é feedback do mentor)
create table if not exists public.student_reviews (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  topic text not null default 'geral',
  rating integer check (rating is null or (rating >= 1 and rating <= 5)),
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists student_reviews_student_idx
  on public.student_reviews (student_id, created_at desc);

alter table public.student_reviews enable row level security;

drop policy if exists "Students manage own student_reviews" on public.student_reviews;
create policy "Students manage own student_reviews"
  on public.student_reviews
  for all
  to authenticated
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

drop policy if exists "Mentors read student_reviews" on public.student_reviews;
create policy "Mentors read student_reviews"
  on public.student_reviews
  for select
  to authenticated
  using (public.is_mentor());
