-- 0028: permissão de agendamento de sessões (controlada pelo mentor)

alter table public.profiles
  add column if not exists can_book_sessions boolean not null default true;

comment on column public.profiles.can_book_sessions is
  'Se false, o aluno não pode agendar sessões (Cal.com) na app.';

-- Impedir que o aluno altere a própria permissão de agendamento
create or replace function public.guard_student_can_book_sessions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and new.can_book_sessions is distinct from old.can_book_sessions
     and auth.uid() is not null
     and auth.uid() = new.id
     and not public.is_mentor() then
    new.can_book_sessions := old.can_book_sessions;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_can_book_sessions on public.profiles;
create trigger profiles_guard_can_book_sessions
  before update on public.profiles
  for each row
  execute function public.guard_student_can_book_sessions();
