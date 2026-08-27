-- 0027: vínculo aluno ↔ mentor + alunos podem ler o perfil do seu mentor

alter table public.profiles
  add column if not exists mentor_id uuid references public.profiles(id) on delete set null;

create index if not exists profiles_mentor_id_idx
  on public.profiles (mentor_id)
  where mentor_id is not null;

-- Evitar auto-referência acidental (mentor a apontar para si como mentor)
alter table public.profiles
  drop constraint if exists profiles_mentor_id_not_self;
alter table public.profiles
  add constraint profiles_mentor_id_not_self
  check (mentor_id is null or mentor_id <> id);

-- Backfill a partir do percurso (created_by = mentor)
update public.profiles s
set mentor_id = p.created_by
from public.paths p
where s.role = 'student'
  and s.mentor_id is null
  and p.student_id = s.id
  and p.created_by is not null;

-- Alunos ainda sem vínculo: mentor único da equipa (fase actual)
update public.profiles s
set mentor_id = m.id
from (
  select id
  from public.profiles
  where role = 'mentor'
  order by created_at asc
  limit 1
) m
where s.role = 'student'
  and s.mentor_id is null;

-- Função SECURITY DEFINER para evitar recursão RLS ao ler mentor_id
create or replace function public.my_mentor_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select mentor_id from public.profiles where id = auth.uid();
$$;

revoke all on function public.my_mentor_id() from public;
grant execute on function public.my_mentor_id() to authenticated;

-- Aluno pode ler o perfil do mentor a que está vinculado
drop policy if exists "profiles_select_my_mentor" on public.profiles;
create policy "profiles_select_my_mentor" on public.profiles
  for select using (
    role = 'mentor'
    and (
      id = public.my_mentor_id()
      or exists (
        select 1
        from public.paths p
        where p.student_id = auth.uid()
          and p.created_by = profiles.id
      )
    )
  );

-- Impedir que o aluno altere o próprio mentor_id
create or replace function public.guard_student_mentor_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and new.mentor_id is distinct from old.mentor_id
     and auth.uid() is not null
     and auth.uid() = new.id
     and not public.is_mentor() then
    new.mentor_id := old.mentor_id;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_mentor_id on public.profiles;
create trigger profiles_guard_mentor_id
  before update on public.profiles
  for each row
  execute function public.guard_student_mentor_id();
