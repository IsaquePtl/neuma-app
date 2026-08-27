-- Library taxonomy: categories/topics + asset usage; node_kind lesson

do $$ begin
  create type public.library_asset_usage as enum ('practice', 'lesson');
exception when duplicate_object then null;
end $$;

-- Add lesson to node_kind (keep resource for now; migrate rows)
do $$ begin
  alter type public.node_kind add value if not exists 'lesson';
exception when duplicate_object then null;
end $$;

create table if not exists public.library_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  sort_index int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.library_topics (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.library_categories(id) on delete cascade,
  name text not null,
  slug text not null,
  sort_index int not null default 0,
  created_at timestamptz not null default now(),
  unique (category_id, slug)
);

create index if not exists library_topics_category_idx
  on public.library_topics (category_id, sort_index);

alter table public.library_categories enable row level security;
alter table public.library_topics enable row level security;

drop policy if exists "Mentors manage library_categories" on public.library_categories;
create policy "Mentors manage library_categories"
  on public.library_categories for all to authenticated
  using (public.is_mentor()) with check (public.is_mentor());

drop policy if exists "Mentors manage library_topics" on public.library_topics;
create policy "Mentors manage library_topics"
  on public.library_topics for all to authenticated
  using (public.is_mentor()) with check (public.is_mentor());

alter table public.library_assets
  add column if not exists usage public.library_asset_usage not null default 'lesson',
  add column if not exists topic_id uuid references public.library_topics(id) on delete set null;

create index if not exists library_assets_usage_idx on public.library_assets (usage);
create index if not exists library_assets_topic_idx on public.library_assets (topic_id);

-- Migrate resource → lesson on nodes / template nodes
update public.nodes set kind = 'lesson' where kind::text = 'resource';
update public.path_template_nodes set kind = 'lesson' where kind::text = 'resource';
