-- Social links on profile (store raw handle / phone digits)
alter table public.profiles
  add column if not exists instagram text,
  add column if not exists whatsapp text;
