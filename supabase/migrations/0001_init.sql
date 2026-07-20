-- Neuma Beta - schema inicial (MVP mentoria 1:1)
-- Entidades: profiles, paths, nodes, check_ins, feedbacks, diagnostics
-- Seguranca: RLS estrito. Mentor tem ALL; aluno vive isolado (tenant-like).

-- =====================================================================
-- ENUMS
-- =====================================================================
create type public.user_role as enum ('mentor', 'student');
create type public.node_status as enum ('locked', 'active', 'completed');
create type public.check_in_status as enum ('pending', 'approved', 'needs_revision');

-- =====================================================================
-- TABELAS
-- =====================================================================

-- profiles: extende auth.users
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null default 'student',
  full_name text,
  email text,
  avatar_url text,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now()
);

-- paths: um percurso por aluno, desenhado pelo mentor
create table public.paths (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  title text not null,
  description text,
  created_at timestamptz not null default now()
);
create index paths_student_idx on public.paths (student_id);

-- nodes: niveis/blocos sequenciais do percurso
create table public.nodes (
  id uuid primary key default gen_random_uuid(),
  path_id uuid not null references public.paths(id) on delete cascade,
  title text not null,
  description text,
  order_index int not null,
  status public.node_status not null default 'locked',
  created_at timestamptz not null default now(),
  unique (path_id, order_index)
);
create index nodes_path_idx on public.nodes (path_id);

-- check_ins: submissoes do aluno (link de video + notas)
create table public.check_ins (
  id uuid primary key default gen_random_uuid(),
  node_id uuid not null references public.nodes(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  video_url text not null,
  notes text,
  ai_summary text,
  status public.check_in_status not null default 'pending',
  created_at timestamptz not null default now()
);
create index check_ins_student_idx on public.check_ins (student_id);
create index check_ins_node_idx on public.check_ins (node_id);

-- feedbacks: avaliacao do mentor a um check-in
create table public.feedbacks (
  id uuid primary key default gen_random_uuid(),
  check_in_id uuid not null unique references public.check_ins(id) on delete cascade,
  mentor_id uuid not null references public.profiles(id) on delete cascade,
  video_url text,
  notes text,
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

-- diagnostics: respostas do questionario de onboarding
create table public.diagnostics (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  responses jsonb not null,
  created_at timestamptz not null default now()
);
create index diagnostics_student_idx on public.diagnostics (student_id);

-- =====================================================================
-- FUNCOES AUXILIARES
-- =====================================================================

-- is_mentor(): SECURITY DEFINER para evitar recursao de RLS ao ler profiles
create or replace function public.is_mentor()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'mentor'
  );
$$;

-- handle_new_user(): cria profile automaticamente no signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
alter table public.profiles    enable row level security;
alter table public.paths       enable row level security;
alter table public.nodes       enable row level security;
alter table public.check_ins   enable row level security;
alter table public.feedbacks   enable row level security;
alter table public.diagnostics enable row level security;

-- profiles ----------------------------------------------------------
create policy "profiles_select_own" on public.profiles
  for select using (id = auth.uid());
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles_mentor_all" on public.profiles
  for all using (public.is_mentor()) with check (public.is_mentor());

-- paths -------------------------------------------------------------
create policy "paths_student_select" on public.paths
  for select using (student_id = auth.uid());
create policy "paths_mentor_all" on public.paths
  for all using (public.is_mentor()) with check (public.is_mentor());

-- nodes -------------------------------------------------------------
create policy "nodes_student_select" on public.nodes
  for select using (
    exists (
      select 1 from public.paths p
      where p.id = nodes.path_id and p.student_id = auth.uid()
    )
  );
create policy "nodes_mentor_all" on public.nodes
  for all using (public.is_mentor()) with check (public.is_mentor());

-- check_ins ---------------------------------------------------------
create policy "checkins_student_select" on public.check_ins
  for select using (student_id = auth.uid());
create policy "checkins_student_insert" on public.check_ins
  for insert with check (
    student_id = auth.uid()
    and exists (
      select 1 from public.nodes n
      join public.paths p on p.id = n.path_id
      where n.id = check_ins.node_id and p.student_id = auth.uid()
    )
  );
create policy "checkins_mentor_all" on public.check_ins
  for all using (public.is_mentor()) with check (public.is_mentor());

-- feedbacks ---------------------------------------------------------
create policy "feedbacks_student_select" on public.feedbacks
  for select using (
    exists (
      select 1 from public.check_ins c
      where c.id = feedbacks.check_in_id and c.student_id = auth.uid()
    )
  );
create policy "feedbacks_mentor_all" on public.feedbacks
  for all using (public.is_mentor()) with check (public.is_mentor());

-- diagnostics -------------------------------------------------------
create policy "diagnostics_student_select" on public.diagnostics
  for select using (student_id = auth.uid());
create policy "diagnostics_student_insert" on public.diagnostics
  for insert with check (student_id = auth.uid());
create policy "diagnostics_mentor_all" on public.diagnostics
  for all using (public.is_mentor()) with check (public.is_mentor());
