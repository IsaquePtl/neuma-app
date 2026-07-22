-- Notas internas do mentor sobre o aluno (nao visiveis ao aluno na UI)
alter table public.profiles
  add column if not exists internal_notes text;
