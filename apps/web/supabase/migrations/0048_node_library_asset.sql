-- A level uses a library item. The item is edited only in the library;
-- the level keeps the link and a copy that is refreshed from that item.

alter table public.nodes
  add column if not exists library_asset_id uuid references public.library_assets(id) on delete set null;

create index if not exists nodes_library_asset_id_idx
  on public.nodes (library_asset_id);

-- A uniquely named item wins over a copied file URL, so a level is not
-- attached to a different item that happens to share an old video.
update public.nodes n
set library_asset_id = match.asset_id
from (
  select lower(btrim(title)) as title_key, (array_agg(id))[1] as asset_id
  from public.library_assets
  where archived_at is null
  group by lower(btrim(title))
  having count(*) = 1
) match
where n.library_asset_id is null
  and lower(btrim(n.title)) = match.title_key
  and (n.resource_url is null or n.resource_url like '%/library/%');

-- Levels that still point at the item's current file.
update public.nodes n
set library_asset_id = a.id
from public.library_assets a
where n.library_asset_id is null
  and n.resource_url is not null
  and btrim(n.resource_url) = btrim(a.url);

update public.path_template_nodes n
set library_asset_id = match.asset_id
from (
  select lower(btrim(title)) as title_key, (array_agg(id))[1] as asset_id
  from public.library_assets
  where archived_at is null
  group by lower(btrim(title))
  having count(*) = 1
) match
where n.library_asset_id is null
  and lower(btrim(n.title)) = match.title_key
  and (
    n.default_resource_url is null
    or n.default_resource_url like '%/library/%'
  );

update public.path_template_nodes n
set library_asset_id = a.id
from public.library_assets a
where n.library_asset_id is null
  and n.default_resource_url is not null
  and btrim(n.default_resource_url) = btrim(a.url);

-- Refresh the copies from the item they now belong to.
update public.nodes n
set
  resource_url = a.url,
  content_body = a.body
from public.library_assets a
where n.library_asset_id = a.id
  and (
    n.resource_url is distinct from a.url
    or n.content_body is distinct from a.body
  );

update public.path_template_nodes n
set default_resource_url = a.url
from public.library_assets a
where n.library_asset_id = a.id
  and n.default_resource_url is distinct from a.url;
