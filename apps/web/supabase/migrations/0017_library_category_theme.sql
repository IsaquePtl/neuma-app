-- Optional visual theme for library categories (instrument identity)

alter table public.library_categories
  add column if not exists theme text
  check (theme is null or theme in ('acoustic', 'electric', 'piano'));
