-- Library items: a lesson is a video or a link. A practice is a video, a link,
-- or a file (image, text, or any other file). Existing rows become a lesson video.

update public.library_assets
set
  kind = 'video',
  usage = 'lesson',
  updated_at = now()
where kind is distinct from 'video'
   or usage is distinct from 'lesson';

alter table public.library_assets
  alter column kind set default 'video';

alter table public.library_assets
  drop constraint if exists library_assets_format_matches_type;

alter table public.library_assets
  add constraint library_assets_format_matches_type
  check (
    (usage = 'lesson' and kind in ('video', 'link'))
    or (usage = 'practice' and kind in ('video', 'link', 'file', 'image', 'text'))
  );
