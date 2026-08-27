-- Campos de signup: idade + sexo (para saudação Bem vindo / Bem vinda).
create type public.profile_gender as enum ('female', 'male', 'other');

alter table public.profiles
  add column if not exists age integer
    check (age is null or (age >= 13 and age <= 120)),
  add column if not exists gender public.profile_gender;

-- Propaga first/last name, age e gender a partir de user_metadata no signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta_first text := nullif(trim(coalesce(new.raw_user_meta_data->>'first_name', '')), '');
  meta_last text := nullif(trim(coalesce(new.raw_user_meta_data->>'last_name', '')), '');
  meta_full text := nullif(trim(coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    ''
  )), '');
  composed_name text;
  meta_age integer;
  meta_gender public.profile_gender;
begin
  composed_name := nullif(trim(concat_ws(' ', meta_first, meta_last)), '');

  begin
    meta_age := nullif(new.raw_user_meta_data->>'age', '')::integer;
  exception
    when others then
      meta_age := null;
  end;

  begin
    meta_gender := nullif(new.raw_user_meta_data->>'gender', '')::public.profile_gender;
  exception
    when others then
      meta_gender := null;
  end;

  insert into public.profiles (id, email, full_name, age, gender)
  values (
    new.id,
    new.email,
    coalesce(composed_name, meta_full, split_part(new.email, '@', 1)),
    case
      when meta_age is not null and meta_age between 13 and 120 then meta_age
      else null
    end,
    meta_gender
  );
  return new;
end;
$$;
