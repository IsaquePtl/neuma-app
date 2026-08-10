-- Manual calendar events created by mentors in-app
create table if not exists public.mentor_calendar_events (
  id uuid primary key default gen_random_uuid(),
  mentor_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  kind text not null
    check (kind in ('reminder', 'meeting', 'event', 'misc')),
  starts_at timestamptz not null,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists mentor_calendar_events_mentor_starts_idx
  on public.mentor_calendar_events (mentor_id, starts_at);

alter table public.mentor_calendar_events enable row level security;

create policy "Mentors manage own calendar events"
  on public.mentor_calendar_events
  for all
  to authenticated
  using (mentor_id = auth.uid() and public.is_mentor())
  with check (mentor_id = auth.uid() and public.is_mentor());
