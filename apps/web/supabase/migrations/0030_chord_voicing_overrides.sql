-- 0030: Mentor-editable piano/guitar chord voicing overrides (Recursos)

create table if not exists public.chord_voicing_overrides (
  id uuid primary key default gen_random_uuid(),
  instrument text not null check (instrument in ('piano', 'guitar')),
  chord_key text not null,
  voicing_id text not null default '',
  payload jsonb not null,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (instrument, chord_key, voicing_id)
);

create index if not exists chord_voicing_overrides_lookup_idx
  on public.chord_voicing_overrides (instrument, chord_key);

alter table public.chord_voicing_overrides enable row level security;

drop policy if exists "Authenticated read chord_voicing_overrides" on public.chord_voicing_overrides;
create policy "Authenticated read chord_voicing_overrides"
  on public.chord_voicing_overrides
  for select
  to authenticated
  using (true);

drop policy if exists "Mentors manage chord_voicing_overrides" on public.chord_voicing_overrides;
create policy "Mentors manage chord_voicing_overrides"
  on public.chord_voicing_overrides
  for all
  to authenticated
  using (public.is_mentor())
  with check (public.is_mentor());
