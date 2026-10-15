-- Texto só da página de espera, antes do nível abrir.
alter table public.nodes
  add column if not exists preview_text text;
