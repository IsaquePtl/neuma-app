-- 0029: atribuição automática do mentor por omissão a alunos novos / sem vínculo
-- Mentor por omissão: isaqueportilho2014@gmail.com (ajustar default_mentor_id() se mudar)

alter table public.profiles
  add column if not exists mentor_id uuid references public.profiles(id) on delete set null;

create index if not exists profiles_mentor_id_idx
  on public.profiles (mentor_id)
  where mentor_id is not null;

-- Resolve o perfil do mentor por email (apenas role mentor).
-- Se não existir, devolve null e emite warning (não falha o signup).
create or replace function public.default_mentor_id()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  mentor_email constant text := 'isaqueportilho2014@gmail.com';
  mid uuid;
begin
  select id into mid
  from public.profiles
  where lower(email) = lower(mentor_email)
    and role = 'mentor'
  limit 1;

  if mid is null then
    raise warning
      'default_mentor_id: perfil mentor não encontrado para % — aluno fica sem mentor_id',
      mentor_email;
  end if;

  return mid;
end;
$$;

revoke all on function public.default_mentor_id() from public;
grant execute on function public.default_mentor_id() to authenticated;
grant execute on function public.default_mentor_id() to service_role;

-- BEFORE INSERT/UPDATE: alunos sem mentor_id recebem o mentor por omissão.
-- Idempotente: não sobrescreve mentor_id já definido; ignora mentors.
create or replace function public.assign_default_mentor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  mid uuid;
begin
  if new.role = 'student' and new.mentor_id is null then
    mid := public.default_mentor_id();
    if mid is not null and mid <> new.id then
      new.mentor_id := mid;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_assign_default_mentor on public.profiles;
create trigger profiles_assign_default_mentor
  before insert or update on public.profiles
  for each row
  execute function public.assign_default_mentor();

-- Permitir null → mentor (auto-assign); continuar a bloquear alunos a trocar mentor já definido.
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
     and not public.is_mentor()
     and old.mentor_id is not null then
    new.mentor_id := old.mentor_id;
  end if;
  return new;
end;
$$;

-- Backfill: alunos existentes sem mentor (o trigger também cobre updates futuros)
update public.profiles s
set mentor_id = m.id
from (
  select public.default_mentor_id() as id
) m
where s.role = 'student'
  and s.mentor_id is null
  and m.id is not null
  and m.id <> s.id;
