-- 0024: Library content status for agent-created empty shells

do $$ begin
  create type public.library_content_status as enum ('empty', 'drafting', 'ready');
exception when duplicate_object then null;
end $$;

alter table public.library_assets
  add column if not exists content_status public.library_content_status not null default 'ready',
  add column if not exists created_by_agent boolean not null default false;

alter table public.library_topics
  add column if not exists created_by_agent boolean not null default false,
  add column if not exists rationale text;

-- Existing assets with no url/body stay as-is (ready) unless agent-created later.
create index if not exists library_assets_agent_empty_idx
  on public.library_assets (content_status, created_by_agent)
  where created_by_agent = true;

create index if not exists library_topics_agent_idx
  on public.library_topics (created_by_agent)
  where created_by_agent = true;
