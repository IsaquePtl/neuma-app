-- Neuma Beta - expansao do schema para a app completa (fase 1:1)
-- Acrescenta: planeamento de percurso (objetivo/datas/status), tipos de node,
-- tipos de check-in, proximos passos no feedback, e a app "Formularios".

-- =====================================================================
-- NOVOS ENUMS
-- =====================================================================
create type public.path_status as enum ('draft', 'active', 'completed', 'paused');
create type public.node_kind as enum ('practice', 'call', 'milestone', 'resource');
create type public.check_in_kind as enum ('video', 'text', 'call');
create type public.form_question_type as enum (
  'short_text', 'long_text', 'single_choice', 'multi_choice', 'scale'
);

-- =====================================================================
-- PATHS: planeamento
-- =====================================================================
alter table public.paths
  add column if not exists goal text,
  add column if not exists start_date date,
  add column if not exists end_date date,
  add column if not exists duration_label text,
  add column if not exists status public.path_status not null default 'draft';

-- =====================================================================
-- NODES: semana + tipo de interacao + prazo
-- =====================================================================
alter table public.nodes
  add column if not exists week_number int,
  add column if not exists kind public.node_kind not null default 'practice',
  add column if not exists due_date date;

-- =====================================================================
-- CHECK_INS: video passa a opcional; tipo de check-in
-- =====================================================================
alter table public.check_ins
  alter column video_url drop not null,
  add column if not exists kind public.check_in_kind not null default 'video';

-- =====================================================================
-- FEEDBACKS: proximos passos (coaching)
-- =====================================================================
alter table public.feedbacks
  add column if not exists next_steps text;

-- =====================================================================
-- APP FORMULARIOS
-- =====================================================================
create table if not exists public.forms (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references public.profiles(id) on delete set null,
  title text not null,
  description text,
  is_active boolean not null default true,
  is_onboarding boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.form_questions (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.forms(id) on delete cascade,
  order_index int not null,
  label text not null,
  help_text text,
  type public.form_question_type not null default 'short_text',
  options jsonb,
  required boolean not null default false,
  unique (form_id, order_index)
);
create index if not exists form_questions_form_idx on public.form_questions (form_id);

create table if not exists public.form_responses (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.forms(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  answers jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists form_responses_form_idx on public.form_responses (form_id);
create index if not exists form_responses_student_idx on public.form_responses (student_id);

-- =====================================================================
-- RLS para a app Formularios
-- =====================================================================
alter table public.forms          enable row level security;
alter table public.form_questions enable row level security;
alter table public.form_responses enable row level security;

-- forms: mentor gere tudo; aluno ve formularios ativos
create policy "forms_mentor_all" on public.forms
  for all using (public.is_mentor()) with check (public.is_mentor());
create policy "forms_student_select" on public.forms
  for select using (is_active = true);

-- form_questions: mentor gere tudo; aluno ve perguntas de formularios ativos
create policy "form_questions_mentor_all" on public.form_questions
  for all using (public.is_mentor()) with check (public.is_mentor());
create policy "form_questions_student_select" on public.form_questions
  for select using (
    exists (
      select 1 from public.forms f
      where f.id = form_questions.form_id and f.is_active = true
    )
  );

-- form_responses: mentor ve tudo; aluno ve e cria as suas
create policy "form_responses_mentor_all" on public.form_responses
  for all using (public.is_mentor()) with check (public.is_mentor());
create policy "form_responses_student_select" on public.form_responses
  for select using (student_id = auth.uid());
create policy "form_responses_student_insert" on public.form_responses
  for insert with check (student_id = auth.uid());
