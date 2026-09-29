-- Impede que um aluno alargue one_to_one_access_until pela API.
create or replace function public.guard_profile_privileged_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.role                is not distinct from old.role
     and new.billing_exempt  is not distinct from old.billing_exempt
     and new.is_one_to_one   is not distinct from old.is_one_to_one
     and new.one_to_one_access_until is not distinct from old.one_to_one_access_until then
    return new;
  end if;

  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  if public.is_mentor() then
    return new;
  end if;

  raise exception
    'Sem permissao para alterar role, billing_exempt, is_one_to_one ou one_to_one_access_until'
    using errcode = '42501';
end;
$$;
