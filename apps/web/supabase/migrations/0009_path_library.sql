-- Path library: reusable assets + path templates + apply snapshot
-- Also catch-up enums/columns from 0002/0003 if remote was partial.

do $$ begin
  create type public.path_status as enum ('draft', 'active', 'completed', 'paused');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.node_kind as enum ('practice', 'call', 'milestone', 'resource');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.library_asset_kind as enum (
    'video',
    'text',
    'image',
    'file',
    'link'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.path_template_status as enum (
    'draft',
    'ready',
    'archived'
  );
exception when duplicate_object then null;
end $$;

alter table public.paths
  add column if not exists goal text,
  add column if not exists start_date date,
  add column if not exists end_date date,
  add column if not exists duration_label text;

do $$ begin
  alter table public.paths add column status public.path_status not null default 'draft';
exception when duplicate_column then null;
end $$;

alter table public.nodes
  add column if not exists week_number int,
  add column if not exists due_date date,
  add column if not exists resource_url text,
  add column if not exists content_body text;

do $$ begin
  alter table public.nodes add column kind public.node_kind not null default 'practice';
exception when duplicate_column then null;
end $$;

create table if not exists public.library_assets (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  summary text,
  kind public.library_asset_kind not null default 'link',
  body text,
  url text,
  storage_path text,
  tags text[] not null default '{}',
  cover_url text,
  duration_label text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create index if not exists library_assets_kind_idx on public.library_assets (kind);
create index if not exists library_assets_archived_idx on public.library_assets (archived_at);
create index if not exists library_assets_tags_idx on public.library_assets using gin (tags);

alter table public.library_assets enable row level security;

drop policy if exists "Mentors manage library_assets" on public.library_assets;
create policy "Mentors manage library_assets"
  on public.library_assets
  for all
  to authenticated
  using (public.is_mentor())
  with check (public.is_mentor());

create table if not exists public.path_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  goal text,
  duration_label text,
  suggested_node_count int,
  status public.path_template_status not null default 'draft',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists path_templates_status_idx on public.path_templates (status);

alter table public.path_templates enable row level security;

drop policy if exists "Mentors manage path_templates" on public.path_templates;
create policy "Mentors manage path_templates"
  on public.path_templates
  for all
  to authenticated
  using (public.is_mentor())
  with check (public.is_mentor());

create table if not exists public.path_template_nodes (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.path_templates(id) on delete cascade,
  order_index int not null,
  title text not null,
  description text,
  kind public.node_kind not null default 'practice',
  week_number int,
  default_resource_url text,
  library_asset_id uuid references public.library_assets(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (template_id, order_index)
);

create index if not exists path_template_nodes_template_idx
  on public.path_template_nodes (template_id, order_index);

alter table public.path_template_nodes enable row level security;

drop policy if exists "Mentors manage path_template_nodes" on public.path_template_nodes;
create policy "Mentors manage path_template_nodes"
  on public.path_template_nodes
  for all
  to authenticated
  using (public.is_mentor())
  with check (public.is_mentor());

alter table public.paths
  add column if not exists source_template_id uuid
    references public.path_templates(id) on delete set null;

insert into storage.buckets (id, name, public)
values ('library', 'library', true)
on conflict (id) do nothing;

drop policy if exists "Mentors upload library" on storage.objects;
create policy "Mentors upload library"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'library' and public.is_mentor());

drop policy if exists "Mentors update library" on storage.objects;
create policy "Mentors update library"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'library' and public.is_mentor())
  with check (bucket_id = 'library' and public.is_mentor());

drop policy if exists "Mentors delete library" on storage.objects;
create policy "Mentors delete library"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'library' and public.is_mentor());

drop policy if exists "Authenticated read library" on storage.objects;
create policy "Authenticated read library"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'library');
