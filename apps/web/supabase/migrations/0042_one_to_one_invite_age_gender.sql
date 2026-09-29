-- Age + gender on Neuma 1:1 invites (copied to profiles on redeem)
alter table public.one_to_one_invites
  add column if not exists age int,
  add column if not exists gender public.profile_gender;

alter table public.one_to_one_invites
  drop constraint if exists one_to_one_invites_age_check;

alter table public.one_to_one_invites
  add constraint one_to_one_invites_age_check
  check (age is null or (age >= 13 and age <= 120));
